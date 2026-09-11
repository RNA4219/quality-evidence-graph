import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as api from '../dist/index.js';
import { cliRunner } from './helpers/cli-boundary-matrix.mjs';
import { gateContractMatrix, verifySnapshotContract, verifyStatusContract } from './helpers/gate-contract-matrix.mjs';
import { normalizeStatus, shellStatus, statusAliases } from '../dist/cli/evidence-normalize/values.js';
const repo = resolve('.'), fixtures = join(repo, 'fixtures');
test('R17: unknown/prototype status names and conflicting aliases are not missing data', () => {
  for (const value of ['', 'constructor', 'toString', '__proto__', 0, [], null, {}]) assert.throws(() => normalizeStatus(value));
  assert.equal(normalizeStatus(undefined), undefined);
  assert.equal(statusAliases({ status: 'SUCCESS', conclusion: true }, 'status', 'conclusion'), 'pass');
  assert.throws(() => statusAliases({ status: 'pass', conclusion: 'unknown' }, 'status', 'conclusion'));
  assert.throws(() => statusAliases({ status: 'pass', conclusion: false }, 'status', 'conclusion'));
});
test('R17: shell preserves detailed nonpass statuses and validates exit codes', () => {
  for (const status of ['fail', 'timeout', 'error', 'aborted', 'skipped']) assert.equal(shellStatus({ status, exitCode: 1 }), status);
  for (const exitCode of ['0', 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, null]) assert.throws(() => shellStatus({ exitCode }));
  assert.throws(() => shellStatus({ status: 'failed', exitCode: 0 }));
  assert.equal(shellStatus({ exitCode: 0 }), 'pass');
});
for (const [name, entry] of [['CLI/API', 'dist/cli.js'], ['Action', 'qeg-report-action/dist/cli.mjs']]) {
  const run = cliRunner(join(repo, entry), repo);
  for (const [finding, verify] of gateContractMatrix) {
    test(`${name}: ${finding} regression and controls`, async () => verify(run, fixtures, await mkdtemp(join(tmpdir(), 'qeg-contract-')), name === 'CLI/API' ? api : undefined));
  }
}
test('Initialized runtime: R17/R19 status and snapshots', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qeg-contract-init-')); const starter = join(directory, 'starter');
  const init = cliRunner(join(repo, 'dist/cli.js'), directory)(['init', '--root', starter]); assert.equal(init.status, 0, init.stderr + init.stdout);
  const run = cliRunner(join(starter, '.qeg/runtime/qeg-report-action/dist/cli.mjs'), directory);
  await verifyStatusContract(run, fixtures, join(directory, 'status'));
  await verifySnapshotContract(run, fixtures, join(directory, 'snapshots'));
});
