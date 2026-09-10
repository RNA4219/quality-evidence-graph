import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import * as api from '../dist/index.js';
import { contentHash } from '../dist/record.js';

const source = resolve('docs/evidence/eac-completion-2026-09-10/producer-replay');
for (const runId of ['first', 'rerun']) test(`EAC-09 TC23: fixed replay of actual three-producer ${runId}`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qeg-live-replay-'));
  await cp(join(source, runId), directory, { recursive: true });
  const manifest = JSON.parse(await readFile(join(directory, 'ingest-manifest.json'), 'utf8'));
  const receipt = JSON.parse(await readFile(join(directory, 'acceptance.json'), 'utf8'));
  assert.equal(receipt.evidenceClass, 'live_producer_rerun');
  assert.equal(manifest.artifacts.length, 14);
  const loaded = [];
  for (const ref of manifest.artifacts) {
    const bytes = await readFile(join(directory, ref.path));
    assert.equal(contentHash(bytes), ref.contentHash);
    assert.equal(receipt.rawHashes.find(row => row.path === ref.path).contentHash, ref.contentHash);
    loaded.push({ ref, payload: api.parseProducerArtifact(ref, bytes.toString('utf8')) });
  }
  const graph = api.buildGraph(manifest, loaded);
  const input = { metadata: graph.metadata, graph, placementPlan: api.placeTests(graph, manifest.policy), policy: manifest.policy, waivers: [] };
  const evidenceVerification = await api.verifyEvidenceArtifacts(input, { baseDir: directory });
  assert.equal(evidenceVerification.status, 'pass');
  const gate = api.evaluateGate({ ...input, evidenceVerification });
  // The producer declares partial static evidence and an uncovered requirement hypothesis.
  // Acceptance means preserving this refusal, never converting producer CLI exit=0 to release go.
  assert.equal(gate.verdict, 'disqualified');
  assert.deepEqual([...new Set(gate.disqualifications.map(d => d.code))].sort(), ['DQ-01', 'DQ-04', 'DQ-05', 'DQ-11']);
  assert.ok(graph.completeness.parserFailures.every(failure => failure.reason === 'CTG completeness is partial'));
  assert.equal(gate.executionAccounting.selections[0].selectedRunId, `RUN-${runId}`);
  assert.equal(gate.executionAccounting.selections[0].selectedStatus, 'pass');
  assert.ok(graph.edges.some(edge => edge.kind === 'derives_from' && edge.to === 'rand:REQ-001'));
  const run = command => spawnSync(process.execPath, [resolve('dist/cli.js'), command, directory], { encoding: 'utf8' });
  for (const command of ['build-graph', 'place-tests', 'record']) {
    const result = run(command); assert.equal(result.status, 2, `${command}: ${result.stderr}`);
  }
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'gate-verdict.json'), 'utf8')), gate);
  assert.equal(run('schema-check').status, 0);
  const output = await api.readPublishedOutputs(directory);
  assert.equal(output.files.size, 7);
  await writeFile(join(directory, manifest.artifacts[0].path), '{}');
  assert.equal((await api.verifyEvidenceArtifacts(input, { baseDir: directory })).status, 'fail');
});

test('EAC-09: both live runs share build/revision and preserve fresh producer observations', async () => {
  const [first, rerun] = await Promise.all(['first', 'rerun'].map(async name => ({
    receipt: JSON.parse(await readFile(join(source, name, 'acceptance.json'), 'utf8')),
    raw: JSON.parse(await readFile(join(source, name, 'raw/manual-bb-test-harness-execution_evidence.json'), 'utf8')),
  })));
  assert.deepEqual(first.receipt.target, rerun.receipt.target);
  assert.deepEqual(first.receipt.producerLock, rerun.receipt.producerLock);
  assert.notEqual(first.raw.run_id, rerun.raw.run_id);
  assert.notEqual(first.raw.timestamp, rerun.raw.timestamp);
  assert.equal(first.raw.actual[0], 'exit=0; stdout=42');
  assert.equal(rerun.raw.actual[0], 'exit=0; stdout=42');
});
