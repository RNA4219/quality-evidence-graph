import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import * as api from '../dist/index.js';
import { contentHash } from '../dist/record.js';
import { createRawProducerFixture, persistRawFixture } from './helpers/raw-producer-fixture.mjs';
import { loadRawArtifacts } from '../dist/cli/raw-ingest.js';
const json = value => JSON.stringify(value, null, 2) + '\n';
const cli = (command, directory, ...args) => spawnSync(process.execPath, [resolve('dist/cli.js'), command, directory, ...args], { encoding: 'utf8' });
async function consumer(missingContract = false) {
  const directory = await mkdtemp(join(tmpdir(), 'qeg-transaction-'));
  await cp(resolve('fixtures/positive-release-go'), directory, { recursive: true });
  const input = JSON.parse(await readFile(join(directory, 'gate-input.json'), 'utf8'));
  input.policy.profile = input.metadata.profile = input.graph.metadata.profile = 'lean';
  if (input.placementPlan) input.placementPlan.metadata.profile = 'lean';
  delete input.evidencePackage;
  const policy = structuredClone(input.policy);
  policy.policyHash = 'sha256:' + 'f'.repeat(64);
  policy.inputContract.evaluationScope.target = 'updated-transaction-scope';
  if (missingContract) delete input.policy.inputContract;
  const original = json(input);
  await writeFile(join(directory, 'gate-input.json'), original);
  const config = { migrationVersion: 'qeg-consumer-migration/v1', expectedInputHash: contentHash(original), policy };
  const configPath = join(directory, 'migration-config.json');
  await writeFile(configPath, json(config));
  return { directory, original, config, configPath };
}
async function paused(mode, f) {
  const child = fork(new URL('./helpers/command-transaction-child.mjs', import.meta.url), [mode, f.directory, f.configPath], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stderr = ''; child.stderr.on('data', bytes => { stderr += bytes; }); child.stdout.resume();
  try {
    await new Promise((accept, reject) => {
      const timeout = setTimeout(() => reject(new Error('Boundary timeout: ' + stderr)), 15000);
      child.once('message', message => { clearTimeout(timeout); assert.equal(message.boundary, mode); accept(); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Child exited ${code}: ${stderr}`)); });
    });
  } catch (error) { child.kill(); throw error; }
  return child;
}
async function finish(child, kill = false) {
  const exited = once(child, 'exit');
  if (kill) child.kill('SIGKILL'); else child.send('resume');
  return (await exited)[0];
}

test('R1: placement and record own the lease from input read through publication', async t => {
  for (const mode of ['place-after-read', 'record-after-read']) await t.test(mode, async () => {
    const f = await consumer();
    const child = await paused(mode, f);
    try {
      await assert.rejects(api.applyConsumerMigration(f.directory, f.config), /busy|lease/);
      assert.equal(await readFile(join(f.directory, 'gate-input.json'), 'utf8'), f.original);
      assert.equal(await finish(child), 0);
      // place-tests legitimately changes placement; review the now-current input before migrating.
      f.config.expectedInputHash = contentHash(await readFile(join(f.directory, 'gate-input.json'), 'utf8'));
      assert.equal((await api.applyConsumerMigration(f.directory, f.config)).status, 'applied');
      const input = JSON.parse(await readFile(join(f.directory, 'gate-input.json'), 'utf8'));
      assert.equal(input.policy.policyHash, f.config.policy.policyHash);
      assert.equal(input.policy.inputContract.evaluationScope.target, 'updated-transaction-scope');
    } finally { if (child.exitCode === null) child.kill(); }
  });
});

test('R2: process death across record/migration generations restores inputs as well as outputs', async t => {
  for (const existingRecord of [false, true]) for (const mode of ['migration-before-input', 'migration-after-input', 'migration-after-pointer']) await t.test(`${existingRecord}/${mode}`, async () => {
    const f = await consumer(true);
    if (existingRecord) assert.equal(cli('record', f.directory).status, 2);
    const child = await paused(mode, f);
    try {
      for (const command of ['gate', 'record', 'place-tests']) {
        const result = cli(command, f.directory); assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stderr, /busy|lease/);
      }
      await assert.rejects(api.planConsumerMigration(f.directory, f.config), /busy|lease/);
      const busySchema = cli('schema-check', f.directory, '--json');
      assert.equal(busySchema.status, 2); assert.match(busySchema.stdout, /busy|lease/);
      await finish(child, true);
      const committed = mode === 'migration-after-pointer';
      if (!committed) {
        assert.equal(cli('gate', f.directory).status, 1);
        const interruptedSchema = cli('schema-check', f.directory, '--json');
        assert.equal(interruptedSchema.status, 2); assert.match(interruptedSchema.stdout, /Interrupted/);
        await assert.rejects(api.readPublishedOutputs(f.directory), /Interrupted/);
      }
      if (existingRecord || committed) await api.recoverOutputs(f.directory);
      else await assert.rejects(api.recoverOutputs(f.directory), /No completed/);
      const bytes = await readFile(join(f.directory, 'gate-input.json'), 'utf8');
      if (!committed) assert.equal(bytes, f.original);
      else assert.equal(JSON.parse(bytes).policy.policyHash, f.config.policy.policyHash);
      const gate = cli('gate', f.directory);
      assert.equal(gate.status, committed ? 0 : 2, gate.stdout + gate.stderr);
      if (existingRecord && !committed) assert.equal(JSON.parse((await api.readPublishedOutputs(f.directory)).files.get('gate-verdict.json')).verdict, 'disqualified');
    } finally { if (child.exitCode === null) child.kill(); }
  });
});

test('R2: recovery is restartable and a valid same-config migration can resume its own journal', async () => {
  const f = await consumer(true); assert.equal(cli('record', f.directory).status, 2);
  const migration = await paused('migration-after-input', f); await finish(migration, true);
  const recovery = await paused('recover-after-input', f); await finish(recovery, true);
  assert.equal(cli('gate', f.directory).status, 1);
  await api.recoverOutputs(f.directory);
  assert.equal(await readFile(join(f.directory, 'gate-input.json'), 'utf8'), f.original);
  const retry = await paused('migration-after-input', f); await finish(retry, true);
  const invalid = { ...f.config, expectedInputHash: 'sha256:' + '0'.repeat(64) };
  const before = await readFile(join(f.directory, 'gate-input.json'), 'utf8');
  await assert.rejects(api.applyConsumerMigration(f.directory, invalid), /blocked/);
  assert.equal(await readFile(join(f.directory, 'gate-input.json'), 'utf8'), before);
  assert.equal((await api.applyConsumerMigration(f.directory, f.config)).status, 'applied');
  assert.equal((await api.applyConsumerMigration(f.directory, f.config)).status, 'unchanged');
  assert.equal(cli('gate', f.directory).status, 0);
});

test('R2: corrupt rollback evidence cannot be used to overwrite input', async () => {
  const f = await consumer(true);
  const child = await paused('migration-after-input', f); await finish(child, true);
  const before = await readFile(join(f.directory, 'gate-input.json'), 'utf8');
  const pending = JSON.parse(await readFile(join(f.directory, '.qeg-pending.json'), 'utf8'));
  await writeFile(join(f.directory, '.qeg-generations', pending.id, '.qeg-rollback', 'gate-input.json'), 'corrupt');
  await assert.rejects(api.recoverOutputs(f.directory), /rollback hash mismatch/);
  assert.equal(await readFile(join(f.directory, 'gate-input.json'), 'utf8'), before);
  assert.equal(cli('gate', f.directory).status, 1);
  const recorded = await consumer(true); assert.equal(cli('record', recorded.directory).status, 2);
  const interrupted = await paused('migration-after-input', recorded); await finish(interrupted, true);
  const current = JSON.parse(await readFile(join(recorded.directory, '.qeg-current.json'), 'utf8'));
  const inputBefore = await readFile(join(recorded.directory, 'gate-input.json'), 'utf8');
  await writeFile(join(recorded.directory, '.qeg-generations', current.id, 'qeg.bundle.json'), 'corrupt');
  await assert.rejects(api.recoverOutputs(recorded.directory), /Generation hash mismatch/);
  assert.equal(await readFile(join(recorded.directory, 'gate-input.json'), 'utf8'), inputBefore);
  assert.equal(cli('gate', recorded.directory).status, 1);
});

test('R3: migration preview and application share CLI ID validation and refuse invalid configuration without writes', async () => {
  const f = await consumer(); f.config.policy.policyId = 'team:review-policy';
  const report = await api.planConsumerMigration(f.directory, f.config);
  assert.equal(report.status, 'blocked'); assert.equal(report.gate, undefined);
  assert.ok(report.missingInputs.some(issue => issue.includes('Unknown ID producer prefix')));
  await assert.rejects(api.applyConsumerMigration(f.directory, f.config), /Unknown ID producer prefix/);
  assert.equal(await readFile(join(f.directory, 'gate-input.json'), 'utf8'), f.original);
  const valid = await consumer(); const preview = await api.planConsumerMigration(valid.directory, valid.config);
  await api.applyConsumerMigration(valid.directory, valid.config);
  assert.equal(JSON.parse(cli('gate', valid.directory).stdout).verdict, preview.gate.verdict);
});

test('R4: graph bindings use manifest descriptors even when loaded refs are separate stale copies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qeg-binding-'));
  const { manifest, loaded } = await createRawProducerFixture(directory, api);
  const configured = structuredClone(manifest);
  const feature = loaded.find(item => item.ref.kind === 'feature_spec');
  feature.payload.source_refs[0].id = 'MD-spec';
  const ref = configured.artifacts.find(item => item.id === feature.ref.id);
  ref.sourceRefMappings = [{ sourceId: 'MD-spec', requirementId: 'rand:REQ-001' }];
  await persistRawFixture(directory, configured, loaded);
  let reloaded = await loadRawArtifacts(directory);
  assert.deepEqual(api.buildGraph(configured, loaded), api.buildGraph(reloaded.manifest, reloaded.loaded));
  ref.sourceRefMappings[0].requirementId = 'rand:missing';
  await persistRawFixture(directory, configured, loaded); reloaded = await loadRawArtifacts(directory);
  const graph = api.buildGraph(configured, loaded);
  assert.deepEqual(graph, api.buildGraph(reloaded.manifest, reloaded.loaded));
  assert.ok(graph.completeness.parserFailures.some(failure => /sourceRefMapping/.test(failure.reason)));
  assert.equal(graph.completeness.partial, true);
  const verdict = api.evaluateGate({ metadata: graph.metadata, graph, policy: configured.policy, waivers: [] });
  assert.ok(verdict.disqualifications.some(item => item.code === 'DQ-01'));
  assert.equal(cli('build-graph', directory).status, 2);
  const actual = cli('gate', directory); assert.equal(actual.status, 2, actual.stderr);
  assert.ok(JSON.parse(actual.stdout).disqualifications.some(item => item.code === 'DQ-01'));
});
