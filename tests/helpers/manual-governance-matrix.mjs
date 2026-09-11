import assert from 'node:assert/strict';
import { cp, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addExecutions, persistExecutions, sourceRefs, traceability, json } from './execution-fixture.mjs';

export async function manualInput(fixtures, directory, fixture = 'positive-release-go') {
  await cp(join(fixtures, fixture), directory, { recursive: true });
  await unlink(join(directory, 'expected-gate-verdict.json'));
  return JSON.parse(await readFile(join(directory, 'gate-input.json'), 'utf8'));
}
export function addManual(input) {
  const test = { id: 'qeg:manual-state-case', kind: 'test', title: 'Synthetic manual case', layer: 'manual-scripted', testExecutionMode: 'real', existing: true,
    sourceArtifactIds: [], traceability, oracleType: 'specified', oracleRefs: sourceRefs, expectedResults: ['Expected synthetic outcome'] };
  input.graph.nodes.push(test);
  const o = { id: 'qeg:manual-state-obligation', changedCodeIds: [], riskIds: [], requirementIds: [], failureModeIds: [], priority: 'P1', riskPriorityIndex: 1, gateRelevance: 'blocking', traceability };
  const placement = { id: 'qeg:manual-state-placement', kind: 'test_placement', title: 'Synthetic manual placement', obligationId: o.id,
    primaryLayer: test.layer, disposition: 'manual-only', gateRelevance: 'blocking', candidateScores: [], selectedTestIds: [test.id], sourceArtifactIds: [], traceability };
  input.placementPlan.obligations.push(o); input.placementPlan.placements.push(placement);
  const evidence = { executedCaseId: test.id, result: 'pass', expectedResult: 'Expected synthetic outcome', oracleRefs: sourceRefs.map(ref => ({ ...ref, evidenceKind: 'spec' })),
    traceTo: [input.graph.nodes.find(node => node.kind === 'requirement').id], evidenceRefs: sourceRefs.map(ref => ({ ...ref, evidenceKind: 'test_result' })) };
  input.evidencePackage.manualEvidence = [evidence]; return { test, evidence, placement, obligation: o };
}
async function check(run, directory, input, expected, api) {
  await writeFile(join(directory, 'gate-input.json'), json(input));
  const result = run(['report', '--json', directory]);
  assert.equal(result.status, expected.verdict === 'go' ? 0 : 2, result.stderr + result.stdout.slice(0, 5000));
  const target = result.data.targets[0]; assert.equal(target.verdict, expected.verdict, json(target));
  if (expected.dq) assert.ok(target.disqualifications.some(d => d.code === expected.dq), json(target));
  if (expected.human) assert.ok(target.requiredHumanReview.includes(expected.human), json(target));
  if (expected.blockers !== undefined) assert.equal(target.blockers.length, expected.blockers, json(target));
  if (api) {
    const schema = await api.validateGateInput(input); assert.equal(schema.valid, expected.schemaValid ?? true, json(schema.issues));
    const evidenceVerification = await api.verifyEvidenceArtifacts(input, { baseDir: directory }); assert.equal(evidenceVerification.status, 'pass', json(evidenceVerification));
    const gate = api.evaluateGate({ ...input, evidenceVerification }); assert.equal(gate.verdict, expected.apiVerdict ?? expected.verdict, json(gate));
    if (expected.apiDq ?? expected.dq) assert.ok(gate.disqualifications.some(d => d.code === (expected.apiDq ?? expected.dq)), json(gate));
    if (expected.schemaValid !== false) {
      assert.deepEqual(gate.disqualifications, target.disqualifications);
      assert.deepEqual(gate.blockers, target.blockers); assert.deepEqual(gate.requiredHumanReview, target.requiredHumanReview);
    }
  }
  if (expected.record) {
    const record = run(['record', directory]); assert.equal(record.status, result.status, record.stderr + record.stdout);
    const schema = run(['schema-check', directory]); assert.equal(schema.status, 0, schema.stderr + schema.stdout);
    const output = JSON.parse(await readFile(join(directory, 'output-record.json'), 'utf8')); assert.equal(output.gate.verdict, expected.verdict);
  }
  return target;
}

async function shape(run, fixtures, directory, api) {
  const base = await manualInput(fixtures, directory); addManual(base);
  await check(run, directory, base, { verdict: 'go', record: true }, api);
  for (const field of ['expectedResult', 'oracleRefs', 'traceTo', 'evidenceRefs']) for (const state of ['missing', 'empty']) {
    const input = structuredClone(base), item = input.evidencePackage.manualEvidence[0];
    if (state === 'missing') delete item[field]; else item[field] = field === 'expectedResult' ? ' \t\u3000' : [];
    await check(run, directory, input, { verdict: 'disqualified', dq: 'DQ-08', record: state === 'missing' && field === 'evidenceRefs' }, api);
  }
  for (const mutate of [item => { item.traceTo = ['qeg:missing']; }, item => { item.oracleRefs[0].path = ' '; }, item => { item.evidenceRefs[0].path = ' '; }, item => { item.executedCaseId = 'qeg:missing-case'; }]) {
    const input = structuredClone(base); mutate(input.evidencePackage.manualEvidence[0]); await check(run, directory, input, { verdict: 'disqualified', dq: 'DQ-08' }, api);
  }
  for (const patch of [{ oracleRefs: null }, { traceTo: null }, { result: 'unknown' }]) {
    const input = structuredClone(base); Object.assign(input.evidencePackage.manualEvidence[0], patch);
    await check(run, directory, input, { verdict: 'disqualified', dq: 'DQ-01', apiDq: 'DQ-08', schemaValid: false }, api);
  }
  const escaped = structuredClone(base); delete escaped.evidencePackage.manualEvidence[0].evidenceRefs;
  escaped.optionalEvidence = { escapedDefects: [{ id: 'qeg:manual-backlink-defect', title: 'Synthetic escaped defect', severity: 'medium', discoveredAt: escaped.metadata.createdAt, sourceRefs }] };
  await check(run, directory, escaped, { verdict: 'disqualified', dq: 'DQ-08', record: true }, api);
  const recorded = JSON.parse(await readFile(join(directory, 'output-record.json'), 'utf8'));
  assert.equal(recorded.gateEfficacyRecords[0].escaped_defects[0].id, 'qeg:manual-backlink-defect');
  assert.ok(recorded.gateEfficacyRecords[0].evidence_used.length > 0);
}
async function results(run, fixtures, directory, api) {
  const base = await manualInput(fixtures, directory); addManual(base);
  for (const status of ['pass', 'fail', 'blocked', 'skipped']) {
    const input = structuredClone(base); input.evidencePackage.manualEvidence[0].result = status;
    await check(run, directory, input, { verdict: status === 'pass' ? 'go' : status === 'fail' ? 'no_go' : 'conditional_go',
      ...(['blocked', 'skipped'].includes(status) ? { human: 'qeg:manual-state-case' } : {}), record: status === 'fail' }, api);
  }
  for (const normal of ['pass', 'fail']) for (const status of ['pass', 'fail', 'blocked', 'skipped']) {
    const input = structuredClone(base), test = input.graph.nodes.find(n => n.id === 'qeg:manual-state-case');
    input.policy.inputContract.requireExecutedTests = true; input.evidencePackage.manualEvidence[0].result = status;
    addExecutions(input, test, [{ status: normal, completedAt: input.metadata.createdAt }]); await persistExecutions(input, directory);
    await check(run, directory, input, { verdict: normal !== status ? 'disqualified' : normal === 'pass' ? 'go' : 'no_go',
      ...(normal !== status ? { dq: 'DQ-08' } : { blockers: normal === 'fail' ? 1 : 0 }) }, api);
  }
  const unexecuted = structuredClone(base); unexecuted.policy.inputContract.requireExecutedTests = true;
  await check(run, directory, unexecuted, { verdict: 'disqualified', dq: 'DQ-05' }, api);
  const duplicate = structuredClone(base); duplicate.evidencePackage.manualEvidence.push(structuredClone(duplicate.evidencePackage.manualEvidence[0]));
  await check(run, directory, duplicate, { verdict: 'go' }, api);
  duplicate.evidencePackage.manualEvidence[1].result = 'fail';
  const first = await check(run, directory, duplicate, { verdict: 'disqualified', dq: 'DQ-08' }, api);
  duplicate.evidencePackage.manualEvidence.reverse();
  const reversed = await check(run, directory, duplicate, { verdict: 'disqualified', dq: 'DQ-08' }, api);
  assert.deepEqual(first.disqualifications, reversed.disqualifications);
}
async function review(run, fixtures, directory, api) {
  const base = await manualInput(fixtures, directory); const { evidence } = addManual(base);
  const risk = { id: 'qeg:review-state-risk', kind: 'risk', title: 'Synthetic review gap', priority: 'P1', severity: 'medium', likelihood: 0.1, businessImpact: 0.1, complianceCriticality: 0, evidenceGap: 1, novelty: 0, sourceArtifactIds: [], traceability };
  base.graph.nodes.push(risk); evidence.traceTo = [risk.id]; evidence.reviewerNote = 'Synthetic reviewer acknowledged this risk';
  await check(run, directory, base, { verdict: 'go' }, api);
  for (const note of [undefined, '', ' \t\u3000']) {
    const input = structuredClone(base); input.evidencePackage.manualEvidence[0].reviewerNote = note;
    await check(run, directory, input, { verdict: 'disqualified', dq: 'DQ-04' }, api);
  }
  for (const status of ['fail', 'blocked', 'skipped']) {
    const input = structuredClone(base); input.evidencePackage.manualEvidence[0].result = status;
    await check(run, directory, input, { verdict: 'disqualified', dq: 'DQ-04' }, api);
  }
  const missing = structuredClone(base); delete missing.evidencePackage.manualEvidence[0].traceTo;
  await check(run, directory, missing, { verdict: 'disqualified', dq: 'DQ-08', record: true }, api);
}
async function inventory(run, fixtures, directory, api) {
  const base = await manualInput(fixtures, directory, 'positive-placement-change-retirement');
  await check(run, directory, base, { verdict: 'go' }, api);
  const change = base.placementPlan.placement_changes[0], id = change.subject_id;
  const replacement = base.graph.nodes.find(n => n.id === change.replacement_ids[0]); replacement.evidenceStrength = 0.1;
  await check(run, directory, base, { verdict: 'disqualified', dq: 'DQ-14' }, api);
  const restored = structuredClone(base), test = restored.graph.nodes.find(n => n.id === id);
  Object.assign(test, { deleted: false, oracleType: 'specified', oracleRefs: sourceRefs, expectedResults: ['Synthetic restored result'] });
  restored.placementPlan.manual_case_inventory.current_subject_ids = [id];
  await check(run, directory, restored, { verdict: 'go' }, api);
  for (const mutation of [input => { input.graph.nodes.find(n => n.id === id).deleted = true; }, input => { input.graph.nodes.find(n => n.id === id).testExecutionMode = 'mock'; },
    input => { input.placementPlan.manual_case_inventory.current_subject_ids = ['qeg:unresolved']; },
    input => { input.placementPlan.manual_case_inventory.current_subject_ids.push(id); },
    input => { input.graph.nodes.find(n => n.id === id).expectedResults = []; },
    input => { input.graph.nodes = input.graph.nodes.filter(n => n.kind !== 'test_placement'); input.placementPlan.placements[0].disposition = 'blocked'; },
    input => { input.placementPlan.placements = []; input.graph.nodes = input.graph.nodes.filter(n => n.kind !== 'test_placement'); }]) {
    const input = structuredClone(restored); mutation(input); await check(run, directory, input, { verdict: 'disqualified', dq: 'DQ-14' }, api);
  }
  const human = structuredClone(restored); human.graph.nodes.find(n => n.id === id).oracleType = 'human';
  await check(run, directory, human, { verdict: 'conditional_go', human: id }, api);
  await check(run, directory, restored, { verdict: 'go' }, api); // delete/degrade -> genuine restore -> stable state.
}
async function phase(run, fixtures, directory, api) {
  const base = await manualInput(fixtures, directory);
  for (const value of ['implementation_preparation', 'pre_release_review', 'release_decision']) for (const approved of [false, true]) {
    const input = structuredClone(base); input.evidencePackage.phase = value; if (!approved) input.evidencePackage.approvalEvidence = [];
    await check(run, directory, input, { verdict: approved || value === 'implementation_preparation' ? 'go' : value === 'pre_release_review' ? 'conditional_go' : 'disqualified',
      ...(value === 'release_decision' && !approved ? { dq: 'DQ-15' } : {}), ...(value === 'pre_release_review' && !approved ? { human: input.evidencePackage.id, record: true } : {}) }, api);
  }
  for (const field of ['approver', 'roleOrAuthority', 'approvedDecision']) {
    const input = structuredClone(base); input.evidencePackage.phase = 'pre_release_review'; input.evidencePackage.approvalEvidence[0][field] = ' \t\u3000';
    await check(run, directory, input, { verdict: 'disqualified', dq: 'DQ-01', apiDq: 'DQ-15', schemaValid: false }, api);
  }
  for (const field of ['policyId', 'policyHash', 'evidencePackageHash']) {
    const input = structuredClone(base); input.evidencePackage.phase = 'pre_release_review'; input.evidencePackage.approvalEvidence[0][field] = 'qeg:different';
    await check(run, directory, input, { verdict: 'disqualified', dq: 'DQ-15' }, api);
  }
  const future = structuredClone(base); future.evidencePackage.approvalEvidence[0].approvedAt = '2030-01-01T00:00:00Z';
  await check(run, directory, future, { verdict: 'disqualified', dq: 'DQ-15' }, api);
  const duplicate = structuredClone(base); duplicate.evidencePackage.approvalEvidence.push(structuredClone(duplicate.evidencePackage.approvalEvidence[0]));
  await check(run, directory, duplicate, { verdict: 'disqualified', dq: 'DQ-15' }, api);
  for (const decision of ['conditional_go', 'no_go', 'disqualified', 'pending']) {
    const input = structuredClone(base); input.evidencePackage.approvalEvidence[0].approvedDecision = decision;
    await check(run, directory, input, { verdict: 'conditional_go', human: input.evidencePackage.id }, api);
  }
  const blocked = structuredClone(base); addManual(blocked).evidence.result = 'fail'; blocked.evidencePackage.phase = 'pre_release_review'; blocked.evidencePackage.approvalEvidence = [];
  await check(run, directory, blocked, { verdict: 'no_go', human: blocked.evidencePackage.id }, api);
  delete blocked.evidencePackage.manualEvidence[0].traceTo;
  await check(run, directory, blocked, { verdict: 'disqualified', dq: 'DQ-08', human: blocked.evidencePackage.id }, api);
}

export const manualGovernanceMatrix = [['shape', shape], ['results', results], ['review', review], ['inventory', inventory], ['phase', phase]];
