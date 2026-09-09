import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { evaluateGate, validateGateInput, validateOutput, upstreamInputContract, UPSTREAM_REQUIRED_ARTIFACTS } from '../dist/index.js';

const cli = resolve('dist/cli.js');
const positive = resolve('fixtures/positive-release-go');
const sourceRefs = [{ id: 'qeg:review-source', path: 'spec.md', label: '境界ケースの入力位置' }];
const traceability = { sourceRefs, assumptions: [], confidence: 'high' };
const command = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
async function nativeInput() {
  const input = JSON.parse(await readFile(join(positive, 'gate-input.json'), 'utf8'));
  input.policy.inputContract = { mode: 'native_graph', requiredArtifacts: [{ adapter: 'qeg-native', kind: 'test_model' }],
    evaluationScope: { kind: 'fixture', target: 'remediation-gate', notEvaluated: ['実環境', 'release approval'] },
    requireExecutedTests: false, sourceRefs };
  input.metadata.requiredConnectorStatus = { 'qeg-native': 'success' };
  return input;
}
function change(id) { return { id, kind: 'changed_code', title: id, path: `${id}.ts`, symbols: [], hunks: [], blastRadius: 1, sourceArtifactIds: [], traceability }; }
function obligation(id, changes, risks = []) { return { id, changedCodeIds: changes, riskIds: risks, requirementIds: [], failureModeIds: [], priority: 'P1', riskPriorityIndex: 0.8, gateRelevance: 'blocking', traceability }; }
function placement(id, obligationId) { return { id, kind: 'test_placement', title: id, obligationId, primaryLayer: 'unit', disposition: 'add', gateRelevance: 'blocking', candidateScores: [], selectedTestIds: [], sourceArtifactIds: [], traceability }; }

test('FIX-01/02: explicit native input passes; missing mode, set, graph or status never does', async () => {
  const base = await nativeInput();
  assert.equal(evaluateGate(base).verdict, 'go');
  for (const mutate of [i => delete i.policy.inputContract, i => i.metadata.inputArtifacts = [], i => i.graph.nodes = [], i => delete i.metadata.requiredConnectorStatus]) {
    const input = structuredClone(base); mutate(input);
    const result = evaluateGate(input);
    assert.equal(result.verdict, 'disqualified');
    assert.ok(result.disqualifications.some(d => d.code === 'DQ-01'));
  }
});

test('FIX-01: each required upstream kind is independently checked, statuses do not replace artifacts', async () => {
  const input = await nativeInput();
  input.policy.inputContract = upstreamInputContract('producer-contract');
  input.metadata.inputArtifacts = UPSTREAM_REQUIRED_ARTIFACTS.map((a, index) => ({ ...a, id: `qeg:input-${index}`, path: `raw/${index}.json` }));
  input.metadata.requiredConnectorStatus = { RanD: 'success', 'code-to-gate': 'success', 'manual-bb-test-harness': 'success' };
  assert.equal(evaluateGate(input).disqualifications.some(d => d.code === 'DQ-01'), false);
  for (const missing of UPSTREAM_REQUIRED_ARTIFACTS) {
    const changed = structuredClone(input);
    changed.metadata.inputArtifacts = changed.metadata.inputArtifacts.filter(a => a.adapter !== missing.adapter || a.kind !== missing.kind);
    assert.ok(evaluateGate(changed).disqualifications.some(d => d.code === 'DQ-01' && d.message.includes(`${missing.adapter}/${missing.kind}`)));
  }
});

test('FIX-05/06: unrelated or dangling placement cannot cover a change', async () => {
  const input = await nativeInput();
  input.graph.nodes.push(change('qeg:change-a'), change('qeg:change-b'));
  input.placementPlan.obligations = [obligation('qeg:obligation-a', ['qeg:change-a'])];
  input.placementPlan.placements = [placement('qeg:placement-a', 'qeg:obligation-a')];
  const first = evaluateGate(input);
  assert.deepEqual(first.disqualifications.filter(d => d.code === 'DQ-05').flatMap(d => d.nodeIds), ['qeg:change-b']);
  input.placementPlan.placements.push(placement('qeg:unrelated', 'qeg:missing-obligation'));
  const second = evaluateGate(input);
  assert.ok(second.disqualifications.some(d => d.code === 'DQ-05' && d.nodeIds.includes('qeg:change-b')));
  assert.ok(second.disqualifications.some(d => d.code === 'DQ-03'));
  input.placementPlan.placements.pop();
  input.placementPlan.obligations.push(obligation('qeg:obligation-b', ['qeg:change-b']));
  input.placementPlan.placements.push(placement('qeg:placement-b', 'qeg:obligation-b'));
  assert.equal(evaluateGate(input).verdict, 'go');
  input.graph.nodes.push(change('qeg:change-b'));
  assert.ok(evaluateGate(input).disqualifications.some(d => d.code === 'DQ-03' && /Duplicate/.test(d.message)));
  input.graph.nodes.pop();
  input.graph.nodes.push(placement('qeg:graph-only-placement', 'qeg:missing-obligation'));
  assert.ok(evaluateGate(input).disqualifications.some(d => d.code === 'DQ-03' && /Unresolved obligation/.test(d.message)));
});

test('FIX-07: invalid, expired and unrelated waivers do not cover changes', async () => {
  const input = await nativeInput();
  input.graph.nodes.push(change('qeg:change'), { id: 'qeg:risk', kind: 'risk', title: 'risk', priority: 'P2', severity: 'low', likelihood: 0.1,
    businessImpact: 0.1, complianceCriticality: 0, evidenceGap: 0, novelty: 0, sourceArtifactIds: [], traceability });
  input.placementPlan.obligations = [obligation('qeg:obligation', ['qeg:change'], ['qeg:risk'])];
  const waiver = { id: 'qeg:waiver', linkedRiskIds: ['qeg:risk'], approver: 'reviewer', approvalAuthority: 'owner', reason: 'controlled exception',
    expiry: '2030-01-01T00:00:00Z', impactScope: 'fixture', rollbackOrContainment: 'revert', followUpOwner: 'owner', recheckCondition: 'next change', sourceRefs, valid: true };
  input.waivers = [waiver];
  assert.equal(evaluateGate(input).disqualifications.some(d => d.code === 'DQ-05'), false);
  for (const patch of [{ expiry: '2000-01-01T00:00:00Z' }, { expiry: 'invalid' }, { linkedRiskIds: [] }, { sourceRefs: [] }]) {
    input.waivers = [{ ...waiver, ...patch }];
    assert.ok(evaluateGate(input).disqualifications.some(d => d.code === 'DQ-05'));
  }
});

test('FIX-07: planned, mock and failed executions remain distinguishable', async () => {
  const input = await nativeInput();
  input.policy.inputContract.requireExecutedTests = true;
  input.graph.nodes.push(change('qeg:change'));
  input.placementPlan.obligations = [obligation('qeg:obligation', ['qeg:change'])];
  input.placementPlan.placements = [placement('qeg:placement', 'qeg:obligation')];
  assert.ok(evaluateGate(input).disqualifications.some(d => d.code === 'DQ-05'));
  input.placementPlan.placements[0].selectedTestIds = ['qeg:test'];
  const selected = { id: 'qeg:test', kind: 'test', title: 'test', layer: 'unit', existing: true, testExecutionMode: 'mock', sourceArtifactIds: [], traceability };
  const evidence = { id: 'qeg:execution', kind: 'execution_evidence', title: 'execution', passed: true,
    evidenceRefs: [{ id: 'qeg:result', path: 'result.json', evidenceKind: 'test_result' }], sourceArtifactIds: [], traceability };
  input.graph.nodes.push(selected, evidence);
  input.graph.edges.push({ id: 'qeg:edge', kind: 'evidenced_by', from: selected.id, to: evidence.id, traceability });
  assert.equal(evaluateGate(input).verdict, 'disqualified');
  selected.testExecutionMode = 'real';
  assert.equal(evaluateGate(input).verdict, 'go');
  evidence.passed = false;
  assert.equal(evaluateGate(input).verdict, 'no_go');
});

test('FIX-08/09/10/14: negative record is schema valid, all outputs are hashed, tampering is detected', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qeg-remediation-output-'));
  await cp(positive, dir, { recursive: true });
  const input = await nativeInput();
  input.metadata.headRef = 'unexpected-revision';
  await writeFile(join(dir, 'gate-input.json'), JSON.stringify(input));
  const result = command(['record', dir]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /all generated JSON artifacts passed their schemas/);
  const record = JSON.parse(await readFile(join(dir, 'quality-evidence-record.json'), 'utf8'));
  assert.equal((await validateOutput(record, 'quality-evidence-record.schema.json')).valid, true);
  assert.ok(record.gate.disqualifications.every(d => d.sourceRefs.length > 0));
  assert.equal(record.gate.evaluationScope.kind, 'fixture');
  const manifest = JSON.parse(await readFile(join(dir, 'output-manifest.json'), 'utf8'));
  for (const file of manifest.files) assert.equal(file.contentHash, 'sha256:' + createHash('sha256').update(await readFile(join(dir, file.path))).digest('hex'));
  assert.equal(await readFile(join(dir, 'output-record.json'), 'utf8'), await readFile(join(dir, 'quality-evidence-record.json'), 'utf8'));
  record.gate.disqualifications[0].sourceRefs = [];
  await writeFile(join(dir, 'output-record.json'), JSON.stringify(record));
  assert.equal(command(['schema-check', dir]).status, 2);
});

test('FIX-02: init exposes a configuration requiring evidence rather than a passing demo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'qeg-remediation-init-'));
  assert.equal(command(['init', '--root', root]).status, 0);
  const result = command(['gate', join(root, '.qeg')]);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).verdict, 'disqualified');
  const input = JSON.parse(await readFile(join(root, '.qeg/gate-input.json'), 'utf8'));
  assert.equal((await validateGateInput(input)).valid, true);
});
