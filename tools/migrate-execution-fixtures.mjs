// Reviewed synthetic fixtures only. This is not a consumer migration command.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { addExecutions, persistExecutions } from '../tests/helpers/execution-fixture.mjs';
import { evaluateFixture } from '../dist/cli/fixture-io.js';
import { createRecordArtifacts } from '../dist/record.js';
import { validateOutput } from '../dist/index.js';
import { OUTPUT_SCHEMAS } from '../dist/validation/output.js';

for (const name of ['negative-placement-change-no-evidence', 'negative-placement-change-unreverted', 'positive-placement-change-retirement']) {
  const directory = resolve('fixtures', name);
  const input = JSON.parse(await readFile(join(directory, 'gate-input.json'), 'utf8'));
  const expected = JSON.parse(await readFile(join(directory, 'expected-gate-verdict.json'), 'utf8'));
  const replacement = input.graph.nodes.find(n => n.id === 'hate:AETE-login-001');
  assert.ok(replacement && input.placementPlan.placement_changes.length === 1, 'Reviewed fixture anchors changed');
  if (!input.policy.executionPolicy) {
    const runs = Array.from({ length: replacement.recentGreenRuns }, (_, index) => ({ status: 'pass',
      completedAt: new Date(Date.parse(input.metadata.createdAt) - (replacement.recentGreenRuns - index - 1) * 1000).toISOString() }));
    addExecutions(input, replacement, runs);
    await persistExecutions(input, directory);
  }
  const evaluated = await evaluateFixture(directory, { quiet: true });
  const gate = evaluated.gateResult;
  assert.equal(gate.verdict, expected.expectedVerdict, JSON.stringify(gate));
  assert.deepEqual([...new Set(gate.disqualifications.map(d => d.code))].sort(), [...new Set(expected.expectedDisqualifications.map(d => d.code))].sort());
  assert.deepEqual(gate.blockers.map(b => b.id).sort(), expected.expectedBlockers.map(b => typeof b === 'string' ? b : b.id).sort());
  assert.deepEqual(gate.residualRisks, expected.expectedResidualRisks);
  assert.deepEqual(gate.requiredHumanReview, expected.expectedHumanReview);
  const { files } = createRecordArtifacts(evaluated);
  for (const [path, content] of files) {
    const schema = OUTPUT_SCHEMAS[path];
    if (schema) assert.equal((await validateOutput(JSON.parse(content), schema)).valid, true, path);
  }
  for (const [path, content] of files) await writeFile(join(directory, path), content);
  console.log(`${name}: original verdict/DQ/blocker oracles preserved; ${gate.executionAccounting.selections[0].consecutivePasses} synthetic passes`);
}
