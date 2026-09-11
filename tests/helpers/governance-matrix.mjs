import assert from 'node:assert/strict';
import { cp, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { boundaryConsumer } from './cli-boundary-matrix.mjs';
import { addExecutions, persistExecutions, sourceRefs, traceability, json } from './execution-fixture.mjs';

async function original(fixtures, directory, name = 'positive-release-go') {
  await cp(join(fixtures, name), directory, { recursive: true });
  await unlink(join(directory, 'expected-gate-verdict.json'));
  return JSON.parse(await readFile(join(directory, 'gate-input.json'), 'utf8'));
}
async function gate(run, directory, input, expected, api, options = {}) {
  await writeFile(join(directory, 'gate-input.json'), json(input));
  const result = run(['report', '--json', directory], options);
  assert.equal(result.status, expected.verdict === 'go' ? 0 : 2, result.stderr + result.stdout.slice(0, 5000));
  const target = result.data.targets[0]; assert.equal(target.verdict, expected.verdict, json(target));
  if (expected.dq) assert.ok(target.disqualifications.some(d => d.code === expected.dq), json(target));
  if (api) {
    const schema = await api.validateGateInput(input); assert.equal(schema.valid, expected.schemaValid ?? true, json(schema.issues));
    const evidenceVerification = await api.verifyEvidenceArtifacts(input, { baseDir: directory });
    assert.equal(evidenceVerification.status, 'pass', json(evidenceVerification));
    const evaluated = api.evaluateGate({ ...input, evidenceVerification });
    assert.equal(evaluated.verdict, expected.apiVerdict ?? expected.verdict, json(evaluated));
    if (expected.apiDq ?? expected.dq) assert.ok(evaluated.disqualifications.some(d => d.code === (expected.apiDq ?? expected.dq)), json(evaluated));
  }
  return target;
}

export async function verifyPlacementLayers(run, fixtures, directory, api) {
  const input = await boundaryConsumer(fixtures, directory); input.policy.inputContract.requireExecutedTests = true;
  const risk = { id: 'qeg:manual-risk', kind: 'risk', title: 'Synthetic risk', sourceArtifactIds: [], traceability, priority: 'P1', severity: 'high', likelihood: 0.1, businessImpact: 0.1, complianceCriticality: 0, evidenceGap: 0, novelty: 0 };
  const test = { id: 'qeg:manual-test', kind: 'test', title: 'Synthetic manual test', sourceArtifactIds: [], traceability, layer: 'manual-scripted', testExecutionMode: 'real', existing: true, coveredRiskIds: [risk.id], oracleType: 'specified', oracleRefs: sourceRefs, expectedResults: ['The specified outcome occurs'] };
  const placement = { id: 'qeg:manual-placement', kind: 'test_placement', title: 'Synthetic placement', obligationId: 'qeg:manual-obligation', primaryLayer: 'manual-scripted', disposition: 'manual-only', gateRelevance: 'blocking', candidateScores: [], selectedTestIds: [test.id], sourceArtifactIds: [], traceability };
  input.graph.nodes.push(risk, test);
  input.placementPlan.obligations = [{ id: placement.obligationId, changedCodeIds: [], riskIds: [risk.id], requirementIds: [], failureModeIds: [], priority: 'P1', riskPriorityIndex: 0.5, gateRelevance: 'blocking', traceability }];
  input.placementPlan.placements = [placement]; addExecutions(input, test); await persistExecutions(input, directory);
  for (const oracleType of ['specified', 'human', 'missing']) {
    test.oracleType = oracleType;
    placement.primaryLayer = 'manual-scripted';
    const verdict = oracleType === 'human' ? 'conditional_go' : oracleType === 'missing' ? 'disqualified' : 'go';
    await gate(run, directory, input, { verdict, ...(oracleType === 'missing' ? { dq: 'DQ-14' } : {}) }, api);
    placement.primaryLayer = 'unit';
    await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-03' }, api);
  }
  test.oracleType = 'specified'; placement.primaryLayer = 'manual-scripted';
  input.graph.nodes.push({ ...structuredClone(placement), id: 'qeg:graph-placement', primaryLayer: 'unit' });
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-03' }, api);
  input.graph.nodes.pop();
  if (api) {
    input.placementPlan = api.placeTests(input.graph, input.policy);
    assert.equal(input.placementPlan.placements[0].primaryLayer, test.layer);
    await gate(run, directory, input, { verdict: 'go' }, api);
  }
}

export async function verifyRetirement(run, fixtures, directory, api) {
  const input = await original(fixtures, directory, 'positive-placement-change-retirement');
  const change = input.placementPlan.placement_changes[0];
  const replacement = input.graph.nodes.find(n => n.id === change.replacement_ids[0]);
  const edge = input.graph.edges.find(e => e.kind === 'replaced_by');
  await gate(run, directory, input, { verdict: 'go' }, api);
  const subjectId = change.subject_id;
  change.subject_id = replacement.id;
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-14' }, api);
  change.subject_id = subjectId;
  const policyId = change.policy_ref; change.policy_ref = 'qeg:unrelated-policy';
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-14' }, api);
  change.policy_ref = policyId;
  for (const layer of ['manual-scripted', 'manual-exploratory', 'spec-clarification']) {
    replacement.layer = layer;
    await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-14' }, api);
  }
  for (const layer of ['unit', 'integration', 'system', 'e2e']) {
    replacement.layer = layer;
    await gate(run, directory, input, { verdict: 'go' }, api);
  }
  input.graph.edges = input.graph.edges.filter(e => e !== edge);
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-14' }, api);
  input.graph.edges.push({ ...edge, from: edge.to, to: edge.from });
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-14' }, api);
  input.graph.edges.pop(); input.graph.edges.push(edge);
  replacement.evidenceStrength = 0;
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-14' }, api);
  replacement.evidenceStrength = 0.93;
  const retired = input.graph.nodes.find(n => n.id === change.subject_id);
  retired.deleted = false; retired.oracleType = 'specified'; retired.oracleRefs = sourceRefs; retired.expectedResults = ['Restored manual check'];
  input.placementPlan.manual_case_inventory.current_subject_ids = [retired.id];
  replacement.layer = 'manual-scripted'; input.graph.edges = input.graph.edges.filter(e => e !== edge);
  await gate(run, directory, input, { verdict: 'go' }, api); // 復帰した手動caseは自動引退を成功根拠にしない。
}

export async function verifyWaiverTime(run, fixtures, directory, api) {
  const input = await boundaryConsumer(fixtures, directory);
  const clock = '2026-02-28T00:00:00.000Z';
  for (const m of [input.metadata, input.graph.metadata, input.placementPlan.metadata]) m.createdAt = clock;
  const risk = { id: 'qeg:waived-risk', kind: 'risk', title: 'Synthetic risk', sourceArtifactIds: [], traceability, priority: 'P1', severity: 'medium', likelihood: 0.1, businessImpact: 0.1, complianceCriticality: 0, evidenceGap: 1, novelty: 0 };
  input.graph.nodes.push(risk);
  const waiver = { id: 'qeg:waiver', linkedRiskIds: [risk.id], approver: 'reviewer', approvalAuthority: 'quality-owner', reason: 'Synthetic exception', expiry: '2030-01-01T00:00:00Z', impactScope: 'fixture', rollbackOrContainment: 'Revert', followUpOwner: 'quality-owner', recheckCondition: 'Next change', sourceRefs };
  input.waivers = [waiver];
  for (const expiry of ['2026-02-28T00:00:00.001Z', '2026-02-28T00:00:00.000000001Z', '2026-02-28T09:00:00.000001+09:00']) {
    waiver.expiry = expiry;
    await gate(run, directory, input, { verdict: 'conditional_go' }, api);
  }
  for (const expiry of [clock, '2026-02-27T23:59:59.999999999Z', '2026-02-28T09:00:00+09:00']) {
    waiver.expiry = expiry;
    await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-04' }, api);
  }
  for (const expiry of ['2026-02-30T00:00:00Z', '2026-02-28T05:00:00', 'not-a-date', '2026-02-28T24:00:00Z']) {
    waiver.expiry = expiry;
    for (const TZ of ['UTC', 'Asia/Tokyo']) await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-01', apiDq: 'DQ-04', schemaValid: false }, api, { env: { TZ } });
  }
  waiver.expiry = '2026-02-28T05:00:00Z';
  for (const TZ of ['UTC', 'Asia/Tokyo']) await gate(run, directory, input, { verdict: 'conditional_go' }, api, { env: { TZ } });
  // 評価時計の小数秒も保持する。expiryと同一nanosecondは期限切れ。
  input.metadata.createdAt = input.graph.metadata.createdAt = input.placementPlan.metadata.createdAt = '2026-02-28T00:00:00.000000002Z';
  waiver.expiry = '2026-02-28T00:00:00.000000002Z';
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-04' }, api);
  waiver.expiry = '2026-02-28T00:00:00.000000003Z';
  await gate(run, directory, input, { verdict: 'conditional_go' }, api);
}

export async function verifyControlRoles(run, fixtures, directory, api) {
  const input = await original(fixtures, directory), roles = input.evidencePackage.controlRoles;
  await gate(run, directory, input, { verdict: 'go' }, api);
  for (const role of Object.keys(roles)) {
    const original = roles[role]; roles[role] = ' \t\u3000';
    await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-01', apiDq: 'DQ-17', schemaValid: false }, api);
    roles[role] = ' ' + original + ' ';
    await gate(run, directory, input, { verdict: 'go' }, api);
    roles[role] = original;
  }
  delete input.evidencePackage.controlRoles;
  await gate(run, directory, input, { verdict: 'disqualified', dq: 'DQ-17' }, api);
}

export async function verifyStorage(run, fixtures, directory, api) {
  const input = await original(fixtures, directory);
  for (const classification of ['immutable', 'append_only', 'versioned', 'mutable', 'unknown']) {
    input.evidencePackage.retention.storageClassification = classification;
    const rejected = ['mutable', 'unknown'].includes(classification);
    await gate(run, directory, input, { verdict: rejected ? 'disqualified' : 'go', ...(rejected ? { dq: 'DQ-16' } : {}) }, api);
  }
}

export const governanceMatrix = [['R20', verifyPlacementLayers], ['R21', verifyRetirement], ['R22', verifyWaiverTime], ['R23', verifyControlRoles], ['R24', verifyStorage]];
