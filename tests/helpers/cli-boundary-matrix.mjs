import assert from 'node:assert/strict';
import { cp, mkdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const json = value => JSON.stringify(value, null, 2) + '\n';
const portable = path => path.replaceAll('\\', '/');
export function cliRunner(binary, defaultCwd) {
  return (args, options = {}) => {
    const env = { ...process.env }; delete env.QEG_CHANGED_FILES;
    const result = spawnSync(process.execPath, [binary, ...args], { cwd: options.cwd ?? defaultCwd, env: { ...env, ...options.env }, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.error, undefined, String(result.error));
    try { result.data = JSON.parse(result.stdout); } catch {}
    return result;
  };
}
function exit(result, code) { assert.equal(result.status, code, result.stderr + '\n' + result.stdout.slice(0, 4500)); return result; }
export async function boundaryConsumer(fixtureRoot, directory) {
  await cp(join(fixtureRoot, 'positive-release-go'), directory, { recursive: true });
  await unlink(join(directory, 'expected-gate-verdict.json'));
  const input = JSON.parse(await readFile(join(directory, 'gate-input.json'), 'utf8'));
  input.policy.profile = input.metadata.profile = input.graph.metadata.profile = 'lean';
  if (input.placementPlan) input.placementPlan.metadata.profile = 'lean';
  delete input.evidencePackage;
  await writeFile(join(directory, 'gate-input.json'), json(input));
  return input;
}
async function save(directory, input) { await writeFile(join(directory, 'gate-input.json'), json(input)); }
function git(directory, args) {
  return execFileSync('git', ['-c', 'safe.directory=' + portable(directory), ...args], { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function aliasDirectory(directory) {
  const physical = join(directory, 'physical'); const alias = join(directory, 'alias');
  await mkdir(physical, { recursive: true });
  await symlink(physical, alias, process.platform === 'win32' ? 'junction' : 'dir');
  return alias;
}

export async function verifyPathSelection(run, fixtures, directory) {
  // CLI spellings and Git/evaluator real paths must identify the same consumer.
  directory = await aliasDirectory(directory);
  for (const strategy of ['origin_main', 'head_parent', 'worktree']) {
    const repo = join(directory, strategy); const target = join(repo, 'packages/サービス consumer');
    const input = await boundaryConsumer(fixtures, target);
    git(repo, ['init', '-b', 'main']); git(repo, ['config', 'user.name', 'QEG matrix']); git(repo, ['config', 'user.email', 'qeg-matrix@example.invalid']);
    git(repo, ['config', 'diff.relative', 'true']);
    if (strategy !== 'worktree') {
      git(repo, ['add', '.']); git(repo, ['commit', '-m', 'valid input']);
      if (strategy === 'origin_main') git(repo, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    }
    delete input.policy.inputContract; await save(target, input);
    if (strategy !== 'worktree') { git(repo, ['add', '.']); git(repo, ['commit', '-m', 'policy edit']); }
    const env = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: repo };
    for (const cwd of [repo, join(repo, 'packages'), target]) {
      const arg = relative(cwd, target) || '.';
      const all = exit(run(['report', '--json', arg], { cwd, env }), 2);
      const selected = exit(run(['report', '--json', '--changed-only', arg], { cwd, env }), 2);
      assert.equal(selected.data.selection.strategy, strategy);
      assert.equal(selected.data.selection.selectedTargetCount, 1);
      assert.deepEqual(selected.data.summary, all.data.summary);
      for (const changed of [portable(relative(cwd, join(target, 'gate-input.json'))), join(target, 'gate-input.json')]) {
        exit(run(['report', '--json', '--changed-only', arg], { cwd, env: { QEG_CHANGED_FILES: changed } }), 2);
      }
    }
    const unrelated = exit(run(['report', '--json', '--changed-only', target], { cwd: repo, env: { QEG_CHANGED_FILES: 'elsewhere.txt' } }), 0);
    assert.equal(unrelated.data.selection.selectedTargetCount, 0);
    exit(run(['report', '--json', '--changed-only', target], { cwd: repo, env: { QEG_CHANGED_FILES: join(target, 'removed-directory', 'deleted.ts') } }), 2);
  }
}

export async function verifyTargetDiscovery(run, fixtures, directory) {
  const good = join(directory, 'good'); const missing = join(directory, 'missing');
  await boundaryConsumer(fixtures, good); await boundaryConsumer(fixtures, missing);
  exit(run(['record', missing]), 0);
  assert.equal(exit(run(['report', '--json', directory]), 0).data.summary.totalTargets, 2);
  await unlink(join(missing, 'gate-input.json'));
  const grouped = exit(run(['report', '--json', directory]), 1);
  assert.equal(grouped.data.summary.totalTargets, 2); assert.equal(grouped.data.summary.cliErrors, 1);
  assert.equal(exit(run(['report', '--json', missing]), 1).data.summary.cliErrors, 1);
  const ignored = join(directory, 'unrelated-assets'); await mkdir(ignored); await writeFile(join(ignored, 'note.txt'), 'ordinary data');
  const diagnostic = join(directory, 'diagnostic-bundle'); await mkdir(diagnostic);
  await writeFile(join(diagnostic, 'manifest.json'), '{}'); await writeFile(join(diagnostic, '.qeg-current.json'), '{}');
  // Every producer leaves a consumer-specific marker, including intermediate generations.
  for (const marker of ['ingest-manifest.json', 'qeg.bundle.json', 'test-placement-plan.json', 'migration-report.json']) {
    const target = join(directory, marker + '-consumer'); await mkdir(target); await writeFile(join(target, marker), '{}');
  }
  const malformed = join(directory, 'directory-input'); await mkdir(join(malformed, 'gate-input.json'), { recursive: true });
  const result = exit(run(['report', '--json', directory]), 1);
  assert.equal(result.data.summary.totalTargets, 7); assert.equal(result.data.summary.cliErrors, 6);
  const selected = exit(run(['report', '--json', '--changed-only', directory], { env: { QEG_CHANGED_FILES: 'unrelated.ts' } }), 1);
  assert.equal(selected.data.summary.cliErrors, 6);
}

export async function verifyBaseline(run, fixtures, directory) {
  directory = await aliasDirectory(directory);
  const target = join(directory, 'consumer'); const input = await boundaryConsumer(fixtures, target);
  delete input.policy.inputContract; await save(target, input);
  const current = exit(run(['report', '--json', target], { cwd: directory }), 2).data;
  const entries = current.targets[0].disqualifications.map(dq => ({ target: 'consumer', code: dq.code, message: dq.message, nodeIds: dq.nodeIds, owner: 'quality-owner', expiresAt: '2099-01-01T00:00:00Z' }));
  const baseline = join(directory, 'baseline.json');
  await writeFile(baseline, json({ entries }));
  exit(run(['baseline', 'audit', baseline, '--json', target], { cwd: directory }), 0);
  assert.equal(exit(run(['report', '--json', '--baseline', baseline, target], { cwd: directory }), 0).data.summary.baselineAccepted, 1);
  for (const name of ['other-consumer', 'nested/consumer']) {
    const other = join(directory, name); await boundaryConsumer(fixtures, other); await save(other, input);
    assert.equal(exit(run(['report', '--json', '--baseline', baseline, other], { cwd: directory }), 2).data.summary.baselineAccepted, 0);
    const audit = exit(run(['baseline', 'audit', baseline, '--json', other], { cwd: directory }), 0);
    assert.ok(audit.data.items.some(item => item.message.includes('no longer matches')));
  }
  for (const variant of ['expired', 'missing-owner', 'blank-owner', 'bad-date', 'blank-date', 'missing-target', 'bad-shape']) {
    const changed = structuredClone(entries);
    for (const entry of changed) {
      if (variant === 'expired') entry.expiresAt = '2000-01-01T00:00:00Z';
      if (variant === 'missing-owner') delete entry.owner;
      if (variant === 'blank-owner') entry.owner = ' ';
      if (variant === 'bad-date') entry.expiresAt = 'not-a-date';
      if (variant === 'blank-date') entry.expiresAt = '';
      if (variant === 'missing-target') entry.target = 'nonexistent';
    }
    await writeFile(baseline, json(variant === 'bad-shape' ? { entries: null } : { entries: changed }));
    exit(run(['baseline', 'audit', baseline, '--json', target], { cwd: directory }), 1);
    const report = exit(run(['report', '--json', '--baseline', baseline, target], { cwd: directory }), 1).data;
    assert.equal(report.errors[0].code, 'BASELINE_INVALID'); assert.equal(report.summary.baselineAccepted, 0); assert.equal(report.summary.gateFailed, 1);
  }
  // Warning-only expiration omission remains compatible; absolute and normalized relative target identities agree.
  const warning = structuredClone(entries); for (const entry of warning) { delete entry.expiresAt; entry.target = target; }
  await writeFile(baseline, json({ entries: warning }));
  exit(run(['report', '--json', '--baseline', baseline, target], { cwd: target }), 0);
  for (const entry of warning) entry.target = './nested/../consumer';
  await writeFile(baseline, json({ entries: warning })); exit(run(['report', '--json', '--baseline', baseline, target], { cwd: directory }), 0);
  for (const entry of warning) delete entry.target;
  await writeFile(baseline, json({ entries: warning })); exit(run(['report', '--json', '--baseline', baseline, target], { cwd: directory }), 0);
}

export async function verifyDiff(run, fixtures, directory) {
  directory = await aliasDirectory(directory);
  const target = join(directory, 'consumer'); const original = await boundaryConsumer(fixtures, target);
  const broken = structuredClone(original); delete broken.policy.inputContract; await save(target, broken);
  const previous = join(directory, 'previous.json'); await writeFile(previous, json(exit(run(['report', '--json', target], { cwd: directory }), 2).data));
  const args = ['report', '--json', '--diff', previous, target];
  assert.equal(exit(run(args, { cwd: directory }), 2).data.diff.unchanged.length, 1);
  const skipped = exit(run([...args, '--changed-only'], { cwd: directory, env: { QEG_CHANGED_FILES: '' } }), 0).data;
  assert.equal(skipped.diff.resolved.length, 0); assert.equal(skipped.diff.unverified[0].reason, 'not_evaluated');
  // Execute the shipped Action summary program against a real skipped-target report.
  const action = await readFile(join(fixtures, '../qeg-report-action/action.yml'), 'utf8');
  const summaryProgram = action.split(/\r?\n/).find(line => line.includes('node -e "') && line.includes('- unverified DQs:'));
  assert.ok(summaryProgram, 'Action must preserve unverified DQs in its artifact');
  const skippedPath = join(directory, 'skipped.json'); const artifactSummary = join(directory, 'artifact-summary.md');
  await writeFile(skippedPath, json(skipped)); await writeFile(artifactSummary, '');
  const rendered = spawnSync(process.execPath, ['-e', summaryProgram.match(/node -e "(.*)"$/)[1]], { encoding: 'utf8', env: { ...process.env, QEG_OUTPUT_PATH: skippedPath, QEG_SUMMARY_PATH: artifactSummary } });
  assert.equal(rendered.status, 0, rendered.stderr); assert.match(await readFile(artifactSummary, 'utf8'), /unverified DQs: 1/);
  await writeFile(join(target, 'gate-input.json'), '{');
  const failed = exit(run(args, { cwd: directory }), 1).data;
  assert.equal(failed.diff.resolved.length, 0); assert.equal(failed.diff.unverified[0].reason, 'evaluation_failed');
  const summary = join(directory, 'summary.md'); await writeFile(summary, '');
  const text = exit(run(['report', '--diff', previous, '--github-summary', target], { cwd: directory, env: { GITHUB_STEP_SUMMARY: summary } }), 1);
  assert.match(text.stdout, /unverified DQs: 1/); assert.match(await readFile(summary, 'utf8'), /unverified DQs: 1/);
  await save(target, original);
  const fixed = exit(run(args, { cwd: directory }), 0).data;
  assert.equal(fixed.diff.resolved.length, 1); assert.equal(fixed.diff.unverified.length, 0);
  const invalidBaseline = join(directory, 'invalid-baseline.json'); await writeFile(invalidBaseline, '{"entries":null}');
  const bad = exit(run(['report', '--baseline', invalidBaseline, target], { cwd: directory }), 1);
  assert.match(bad.stdout, /Overall: FAIL/); assert.match(bad.stdout, /BASELINE_INVALID/);
}

export async function verifyDistribution(run, fixtures, directory) {
  const target = join(directory, 'consumer'); await boundaryConsumer(fixtures, target);
  exit(run(['schema-check', '--json'], { cwd: directory }), 0);
  exit(run(['report', '--json', target], { cwd: directory }), 0);
  // The consumer's package/schema files must not replace QEG's installed metadata.
  for (const localFiles of [false, true]) {
    if (localFiles) {
      await writeFile(join(directory, 'package.json'), json({ name: 'unrelated-consumer', version: '99.0.0', engines: { node: '>=999' } }));
      await mkdir(join(directory, 'schemas')); await writeFile(join(directory, 'schemas/shared-defs.schema.json'), '{}');
    }
    const doctor = exit(run(['doctor', '--json', target], { cwd: directory }), 0).data;
    assert.ok(doctor.checks.every(check => check.severity !== 'fail'));
    assert.equal(exit(run(['enum-check', '--json'], { cwd: directory }), 0).data.items.length, 10);
    const out = join(directory, localFiles ? 'bundle-with-local-files' : 'bundle');
    exit(run(['repro-bundle', target, '--out', out], { cwd: directory }), 0);
    const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
    assert.equal(manifest.package.name, '@quality-harness/quality-evidence-graph'); assert.equal(manifest.package.version, '0.4.1');
    for (const file of manifest.files) assert.equal(createHash('sha256').update(await readFile(file.path)).digest('hex'), file.sha256);
    assert.deepEqual(manifest.inputErrors, []);
  }
  exit(run(['snapshot', '--update', target], { cwd: directory }), 0);
  const checked = exit(run(['check', '--json', target], { cwd: directory }), 0).data;
  assert.ok(checked.items.every(item => item.status !== 'fail'));
}
