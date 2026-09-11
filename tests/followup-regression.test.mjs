import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import * as api from '../dist/index.js';
import { createRawProducerFixture, persistRawFixture } from './helpers/raw-producer-fixture.mjs';
const root = resolve('.');
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const contentHash = bytes => 'sha256:' + hash(bytes);
const cli = (args, options = {}) => spawnSync(process.execPath, [join(root, 'dist/cli.js'), ...args], { cwd: root, encoding: 'utf8', ...options });
async function consumer(directory) {
  directory ??= await mkdtemp(join(tmpdir(), 'qeg-followup-'));
  await cp(join(root, 'fixtures/positive-release-go'), directory, { recursive: true });
  const input = JSON.parse(await readFile(join(directory, 'gate-input.json'), 'utf8'));
  input.policy.profile = input.metadata.profile = input.graph.metadata.profile = 'lean';
  if (input.placementPlan) input.placementPlan.metadata.profile = 'lean';
  delete input.evidencePackage;
  await writeFile(join(directory, 'gate-input.json'), json(input));
  return { directory, input };
}
async function configuration(directory, policy, digit = 'f') {
  const original = await readFile(join(directory, 'gate-input.json'), 'utf8');
  const config = { migrationVersion: 'qeg-consumer-migration/v1', expectedInputHash: contentHash(original), policy: { ...structuredClone(policy), policyHash: 'sha256:' + digit.repeat(64) } };
  const path = join(directory, 'migration-config.json'); await writeFile(path, json(config));
  return { config, path, original };
}
async function paused(mode, directory, configPath) {
  const child = fork(join(root, 'tests/helpers/command-transaction-child.mjs'), [mode, directory, configPath], { cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stderr = ''; child.stderr.on('data', b => { stderr += b; }); child.stdout.resume();
  await new Promise((accept, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Boundary timeout: ' + stderr)); }, 15000);
    child.once('message', () => { clearTimeout(timeout); accept(); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('Child exit ' + code + ': ' + stderr)); });
  });
  return child;
}
async function kill(child) { const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited; }

test('R6: recovery and repeated recovery preserve native edits after every producer generation', async t => {
  for (const producer of ['record', 'migration', 'place-tests', 'build-graph']) await t.test(producer, async () => {
    const f = await consumer();
    if (producer === 'migration') await api.applyConsumerMigration(f.directory, (await configuration(f.directory, f.input.policy)).config);
    else {
      if (producer === 'build-graph') {
        const { manifest, loaded } = await createRawProducerFixture(f.directory, api);
        await persistRawFixture(f.directory, manifest, loaded);
      }
      const result = cli([producer, f.directory]); assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    const input = JSON.parse(await readFile(join(f.directory, 'gate-input.json'), 'utf8'));
    const policy = structuredClone(input.policy); delete input.policy.inputContract;
    const before = json(input); await writeFile(join(f.directory, 'gate-input.json'), before);
    const c = await configuration(f.directory, policy, 'a');
    assert.equal(cli(['gate', f.directory]).status, 2);
    const migration = await paused('migration-after-input', f.directory, c.path); await kill(migration);
    assert.equal(cli(['gate', f.directory]).status, 1);
    const recovery = await paused('recover-after-input', f.directory, c.path); await kill(recovery);
    assert.equal(cli(['gate', f.directory]).status, 1);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (producer === 'record') await api.recoverOutputs(f.directory);
      else await assert.rejects(api.recoverOutputs(f.directory), /native input preserved/);
      assert.equal(await readFile(join(f.directory, 'gate-input.json'), 'utf8'), before);
      const gate = cli(['gate', f.directory]); assert.equal(gate.status, 2, gate.stdout + gate.stderr);
      assert.ok(JSON.parse(gate.stdout).disqualifications.some(item => item.code === 'DQ-01'));
    }
    if (producer !== 'record') await assert.rejects(api.readPublishedOutputs(f.directory), /native input preserved/);
    assert.equal((await api.applyConsumerMigration(f.directory, c.config)).status, 'applied');
    assert.ok((await api.readPublishedOutputs(f.directory)).files.has('gate-input.json'));
  });
});

test('R6: alias repair cannot restore a deleted or malformed native input from an older generation', async t => {
  for (const state of ['missing', 'malformed']) await t.test(state, async () => {
    const f = await consumer(); await api.applyConsumerMigration(f.directory, (await configuration(f.directory, f.input.policy)).config);
    const inputPath = join(f.directory, 'gate-input.json');
    if (state === 'missing') await unlink(inputPath); else await writeFile(inputPath, '{');
    for (let i = 0; i < 2; i++) await assert.rejects(api.recoverOutputs(f.directory), /native input preserved/);
    if (state === 'missing') await assert.rejects(readFile(inputPath), { code: 'ENOENT' });
    else assert.equal(await readFile(inputPath, 'utf8'), '{');
    assert.equal(cli(['gate', f.directory]).status, 1);
  });
});

test('R5a: invalid, missing and schema-invalid inputs enter evaluation instead of disappearing', async t => {
  for (const state of ['malformed', 'missing', 'schema-invalid']) await t.test(state, async () => {
    const f = await consumer(); const inputPath = join(f.directory, 'gate-input.json');
    if (state === 'missing') await unlink(inputPath);
    else if (state === 'malformed') await writeFile(inputPath, '{');
    else { delete f.input.policy; await writeFile(inputPath, json(f.input)); }
    const options = { env: { ...process.env, QEG_CHANGED_FILES: 'src/affected.ts' } };
    const all = cli(['report', '--json', f.directory], options);
    const selected = cli(['report', '--json', '--changed-only', f.directory], options);
    assert.notEqual(all.status, 0); assert.equal(selected.status, all.status, selected.stderr);
    const report = JSON.parse(selected.stdout); assert.equal(report.selection.selectedTargetCount, 1);
    assert.equal(report.summary.cliErrors + report.summary.gateFailed, 1);
  });
});

test('R5a: changed-only cannot skip a busy or interrupted managed input', async () => {
  const f = await consumer(); const c = await configuration(f.directory, f.input.policy);
  const child = await paused('migration-after-input', f.directory, c.path);
  try {
    const command = () => cli(['report', '--json', '--changed-only', f.directory], { env: { ...process.env, QEG_CHANGED_FILES: 'unrelated.ts' } });
    assert.equal(command().status, 1);
    await kill(child);
    const result = command(); assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).summary.cliErrors, 1);
  } finally { if (child.exitCode === null && child.signalCode === null) await kill(child); }
});

async function gitRepo() {
  const directory = await mkdtemp(join(tmpdir(), 'qeg-changes-'));
  const git = args => execFileSync('git', ['-c', 'safe.directory=' + directory.replaceAll('\\', '/'), ...args], { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init']); git(['config', 'user.name', 'QEG regression']); git(['config', 'user.email', 'qeg-test@example.invalid']);
  const env = { ...process.env, QEG_CHANGED_FILES: undefined, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: directory };
  return { directory, git, env };
}

test('R5b: Git deletion and both rename paths match explicit selection, including spaces and non-ASCII', async t => {
  for (const strategy of ['origin_main', 'head_parent']) for (const change of ['delete', 'rename']) await t.test(`${strategy}/${change}`, async () => {
    const g = await gitRepo(); const oldPath = 'src/旧 code.ts'; const newPath = 'src/新 code.ts';
    await mkdir(join(g.directory, 'src')); await writeFile(join(g.directory, oldPath), 'export const value = 1;\n');
    g.git(['add', '--', oldPath]); g.git(['commit', '-m', 'baseline']);
    if (strategy === 'origin_main') g.git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    g.git(change === 'delete' ? ['rm', '--', oldPath] : ['mv', '--', oldPath, newPath]);
    g.git(['commit', '-m', change]);
    const f = await consumer(); delete f.input.policy.inputContract;
    for (const path of change === 'delete' ? [oldPath] : [oldPath, newPath]) {
      f.input.metadata.inputArtifacts[0].path = path; await writeFile(join(f.directory, 'gate-input.json'), json(f.input));
      const automatic = cli(['report', '--json', '--changed-only', f.directory], { cwd: g.directory, env: g.env });
      const explicit = cli(['report', '--json', '--changed-only', f.directory], { cwd: g.directory, env: { ...g.env, QEG_CHANGED_FILES: path } });
      assert.equal(automatic.status, 2, automatic.stdout + automatic.stderr); assert.equal(automatic.status, explicit.status);
      const report = JSON.parse(automatic.stdout); assert.equal(report.selection.strategy, strategy); assert.equal(report.selection.selectedTargetCount, 1);
    }
  });
});

test('R5b: worktree fallback reads NUL-delimited non-ASCII filenames without Git quoting', async () => {
  const g = await gitRepo(); const path = '未追跡 file.ts'; await writeFile(join(g.directory, path), 'x');
  const f = await consumer(); delete f.input.policy.inputContract; f.input.metadata.inputArtifacts[0].path = path;
  await writeFile(join(f.directory, 'gate-input.json'), json(f.input));
  const result = cli(['report', '--json', '--changed-only', f.directory], { cwd: g.directory, env: g.env });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout); assert.equal(report.selection.strategy, 'worktree'); assert.equal(report.selection.selectedTargetCount, 1);
});

async function verifyBundle(directory) {
  const snapshot = await api.readPublishedOutputs(directory);
  const manifest = JSON.parse(snapshot.files.get('manifest.json'));
  assert.equal(new Set(manifest.files.map(file => file.path)).size, manifest.files.length);
  for (const file of manifest.files) assert.equal(hash(await readFile(file.path)), file.sha256);
  return manifest;
}

test('R7: same-basename targets retain distinct redacted inputs and source mappings across repeated bundles', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'qeg-secret-bundle-'));
  const a = await consumer(join(parent, 'a/consumer')); const b = await consumer(join(parent, 'b/consumer'));
  a.input.metadata.runId = 'qeg:first'; b.input.metadata.runId = 'qeg:second';
  a.input.secret = 'sensitive-value';
  await writeFile(join(a.directory, 'gate-input.json'), json(a.input)); await writeFile(join(b.directory, 'gate-input.json'), json(b.input));
  const out = join(parent, 'bundle');
  for (const targets of [[a.directory, b.directory], [b.directory, a.directory]]) {
    const result = cli(['repro-bundle', ...targets, '--out', out]); assert.equal(result.status, 0, result.stdout + result.stderr);
    const manifest = await verifyBundle(out); assert.deepEqual(manifest.inputErrors, []);
    const inputs = manifest.files.filter(file => file.sourceTarget); assert.equal(inputs.length, 2);
    for (const file of inputs) {
      const captured = JSON.parse(await readFile(file.path, 'utf8'));
      assert.equal(captured.metadata.runId, file.sourceTarget === a.directory ? 'qeg:first' : 'qeg:second');
      if (file.sourceTarget === a.directory) assert.equal(captured.secret, '[REDACTED]');
    }
  }
});

test('R7: bundle capture errors are explicit and publication failure preserves the previous complete bundle', async () => {
  const f = await consumer(); const out = join(await mkdtemp(join(tmpdir(), 'qeg-bundle-failure-')), 'bundle');
  const first = cli(['repro-bundle', f.directory, '--out', out]); assert.equal(first.status, 0, first.stderr);
  const original = await api.readPublishedOutputs(out);
  const other = await consumer(); await mkdir(join(out, 'gate-input-' + hash(other.directory) + '.json'));
  const failed = cli(['repro-bundle', f.directory, other.directory, '--out', out]); assert.equal(failed.status, 1);
  assert.deepEqual((await api.readPublishedOutputs(out)).files, original.files);
  await writeFile(join(f.directory, 'gate-input.json'), '{');
  const result = cli(['repro-bundle', f.directory, '--out', out]); assert.equal(result.status, 0, result.stderr);
  const manifest = await verifyBundle(out); assert.equal(manifest.inputErrors.length, 1);
  assert.equal(manifest.inputErrors[0].target, f.directory);
  assert.equal(manifest.files.filter(file => file.sourceTarget).length, 0);
});
