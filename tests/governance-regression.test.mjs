import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as api from '../dist/index.js';
import { validateWaiver } from '../dist/gate.js';
import { timestampNanos } from '../dist/timestamps.js';
import { cliRunner } from './helpers/cli-boundary-matrix.mjs';
import { governanceMatrix } from './helpers/governance-matrix.mjs';
const repo = resolve('.'), fixtures = join(repo, 'fixtures');

for (const [surface, entry] of [['CLI/API', 'dist/cli.js'], ['Action', 'qeg-report-action/dist/cli.mjs']]) {
  for (const [finding, verify] of governanceMatrix) test(`${surface}: ${finding} governance regression and controls`, async () => {
    await verify(cliRunner(join(repo, entry), repo), fixtures, await mkdtemp(join(tmpdir(), 'qeg-governance-')), surface === 'CLI/API' ? api : undefined);
  });
}
test('Initialized runtime: R20-R24 governance matrix', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qeg-governance-init-')), starter = join(directory, 'starter');
  const result = cliRunner(join(repo, 'dist/cli.js'), directory)(['init', '--root', starter]); assert.equal(result.status, 0, result.stderr + result.stdout);
  const run = cliRunner(join(starter, '.qeg/runtime/qeg-report-action/dist/cli.mjs'), directory);
  for (const [finding, verify] of governanceMatrix) await verify(run, fixtures, join(directory, finding));
});
test('R22: strict timestamps preserve leap dates, offsets and submillisecond boundaries', () => {
  assert.equal(timestampNanos('2024-02-29T09:00:00.000000001+09:00'), timestampNanos('2024-02-29T00:00:00Z') + 1n);
  assert.equal(timestampNanos('1969-12-31T23:59:59.999999999Z'), -1n);
  for (const value of ['2023-02-29T00:00:00Z', '1900-02-29T00:00:00Z', '2026-01-01T00:00:00', '2026-01-01T00:00:00+24:00', '2026-01-01T00:00:00.0000000001Z']) assert.equal(timestampNanos(value), undefined);
  assert.notEqual(timestampNanos('2000-02-29T00:00:00Z'), undefined);
  const waiver = { linkedRiskIds: [], approver: 'approver', approvalAuthority: 'authority', sourceRefs: [{}], expiry: '2026-01-01T00:00:00.000000001Z', impactScope: 'scope', rollbackOrContainment: 'revert', followUpOwner: 'owner', recheckCondition: 'next', reason: 'reason' };
  assert.equal(validateWaiver(waiver, { nodes: [] }, new Date('2026-01-01T00:00:00Z')).valid, true);
  assert.equal(validateWaiver(waiver, { nodes: [] }, new Date(NaN)).valid, false);
});
