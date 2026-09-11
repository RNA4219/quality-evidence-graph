import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as api from '../dist/index.js';
import { cliRunner } from './helpers/cli-boundary-matrix.mjs';
import { manualGovernanceMatrix } from './helpers/manual-governance-matrix.mjs';
const repo = resolve('.'), fixtures = join(repo, 'fixtures');
for (const [surface, entry] of [['CLI/API', 'dist/cli.js'], ['Action', 'qeg-report-action/dist/cli.mjs']]) {
  for (const [axis, verify] of manualGovernanceMatrix) test(`${surface}: R25-R28 ${axis} contract state matrix`, async () => {
    await verify(cliRunner(join(repo, entry), repo), fixtures, await mkdtemp(join(tmpdir(), 'qeg-manual-state-')), surface === 'CLI/API' ? api : undefined);
  });
}
test('Initialized runtime: R25-R28 contract state matrix', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qeg-manual-init-')), starter = join(directory, 'starter');
  const result = cliRunner(join(repo, 'dist/cli.js'), directory)(['init', '--root', starter]); assert.equal(result.status, 0, result.stderr + result.stdout);
  const run = cliRunner(join(starter, '.qeg/runtime/qeg-report-action/dist/cli.mjs'), directory);
  for (const [axis, verify] of manualGovernanceMatrix) await verify(run, fixtures, join(directory, axis));
});
