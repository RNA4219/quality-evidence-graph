import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { planConsumerMigration, applyConsumerMigration, readPublishedOutputs, publishFiles } from '../dist/index.js';
import { contentHash } from '../dist/record.js';
const cli = new URL('../dist/cli.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
async function consumer() {
  const directory = await mkdtemp(join(tmpdir(), 'qeg-consumer-'));
  await cp(new URL('../fixtures/positive-release-go/', import.meta.url), directory, { recursive: true });
  const input = JSON.parse(await readFile(join(directory, 'gate-input.json'), 'utf8'));
  const policy = structuredClone(input.policy);
  policy.policyHash = 'sha256:' + 'f'.repeat(64);
  delete input.policy.inputContract;
  const original = JSON.stringify(input, null, 2) + '\n';
  await writeFile(join(directory, 'gate-input.json'), original);
  return { directory, input, original, config: { migrationVersion: 'qeg-consumer-migration/v1', expectedInputHash: contentHash(original), policy } };
}
async function tree(directory) {
  const output = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) output[entry.name] = entry.isDirectory() ? await tree(join(directory, entry.name)) : contentHash(await readFile(join(directory, entry.name)));
  return output;
}
test('EAC-10 TC24: missing configuration and configured dry-runs are byte-for-byte non-mutating', async () => {
  const { directory, config } = await consumer();
  const before = await tree(directory);
  const missing = await planConsumerMigration(directory);
  assert.equal(missing.status, 'needs_configuration'); assert.ok(missing.missingInputs.length);
  const ready = await planConsumerMigration(directory, config);
  assert.equal(ready.status, 'ready', JSON.stringify(ready));
  assert.ok(ready.changes.some(change => change.path === '/policy/inputContract'));
  assert.deepEqual(await tree(directory), before);
});
test('EAC-10 TC24/25: explicit application preserves controls/history and repeated application is a byte-identical no-op', async () => {
  const { directory, input, original, config } = await consumer();
  const applied = await applyConsumerMigration(directory, config);
  assert.equal(applied.status, 'applied');
  const migrated = JSON.parse(await readFile(join(directory, 'gate-input.json'), 'utf8'));
  assert.deepEqual(migrated.graph.nodes, input.graph.nodes);
  assert.deepEqual(migrated.graph.edges, input.graph.edges);
  assert.deepEqual(migrated.waivers, input.waivers);
  assert.deepEqual(migrated.evidencePackage, input.evidencePackage);
  assert.equal(migrated.metadata.policyHash, config.policy.policyHash);
  assert.equal(await readFile(join(directory, 'migration-original.json'), 'utf8'), original);
  assert.equal((await readPublishedOutputs(directory)).files.get('gate-input.json'), JSON.stringify(migrated, null, 2) + '\n');
  const before = await tree(directory);
  assert.equal((await applyConsumerMigration(directory, config)).status, 'unchanged');
  assert.deepEqual(await tree(directory), before);
});
test('EAC-10: stale review, incomplete execution settings, profile weakening and stale policy hash cannot apply', async () => {
  for (const modify of [c => { c.expectedInputHash = 'sha256:' + '0'.repeat(64); }, c => { c.policy.inputContract.requireExecutedTests = true; delete c.policy.executionPolicy; },
    c => { c.policy.profile = c.policy.profile === 'ipo_controlled' ? 'lean' : 'ipo_controlled'; }, c => { c.policy.exitCodePolicy.disqualified = 0; }]) {
    const { directory, config } = await consumer(); modify(config);
    const before = await tree(directory);
    await assert.rejects(applyConsumerMigration(directory, config), /Migration blocked/);
    assert.deepEqual(await tree(directory), before);
  }
});
test('EAC-10: CLI dry-run/apply/reapply uses explicit config and reports missing configuration', async () => {
  const { directory, config } = await consumer();
  const configPath = join(directory, 'migration-config.json'); await writeFile(configPath, JSON.stringify(config));
  const run = args => spawnSync(process.execPath, [cli, 'migrate', directory, ...args], { encoding: 'utf8' });
  assert.equal(run([]).status, 2);
  for (const [args, expected] of [[['--config', configPath, '--dry-run'], 'ready'], [['--config', configPath, '--apply'], 'applied'], [['--config', configPath, '--apply'], 'unchanged']]) {
    const result = run(args); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).status, expected);
  }
  assert.equal(run(['--apply']).status, 1);
  assert.equal(run(['--config', configPath, '--dry-run', '--apply']).status, 1);
});

test('EAC-08/10: migration resumes uncommitted aliases and remains idempotent after later publications', async () => {
  const { directory, config } = await consumer();
  await applyConsumerMigration(directory, config);
  await unlink(join(directory, '.qeg-current.json')); // First-run interruption after aliases, before committing the pointer.
  await assert.rejects(readPublishedOutputs(directory), /No completed/);
  assert.equal((await applyConsumerMigration(directory, config)).status, 'applied');
  await readPublishedOutputs(directory);
  await publishFiles(directory, new Map([['another-output.json', '{}\n']]));
  const before = await tree(directory);
  assert.equal((await applyConsumerMigration(directory, config)).status, 'unchanged');
  assert.deepEqual(await tree(directory), before);
});
