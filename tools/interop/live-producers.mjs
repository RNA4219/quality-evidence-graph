import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { upstreamInputContract, buildGraph, placeTests, verifyEvidenceArtifacts, evaluateGate, parseProducerArtifact } from '../../dist/index.js';
import { sourceFingerprint } from './provenance.mjs';

const options = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, all) => index % 2 ? rows : [...rows, [value.replace(/^--/, ''), all[index + 1]]], []));
for (const key of ['workspace', 'rand', 'manual', 'ctg', 'python']) if (!options[key]) throw new Error(`--${key} is required`);
const root = resolve(options.workspace);
const producerLock = JSON.parse(await readFile(new URL('./producer-lock.json', import.meta.url), 'utf8'));
const roots = { RanD: options.rand, 'code-to-gate': options.ctg, 'manual-bb-test-harness': options.manual };
async function verifySources() {
  for (const [name, lock] of Object.entries(producerLock)) if (await sourceFingerprint(roots[name], lock.prefixes) !== lock.sourceHash) throw new Error(`Producer source differs from reviewed lock: ${name}`);
}
await verifySources();
await mkdir(root, { recursive: false });
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = value => 'sha256:' + createHash('sha256').update(value).digest('hex');
const commands = [];
function run(executable, args, cwd = root, allowed = [0]) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 8 * 1024 * 1024 });
  commands.push({ executable, args, cwd, exitCode: result.status, stdout: result.stdout, stderr: result.stderr });
  if (!allowed.includes(result.status)) throw new Error(`${executable} ${args.join(' ')}: ${result.status}\n${result.stderr}\n${result.stdout}`);
  return result.stdout.trim();
}
const targetDir = join(root, 'target'); await mkdir(targetDir); await mkdir(join(targetDir, 'src'));
const git = (...args) => run('git', ['-c', `safe.directory=${targetDir.replaceAll('\\', '/')}`, ...args], targetDir);
await writeFile(join(targetDir, 'package.json'), json({ name: 'qeg-interoperability-target', version: '1.0.0', type: 'module', private: true }));
await writeFile(join(targetDir, 'spec.md'), '---\nfeature_id: CLI-INCREMENT\ntitle: Increment CLI\n---\n# Increment CLI\n\n## Acceptance criteria\n- AC-1: Running node src/cli.mjs 41 exits with 0 and prints 42.\n\n## Changed areas\n- src/cli.mjs\n');
await writeFile(join(targetDir, 'src/cli.mjs'), 'console.log(Number(process.argv[2]));\n');
git('init'); git('config', 'user.name', 'QEG acceptance'); git('config', 'user.email', 'qeg@example.invalid'); git('add', '.'); git('commit', '-m', 'Isolated CLI baseline');
const base = git('rev-parse', 'HEAD');
await writeFile(join(targetDir, 'src/cli.mjs'), 'console.log(Number(process.argv[2]) + 1);\n');
git('add', '.'); git('commit', '-m', 'Implement specified increment');
const revision = git('rev-parse', 'HEAD');
const target = { projectId: 'qeg-live-interop', buildId: 'isolated-cli-build-001', revision, environmentId: 'isolated-local' };
const versions = {
  RanD: { version: '0.3.0', revision: 'b4315040fd1cb823421cff53a0c7eda6f9d89c4a', mode: 'producer API execution' },
  'code-to-gate': { version: JSON.parse(await readFile(join(options.ctg, 'package.json'), 'utf8')).version, revision: 'aab3d8c7833a0001e1b59f0a2b491eb9baebf0b0', mode: 'producer CLI execution' },
  'manual-bb-test-harness': { version: '3.0.0', revision: '76722574298985100b3a6efc730b2dd0f0cb4041', mode: 'producer ingest/gate CLI; operator-authored case/risk; real subprocess observation' },
};
try {
  for (const runId of ['first', 'rerun']) {
    const dir = join(root, runId); await mkdir(dir);
    const producerDir = join(dir, 'producer');
    run(options.python, [fileURLToPath(new URL('./producer-bridge.py', import.meta.url)), '--rand', resolve(options.rand), '--manual', resolve(options.manual),
      '--target', targetDir, '--out', producerDir, '--run', runId, '--build', target.buildId, '--node', process.execPath]);
    const ctgDir = join(dir, 'ctg');
    const ctg = join(resolve(options.ctg), 'dist/cli.js');
    run(process.execPath, [ctg, 'analyze', targetDir, '--base', base, '--head', revision, '--out', ctgDir, '--cache', 'disabled', '--llm-provider', 'deterministic', '--emit', 'all'], targetDir, [0, 1, 2]);
    run(process.execPath, [ctg, 'diff', targetDir, '--base', base, '--head', revision, '--out', ctgDir, '--cache', 'disabled'], targetDir, [0, 2]);
    run(process.execPath, [ctg, 'readiness', targetDir, '--policy', join(resolve(options.ctg), '.github/ctg-policy.yaml'), '--from', ctgDir, '--out', ctgDir], targetDir, [0, 1, 2]);
    const artifacts = [];
    const rawDir = join(dir, 'raw'); await mkdir(rawDir);
    for (const [adapter, producerRoot, names] of [
      ['RanD', producerDir, ['requirements_packet', 'requirements_audit_packet']],
      ['code-to-gate', ctgDir, ['normalized_repo_graph', 'diff_analysis', 'findings', 'risk_register', 'test_seeds', 'release_readiness', 'audit']],
      ['manual-bb-test-harness', producerDir, ['feature_spec', 'risk_register', 'manual_case_set', 'execution_evidence', 'gate_decision']],
    ]) for (const kind of names) {
      const filename = adapter === 'code-to-gate' && kind === 'normalized_repo_graph' ? 'repo-graph.json' : adapter === 'code-to-gate' && kind === 'risk_register' ? 'risk-register.yaml' : (adapter === 'code-to-gate' ? kind.replaceAll('_', '-') : kind) + '.json';
      const path = `raw/${adapter}-${filename}`;
      await copyFile(join(producerRoot, filename), join(dir, path));
      const bytes = await readFile(join(dir, path));
      const refOptions = {};
      if (adapter === 'code-to-gate' && filename.endsWith('.json')) {
        const reported = JSON.parse(bytes).repo?.revision;
        if (reported && reported !== revision) {
          if (git('rev-parse', reported) !== revision) throw new Error('Producer revision does not resolve to the common target');
          refOptions.reportedRevision = reported;
        }
      }
      if (adapter === 'manual-bb-test-harness' && kind === 'feature_spec') refOptions.sourceRefMappings = [{ sourceId: 'MD-spec', requirementId: 'rand:REQ-001' }];
      artifacts.push({ id: `qeg:live-${adapter}-${kind}`, adapter, kind, path, contentHash: hash(bytes), revision,
        ...refOptions,
        contractVersion: adapter === 'RanD' ? 'rand-kano/1.0' : adapter === 'code-to-gate' ? 'ctg-artifacts/v1' : 'manual-bb/v1',
        ...(adapter === 'manual-bb-test-harness' ? { executionContext: { projectId: target.projectId, environmentId: target.environmentId, producerVersion: '3.0.0' } } : {}) });
    }
    const createdAt = new Date().toISOString();
    const binding = json({ bindingVersion: 'qeg-build/v1', target }); await writeFile(join(dir, 'build-binding.json'), binding);
    const sourceRefs = [{ id: 'qeg:live-policy', path: 'interop-policy.json' }];
    const policyBody = { description: 'Isolated interoperability acceptance', maxEvidenceAgeHours: 24, target, scope: 'agent-operated local CLI; production/human release approval excluded' };
    await writeFile(join(dir, 'interop-policy.json'), json(policyBody));
    const policy = { policyId: 'qeg:live-policy', policyHash: hash(json(policyBody)), profile: 'lean', effectiveDate: createdAt, approver: 'acceptance-runner', sourceRefs,
      dqScope: Array.from({ length: 21 }, (_, index) => `DQ-${String(index + 1).padStart(2, '0')}`), exitCodePolicy: { go: 0, conditional_go: 2, no_go: 2, disqualified: 2 },
      inputContract: upstreamInputContract('live-producer-isolated-cli'), executionPolicy: { target, maxEvidenceAgeHours: 24, sourceRefs,
        buildBindingRef: { id: 'qeg:live-build', path: 'build-binding.json', contentHash: hash(binding), revision } } };
    const metadata = { qegVersion: '0.2', runId: `qeg:live-${runId}`, createdAt, headRef: revision, profile: 'lean', policyId: policy.policyId, policyHash: policy.policyHash, inputArtifacts: [] };
    const manifest = { manifestVersion: 'qeg-ingest/v1', metadata, policy, artifacts, waivers: [] };
    await writeFile(join(dir, 'ingest-manifest.json'), json(manifest));
    const qeg = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
    for (const command of ['build-graph', 'place-tests', 'record']) run(process.execPath, [qeg, command, dir], root, [0, 2]);
    const graph = buildGraph(manifest, await Promise.all(artifacts.map(async ref => ({ ref, payload: parseProducerArtifact(ref, await readFile(join(dir, ref.path), 'utf8')) }))));
    const input = { metadata: graph.metadata, graph, placementPlan: placeTests(graph, policy), policy, waivers: [] };
    const evidenceVerification = await verifyEvidenceArtifacts(input, { baseDir: dir });
    const gate = evaluateGate({ ...input, evidenceVerification });
    const cliGate = JSON.parse(await readFile(join(dir, 'gate-verdict.json'), 'utf8'));
    await writeFile(join(dir, 'acceptance.json'), json({ evidenceClass: 'live_producer_rerun', runId, target, versions, graphPartial: graph.completeness.partial,
      evidenceStatus: evidenceVerification.status, apiVerdict: gate.verdict, cliVerdict: cliGate.verdict, disqualifications: cliGate.disqualifications, producerLock,
      rawHashes: artifacts.map(({ path, contentHash }) => ({ path, contentHash })), excluded: ['production deployment', 'human-executed QA', 'external release approval'] }));
  }
  await verifySources();
} finally { await writeFile(join(root, 'commands.json'), json(commands)); }
console.log(root);
