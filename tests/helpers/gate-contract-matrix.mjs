import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, symlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { boundaryConsumer } from './cli-boundary-matrix.mjs';
import { addExecutions, persistExecutions, sourceRefs, traceability, json } from './execution-fixture.mjs';

const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const risk = (id, gap = 0) => ({ id, kind: 'risk', title: id, sourceArtifactIds: [], traceability, priority: 'P1', severity: gap === 0 ? 'high' : 'medium', likelihood: 0.1, businessImpact: 0.1, complianceCriticality: 0, evidenceGap: gap, novelty: 0 });
const change = id => ({ id, kind: 'changed_code', title: id, path: `src/${id}.ts`, symbols: [], hunks: [], blastRadius: 1, sourceArtifactIds: [], traceability });
const testNode = (id, layer = 'unit') => ({ id, kind: 'test', title: id, sourceArtifactIds: [], traceability, layer, existing: true, testExecutionMode: 'real' });
const obligation = (id, riskIds = [], changedCodeIds = []) => ({ id, changedCodeIds, riskIds, requirementIds: [], failureModeIds: [], priority: 'P1', riskPriorityIndex: 0.5, gateRelevance: 'blocking', traceability });
const placement = (id, obligationId, test) => ({ id, kind: 'test_placement', title: id, obligationId, primaryLayer: test.layer, disposition: test.layer.startsWith('manual-') ? 'manual-only' : 'reuse', gateRelevance: 'blocking', candidateScores: [], selectedTestIds: [test.id], sourceArtifactIds: [], traceability });
const specified = test => Object.assign(test, { oracleType: 'specified', oracleRefs: sourceRefs, expectedResults: ['The specified result occurs'] });
const exit = (r, code) => { assert.equal(r.status, code, r.stderr + '\n' + r.stdout.slice(0, 6000)); return r; };
async function save(directory, input) { await writeFile(join(directory, 'gate-input.json'), json(input)); }
async function gate(run, directory, input, expected, api) {
  await save(directory, input);
  const result = exit(run(['report', '--json', directory]), expected.exit ?? (expected.verdict === 'go' ? 0 : 2)).data.targets[0];
  assert.equal(result.verdict, expected.verdict);
  if (expected.dq) assert.ok(result.disqualifications.some(d => d.code === expected.dq), json(result));
  if (expected.human) assert.deepEqual(result.requiredHumanReview, expected.human);
  if (api) {
    const schema = await api.validateGateInput(input); assert.equal(schema.valid, expected.schemaValid ?? true, json(schema.issues));
    const evidenceVerification = await api.verifyEvidenceArtifacts(input, { baseDir: directory });
    const evaluated = api.evaluateGate({ ...input, evidenceVerification });
    assert.equal(evaluated.verdict, expected.apiVerdict ?? expected.verdict, json(evaluated));
    if (expected.human) assert.deepEqual(evaluated.requiredHumanReview, expected.human);
    if (expected.apiDq) assert.ok(evaluated.disqualifications.some(d => d.code === expected.apiDq));
  }
  return result;
}
function execution(input, test) {
  const previousEdges = input.graph.edges.length;
  const nodes = addExecutions(input, test);
  for (const node of nodes) {
    const oldId = node.id; node.id += ':' + test.id;
    node.execution.rawArtifactRef.id += ':' + test.id;
    node.execution.rawArtifactRef.path = `execution/${encodeURIComponent(test.id)}.json`;
    node.execution.runId += '-' + encodeURIComponent(test.id);
    for (const edge of input.graph.edges.slice(previousEdges)) { edge.id += ':' + test.id; if (edge.to === oldId) edge.to = node.id; }
  }
}

export async function verifyPlacementContract(run, fixtures, directory, api) {
  const input = await boundaryConsumer(fixtures, directory); input.policy.inputContract.requireExecutedTests = true;
  const a = risk('qeg:risk-A'), b = risk('qeg:risk-B'), changed = change('qeg:change-A');
  const test = specified({ ...testNode('qeg:test-B'), coveredRiskIds: [b.id], coveredChangedCodeIds: [] });
  input.graph.nodes.push(a, b, changed, test);
  input.graph.edges.push({ id: 'qeg:change-risk', kind: 'touches', from: changed.id, to: a.id, traceability });
  input.placementPlan.obligations = [obligation('qeg:obligation-A', [a.id], [changed.id]), obligation('qeg:obligation-B', [b.id])];
  input.placementPlan.placements = input.placementPlan.obligations.map(o => placement('qeg:placement-' + o.id.slice(-1), o.id, test));
  execution(input, test); await persistExecutions(input, directory);
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-05' }, api);
  if (api) {
    const generated = { ...input, placementPlan: api.placeTests(input.graph, input.policy) };
    await gate(run, directory, generated, { verdict: 'disqualified', dq: 'DQ-05' }, api);
  }
  test.coveredRiskIds = [a.id, b.id];
  await gate(run, directory, input, { verdict: 'go' }, api); // Risk-derived changed code does not require a redundant direct declaration.
  test.coveredRiskIds = [];
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-05' }, api);
  delete test.coveredRiskIds; delete test.coveredChangedCodeIds;
  await gate(run, directory, input, { verdict: 'go' }, api); // Legacy native declarations remain optional.
  test.coveredRiskIds = [b.id];
  const other = specified({ ...testNode('qeg:test-A'), coveredRiskIds: [a.id] });
  input.graph.nodes.push(other); execution(input, other); await persistExecutions(input, directory);
  input.placementPlan.obligations = [obligation('qeg:combined', [a.id, b.id], [changed.id])];
  input.placementPlan.placements = [{ ...placement('qeg:combined-placement', 'qeg:combined', test), selectedTestIds: [test.id, other.id] }];
  await gate(run, directory, input, { verdict: 'go' }, api); // Union of genuinely related tests.
  delete other.coveredRiskIds;
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-05' }, api); // Legacy entries cannot hide incomplete explicit coverage.
  input.graph.nodes = input.graph.nodes.filter(n => ![a.id, b.id].includes(n.id)); input.graph.edges = input.graph.edges.filter(e => e.id !== 'qeg:change-risk');
  delete test.coveredRiskIds;
  input.placementPlan.obligations[0].riskIds = []; input.placementPlan.placements[0].selectedTestIds = [test.id];
  test.coveredChangedCodeIds = [];
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-05' }, api);
  test.coveredChangedCodeIds = [changed.id];
  await gate(run, directory, input, { verdict: 'go' }, api);
}

export async function verifyManualContract(run, fixtures, directory, api) {
  const input = await boundaryConsumer(fixtures, directory); input.policy.inputContract.requireExecutedTests = true;
  const test = testNode('qeg:manual-test', 'manual-scripted'); input.graph.nodes.push(test);
  const planned = placement('qeg:manual-placement', 'qeg:manual-obligation', test);
  input.placementPlan.obligations = [obligation(planned.obligationId)]; input.placementPlan.placements = [planned];
  execution(input, test); await persistExecutions(input, directory);
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-14' }, api);
  input.graph.nodes.push(Object.fromEntries(Object.entries(structuredClone(planned)).reverse()));
  const duplicated = await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-14' }, api);
  assert.equal(duplicated.disqualifications.filter(d => d.code === 'DQ-14').length, 1, 'Equivalent object key order must not duplicate a DQ');
  specified(test);
  for (const type of ['specified', 'derived', 'human', 'implicit', 'missing']) {
    test.oracleType = type;
    const expected = type === 'human' ? { verdict: 'conditional_go', human: [test.id] }
      : ['implicit', 'missing'].includes(type) ? { verdict: 'disqualified', dq: 'DQ-14' } : { verdict: 'go', human: [] };
    await gate(run, directory, input, expected, api);
    if (api) {
      const r = risk('qeg:oracle-risk'); const graph = structuredClone(input.graph);
      graph.nodes.push(r); graph.nodes.find(n => n.id === test.id).coveredRiskIds = [r.id];
      const generated = api.placeTests(graph, input.policy);
      assert.equal(generated.placements[0].disposition === 'blocked', ['implicit', 'missing'].includes(type));
    }
  }
  test.oracleType = 'human';
  input.graph.nodes = input.graph.nodes.filter(n => n.kind !== 'test_placement');
  await gate(run, directory, input, { verdict: 'conditional_go', human: [test.id] }, api);
  specified(test);
  input.graph.nodes.push({ ...structuredClone(planned), primaryLayer: 'unit' });
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-03' }, api); // Union must not erase disagreements.
}

export async function verifyWaiverContract(run, fixtures, directory, api) {
  const input = await boundaryConsumer(fixtures, directory); const r = risk('qeg:waived-risk', 1); input.graph.nodes.push(r);
  const waiver = { id: 'qeg:waiver', linkedRiskIds: [r.id], approver: 'reviewer', approvalAuthority: 'quality-owner', reason: 'Synthetic exception', expiry: '2030-01-01T00:00:00Z', impactScope: 'fixture', rollbackOrContainment: 'Revert', followUpOwner: 'quality-owner', recheckCondition: 'Next change', sourceRefs };
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-04' }, api);
  input.waivers = [waiver];
  await gate(run, directory, input, { verdict: 'conditional_go', human: [waiver.id, r.id] }, api);
  for (const approver of [' ', '\t\n', '\u3000']) {
    waiver.approver = approver;
    await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-01', schemaValid: false, apiDq: 'DQ-04' }, api);
  }
  waiver.approver = ' 品質担当 ';
  await gate(run, directory, input, { verdict: 'conditional_go', human: [waiver.id, r.id] }, api);
}

export async function verifyStatusContract(run, _fixtures, directory) {
  await mkdir(directory, { recursive: true });
  const revision = 'a'.repeat(40), startedAt = '2026-01-01T00:00:00.000Z', endedAt = '2026-01-01T00:01:00.000Z';
  const signal = 'signal\n'; await writeFile(join(directory, 'signal.json'), signal);
  const context = { node: { id: 'qeg:normalized', title: 'Synthetic evidence', traceability, sourceArtifactIds: ['qeg:synthetic-source'] }, testId: 'qeg:normalize-test', environment: 'ci', environmentId: 'synthetic-ci', adapterVersion: 'v1', targetRevision: revision,
    lifecycle: { startedAt, endedAt, status: 'pass', steadyStateConfirmed: true, recovered: true, recoveryDurationMs: 1000 },
    observed: { requestCount: 1, errorRate: 0, latencyP95Ms: 1, saturationPct: 1, duplicateSideEffects: 0, dataInconsistencies: 0 },
    evidenceRefs: [{ id: 'qeg:signal', path: 'signal.json', contentHash: hash(signal), evidenceKind: 'observability_metric', capturedAt: endedAt, revision }], signalManifest: { metrics: [], traces: [], logs: [] } };
  for (const adapter of ['shell', 'ci', 'lakda', 'toxiproxy']) {
    const rawBase = { schema: adapter === 'shell' ? 'qeg-resilience-shell-v1' : adapter === 'ci' ? 'qeg-resilience-ci-v1' : 'HATE/v1', runId: 'synthetic-run', attempt: 1, commit: revision, startedAt, endedAt };
    const cases = [
      ['pass', { status: 'PASSED' }, 0], ['absent', {}, 0], ['unknown', { status: 'unknown' }, 1],
      ['object', { status: { state: 'failed' } }, 1], ['null', { status: null }, 1],
      ['failure-conflict', { status: 'fail' }, 1], ['lifecycle-invalid', { status: 'pass', lifecycle: { status: 'unknown' } }, 1],
      ['lifecycle-conflict', { status: 'pass', lifecycle: { status: 'fail' } }, 1],
      ['lifecycle-type', { status: 'pass', lifecycle: 'failed' }, 1],
    ];
    if (adapter === 'shell') cases.push(['exit-conflict', { status: 'pass', exitCode: 1 }, 1], ['exit-invalid', { exitCode: '0' }, 1], ['exit-pass', { exitCode: 0 }, 0]);
    else {
      const alias = adapter === 'ci' ? 'conclusion' : 'passed';
      cases.push(['alias-conflict', { status: 'pass', [alias]: false }, 1], ['alias-invalid', { status: 'pass', [alias]: {} }, 1], ['alias-pass', { status: true, [alias]: 'success' }, 0]);
    }
    for (const [label, fields, code] of cases) {
      await writeFile(join(directory, 'raw.json'), json({ ...rawBase, ...fields })); await writeFile(join(directory, 'context.json'), json(context));
      const output = `${adapter}-${label}.json`;
      const result = exit(run(['evidence', 'normalize', '--adapter', adapter, '--input', 'raw.json', '--context', 'context.json', '--out', output, '--base-dir', directory]), code);
      if (code === 0) { assert.equal(result.data.status, 'pass'); assert.equal(result.data.passed, true); }
      else { await assert.rejects(stat(join(directory, output)), { code: 'ENOENT' }); assert.ok(!result.stderr.includes('state')); }
    }
  }
  // A real failure without a contradictory context is retained, never upgraded to pass.
  delete context.lifecycle.status;
  await writeFile(join(directory, 'context.json'), json(context));
  await writeFile(join(directory, 'raw.json'), json({ schema: 'qeg-resilience-shell-v1', runId: 'failure', attempt: 1, status: 'failed', exitCode: 1 }));
  const failure = exit(run(['evidence', 'normalize', '--adapter', 'shell', '--input', 'raw.json', '--context', 'context.json', '--out', 'failure.json', '--base-dir', directory]), 0);
  assert.equal(failure.data.status, 'fail'); assert.equal(failure.data.passed, false);
}

export async function verifySnapshotContract(run, fixtures, directory) {
  const target = join(directory, 'consumer'); const foreign = join(directory, 'foreign');
  const input = await boundaryConsumer(fixtures, target); await mkdir(foreign);
  const path = join(target, 'expected-report.json');
  // An independently constructed pre-fix snapshot, not a --update result, verifies legacy compatibility.
  const report = exit(run(['report', '--json', target]), 0).data;
  function oldValue(value) {
    if (typeof value === 'string') return value.replaceAll('\\', '/').replaceAll(directory.replaceAll('\\', '/'), '<repo>');
    if (Array.isArray(value)) return value.map(oldValue);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'generatedAt' ? '<snapshot>' : oldValue(v)]));
    return value;
  }
  await writeFile(path, json(oldValue(report))); const original = await readFile(path, 'utf8');
  for (const cwd of [directory, target, foreign]) {
    exit(run(['snapshot', target], { cwd }), 0); exit(run(['check', '--json', target], { cwd }), 0);
  }
  assert.equal(await readFile(path, 'utf8'), original);
  input.policy.inputContract.evaluationScope.notEvaluated.push('Changed scope'); await save(target, input);
  exit(run(['snapshot', target], { cwd: foreign }), 2);
  input.policy.inputContract.evaluationScope.notEvaluated.pop(); await save(target, input);
  const alias = join(directory, 'alias'); await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
  exit(run(['snapshot', alias], { cwd: foreign }), 0);
  exit(run(['snapshot', '--update', target], { cwd: directory }), 0);
  const current = JSON.parse(await readFile(path, 'utf8')); assert.equal(current.snapshotVersion, 'qeg-report-snapshot-v1');
  assert.equal(current.report.targets[0].target, '<target>');
  for (const cwd of [directory, target, foreign]) exit(run(['snapshot', target], { cwd }), 0);
  exit(run(['snapshot', alias], { cwd: foreign }), 0);
  // Only volatile fields may be normalized. Changed evidence must still fail.
  input.policy.inputContract.evaluationScope.notEvaluated.push('Literal C:\\checks\\oracle remains text');
  await save(target, input); exit(run(['snapshot', target], { cwd: foreign }), 2); exit(run(['check', '--json', target], { cwd: target }), 1);
  exit(run(['snapshot', '--update', target]), 0);
  const updated = JSON.parse(await readFile(path, 'utf8'));
  assert.ok(updated.report.targets[0].evaluationScope.notEvaluated.includes('Literal C:\\checks\\oracle remains text'));
  input.policy.inputContract.evaluationScope.notEvaluated.pop(); await save(target, input); exit(run(['snapshot', target]), 2);
  updated.snapshotVersion = 'unknown-version'; await writeFile(path, json(updated)); exit(run(['snapshot', target]), 2);
  await writeFile(path, '{'); exit(run(['snapshot', target]), 2);
}

export const gateContractMatrix = [['R14 coverage', verifyPlacementContract], ['R15/R16 manual', verifyManualContract], ['R17 status', verifyStatusContract], ['R18 waiver', verifyWaiverContract], ['R19 snapshot', verifySnapshotContract]];
