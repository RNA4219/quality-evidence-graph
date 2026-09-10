import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as api from '../dist/index.js';

test('EAC-09: YAML is restricted to CTG risk data, rejects aliases and duplicate keys', () => {
  const ref = { adapter: 'code-to-gate', kind: 'risk_register', path: 'risk-register.yaml' };
  assert.deepEqual(api.parseProducerArtifact(ref, 'version: ctg/v1\nrisks: []\n'), { version: 'ctg/v1', risks: [] });
  assert.throws(() => api.parseProducerArtifact(ref, 'version: one\nversion: two\n'));
  assert.throws(() => api.parseProducerArtifact(ref, 'a: &a [1]\nb: *a\n'));
  assert.throws(() => api.parseProducerArtifact({ ...ref, adapter: 'RanD' }, 'risks: []\n'));
});

test('EAC-04/09: explicit producer source mapping resolves real IDs and rejects unresolved mappings', async () => {
  const { manifest, loaded } = await fixture();
  const feature = loaded.find(item => item.ref.kind === 'feature_spec');
  feature.payload.source_refs[0].id = 'MD-spec';
  feature.ref.sourceRefMappings = [{ sourceId: 'MD-spec', requirementId: 'rand:REQ-001' }];
  let graph = api.buildGraph(manifest, loaded);
  assert.ok(graph.edges.some(edge => edge.kind === 'derives_from' && edge.to === 'rand:REQ-001'));
  feature.ref.sourceRefMappings[0].requirementId = 'rand:missing';
  graph = api.buildGraph(manifest, loaded);
  assert.equal(graph.completeness.partial, true);
  assert.ok(graph.completeness.parserFailures.some(failure => /sourceRefMapping/.test(failure.reason)));
});

test('EAC-01/09: abbreviated producer revision needs explicit resolution and mismatching revisions fail', async () => {
  const { manifest, loaded } = await fixture();
  const artifact = loaded.find(item => item.ref.kind === 'normalized_repo_graph');
  artifact.payload.repo.revision = manifest.metadata.headRef.slice(0, 12);
  assert.ok(api.buildGraph(manifest, loaded).completeness.parserFailures.some(failure => failure.code === 'DQ-12'));
  artifact.ref.reportedRevision = artifact.payload.repo.revision;
  assert.equal(api.buildGraph(manifest, loaded).completeness.partial, false);
  artifact.payload.repo.revision = 'f'.repeat(12);
  assert.ok(api.buildGraph(manifest, loaded).completeness.parserFailures.some(failure => failure.code === 'DQ-12'));
});
import { createRawProducerFixture, rawHash, manualTestId, persistRawFixture } from './helpers/raw-producer-fixture.mjs';

const cli = resolve('dist/cli.js');
const run = (dir, cmd, expected) => { const result = spawnSync(process.execPath, [cli, cmd, dir], { encoding: 'utf8' }); assert.equal(result.status, expected, `${cmd}: ${result.stdout}\n${result.stderr}`); return result; };
const fixture = async () => { const dir = await mkdtemp(join(tmpdir(), 'qeg-raw-')); return { dir, ...await createRawProducerFixture(dir, api) }; };
const inputOf = (manifest, graph) => ({ metadata: graph.metadata, graph, policy: manifest.policy, waivers: [], placementPlan: api.placeTests(graph, manifest.policy) });
const verifiedGate = async (input, dir) => api.evaluateGate({ ...input, evidenceVerification: await api.verifyEvidenceArtifacts(input, { baseDir: dir }) });

test('FIX-11/12/13: raw producers -> pure graph -> deterministic seven-layer placement', async () => {
  const { manifest, loaded, dir } = await fixture();
  const before = JSON.stringify({ manifest, loaded });
  const graph = api.buildGraph(manifest, loaded);
  assert.equal(graph.completeness.partial, false, JSON.stringify(graph.completeness));
  assert.equal((await api.validateOutput(graph, 'qeg.bundle.schema.json')).valid, true);
  assert.deepEqual(api.buildGraph({ ...manifest, artifacts: [...manifest.artifacts].reverse() }, [...loaded].reverse()), graph);
  assert.equal(JSON.stringify({ manifest, loaded }), before);
  const input = inputOf(manifest, graph);
  assert.equal((await api.validateGateInput(input)).valid, true);
  assert.ok(input.placementPlan.placements.every(p => p.candidateScores.length === 7));
  assert.ok(input.placementPlan.placements.every(p => p.selectedTestIds.includes(manualTestId)));
  const gate = await verifiedGate(input, dir);
  assert.equal(gate.verdict, 'go', JSON.stringify(gate));
  assert.equal(graph.nodes.filter(n => n.id === 'rand:REQ-001').length, 1);
  assert.equal(graph.nodes.find(n => n.id === 'rand:REQ-001').sourceArtifactIds.length, 2);
  assert.ok(graph.nodes.find(n => n.id === manualTestId).coveredRequirementIds.includes('rand:REQ-001'));
  assert.equal(graph.nodes.find(n => n.kind === 'changed_code').blastRadius, 1);
});

test('FIX-13: reuse, adapt, add and missing oracle produce distinct actionable plans', async () => {
  const { manifest, loaded } = await fixture();
  const graph = api.buildGraph(manifest, loaded);
  const selected = graph.nodes.find(n => n.id === manualTestId);
  selected.layer = 'unit'; selected.existing = true;
  assert.ok(api.placeTests(graph).placements.every(p => p.disposition === 'reuse'));
  const extra = { ...structuredClone(selected), id: 'qeg:test-addition', existing: false };
  graph.nodes.push(extra);
  assert.ok(api.placeTests(graph).placements.every(p => p.disposition === 'adapt'));
  selected.existing = false;
  assert.ok(api.placeTests(graph).placements.every(p => p.disposition === 'add'));
  selected.oracleType = 'missing'; extra.oracleType = 'missing';
  assert.ok(api.placeTests(graph).placements.every(p => p.disposition === 'blocked' && p.primaryLayer === 'spec-clarification'));
});

test('FIX-03: a valid descriptor does not hide stale revisions inside producer payloads', async () => {
  const { manifest, loaded } = await fixture();
  loaded.find(l => l.ref.kind === 'diff_analysis').payload.repo.head_ref = 'c'.repeat(40);
  const graph = api.buildGraph(manifest, loaded);
  assert.equal(graph.completeness.partial, true);
  assert.ok(api.evaluateGate(inputOf(manifest, graph)).disqualifications.some(d => d.code === 'DQ-12'));
});

test('FIX-11/14: CLI raw -> graph -> placement -> gate -> validated complete record', async () => {
  const { dir } = await fixture();
  run(dir, 'build-graph', 0); run(dir, 'gate', 2); run(dir, 'place-tests', 0); run(dir, 'gate', 0); run(dir, 'record', 0); run(dir, 'schema-check', 0);
  const record = JSON.parse(await readFile(join(dir, 'quality-evidence-record.json'), 'utf8'));
  assert.equal(record.gate.evaluationScope.kind, 'fixture');
  const outputManifest = JSON.parse(await readFile(join(dir, 'output-manifest.json'), 'utf8'));
  for (const file of outputManifest.files) assert.equal(rawHash(await readFile(join(dir, file.path))), file.contentHash);
});

test('FIX-11: missing kind, malformed raw, unknown version and unresolved IDs retain partial graph', async () => {
  const { manifest, loaded } = await fixture();
  for (const mutate of [
    (m, l) => { m.artifacts.pop(); l.pop(); },
    (m, l) => { l[2].payload.stats = null; },
    (m, l) => { l[2].payload.unrecognized = true; },
    (m, l) => { m.artifacts[0].contractVersion = 'rand-kano/99'; l[0].ref.contractVersion = 'rand-kano/99'; },
    (m, l) => { l[5].payload.risks[0].sourceFindingIds = ['ctg:missing']; },
  ]) {
    const copy = structuredClone({ manifest, loaded }); mutate(copy.manifest, copy.loaded);
    const graph = api.buildGraph(copy.manifest, copy.loaded);
    assert.equal(graph.completeness.partial, true);
    assert.ok(graph.nodes.length > 0);
    const gate = api.evaluateGate(inputOf(copy.manifest, graph));
    assert.equal(gate.verdict, 'disqualified');
    assert.ok(gate.disqualifications.some(d => ['DQ-01', 'DQ-03'].includes(d.code)));
    assert.ok(gate.disqualifications.every(d => d.sourceRefs.length));
  }
});

test('FIX-07/11: raw execution fail, skipped, mock and evidence tampering cannot become go', async () => {
  const { manifest, loaded, dir } = await fixture();
  const failed = structuredClone(loaded); failed[12].payload.result = 'fail';
  await persistRawFixture(dir, manifest, failed);
  let graph = api.buildGraph(manifest, failed);
  assert.equal((await verifiedGate(inputOf(manifest, graph), dir)).verdict, 'no_go');
  const skipped = structuredClone(loaded); skipped[12].payload.result = 'skip';
  graph = api.buildGraph(manifest, skipped);
  assert.equal(api.evaluateGate(inputOf(manifest, graph)).verdict, 'disqualified');
  graph = api.buildGraph(manifest, loaded);
  graph.nodes.find(n => n.id === manualTestId).testExecutionMode = 'mock';
  assert.equal(api.evaluateGate(inputOf(manifest, graph)).verdict, 'disqualified');
  await writeFile(join(dir, loaded[12].ref.path), '{}');
  run(dir, 'build-graph', 2); run(dir, 'place-tests', 2); run(dir, 'record', 2);
  const gate = JSON.parse(await readFile(join(dir, 'gate-verdict.json'), 'utf8'));
  assert.ok(gate.disqualifications.some(d => d.code === 'DQ-06'));
});
