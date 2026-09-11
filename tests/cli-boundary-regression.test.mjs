import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { cliRunner, verifyPathSelection, verifyTargetDiscovery, verifyBaseline, verifyDiff, verifyDistribution } from './helpers/cli-boundary-matrix.mjs';
const repo = resolve('.'); const fixtures = join(repo, 'fixtures');
for (const [name, entry] of [['CLI', 'dist/cli.js'], ['Action bundle', 'qeg-report-action/dist/cli.mjs']]) {
  const run = cliRunner(join(repo, entry), repo);
  for (const [finding, verify] of [['R8 paths', verifyPathSelection], ['R9 discovery', verifyTargetDiscovery], ['R10/11 baseline', verifyBaseline], ['R12 diff', verifyDiff], ['R13 distribution', verifyDistribution]]) {
    test(`${name}: ${finding} boundary matrix`, async () => verify(run, fixtures, await mkdtemp(join(tmpdir(), 'qeg-cli-matrix-'))));
  }
}
test('R13: initialized runtime carries enum data and fails on actual packaged enum drift', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qeg-initialized-matrix-'));
  const starter = join(directory, 'starter'); const source = cliRunner(join(repo, 'dist/cli.js'), directory);
  const init = source(['init', '--root', starter]); assert.equal(init.status, 0, init.stderr + init.stdout);
  const runtime = join(starter, '.qeg/runtime'); const run = cliRunner(join(runtime, 'qeg-report-action/dist/cli.mjs'), directory);
  await verifyDistribution(run, fixtures, join(directory, 'checks'));
  const metadataPath = join(runtime, 'qeg-report-action/runtime-metadata.json');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const original = JSON.stringify(metadata); metadata.enums.GateProfile = [];
  await writeFile(metadataPath, JSON.stringify(metadata));
  assert.equal(run(['enum-check', '--json']).status, 2);
  const schemaPath = join(runtime, 'schemas/shared-defs.schema.json'); const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  schema.$defs.gateProfile.enum = []; await writeFile(schemaPath, JSON.stringify(schema));
  assert.equal(run(['enum-check', '--json']).status, 2, 'both empty must not pass');
  await writeFile(metadataPath, original); schema.$defs.gateProfile.enum = ['unknown-profile']; await writeFile(schemaPath, JSON.stringify(schema));
  assert.equal(run(['enum-check', '--json']).status, 2);
});
