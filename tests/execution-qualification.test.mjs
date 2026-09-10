import assert from 'node:assert/strict';
import test from 'node:test';
import fs, { readFile, writeFile, unlink } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as api from '../dist/index.js';
import { executionFixture, persistExecutions, json, sourceRefs, traceability } from './helpers/execution-fixture.mjs';
import { createRawProducerFixture, persistRawFixture, rawHash } from './helpers/raw-producer-fixture.mjs';

const T = '2026-09-10T00:00:00.000Z';
const run = (status = 'pass', age = 0) => ({ status, completedAt: new Date(Date.parse(T) - age).toISOString() });
async function gate(f, options = {}) {
  const evidenceVerification = await api.verifyEvidenceArtifacts(f.input, { baseDir: f.directory, ...options });
  return api.evaluateGate({ ...f.input, evidenceVerification });
}
const has = (g, code) => g.disqualifications.some(d => d.code === code);
function expectDq(g, code) { assert.equal(g.verdict, 'disqualified', JSON.stringify(g)); assert.ok(has(g, code), JSON.stringify(g.disqualifications)); }
const cli = (directory, command, ...args) => spawnSync(process.execPath, [resolve('dist/cli.js'), command, directory, ...args], { encoding: 'utf8' });

test('EAC TC-01/18: canonical API, CLI, report and record use the same qualified run', async () => {
  const f = await executionFixture();
  const g = await gate(f);
  assert.equal(g.verdict, 'go', JSON.stringify(g));
  assert.equal((await api.validateGateInput(f.input)).valid, true);
  assert.equal(g.executionAccounting.selections[0].selectedRunId, 'synthetic-run-0');
  assert.equal(cli(f.directory, 'gate').status, 0);
  assert.deepEqual(JSON.parse(cli(f.directory, 'gate').stdout), g);
  assert.equal(cli(f.directory, 'record').status, 0);
  const record = JSON.parse(await readFile(join(f.directory, 'quality-evidence-record.json'), 'utf8'));
  assert.deepEqual(record.gate, g);
  assert.equal((await api.validateOutput(record, 'quality-evidence-record.schema.json')).valid, true);
  const report = cli(f.directory, 'report', '--format', 'json');
  assert.equal(report.status, 0, report.stderr);
  assert.deepEqual(JSON.parse(report.stdout).targets[0].executionAccounting, g.executionAccounting);
  assert.match(cli(f.directory, 'report').stdout, /synthetic-run-0/);
  assert.match(await readFile(join(f.directory, 'quality-evidence-record.md'), 'utf8'), /synthetic-run-0/);
  const outputs = JSON.parse(await readFile(join(f.directory, 'output-manifest.json'), 'utf8'));
  for (const file of outputs.files) assert.equal(rawHash(await readFile(join(f.directory, file.path))), file.contentHash);
});

test('EAC TC-02/03: current target and every identity dimension are required', async t => {
  for (const key of ['buildId', 'revision', 'environmentId', 'projectId']) await t.test(key, async () => {
    const f = await executionFixture(); f.executions[0].execution.target[key] = key === 'revision' ? 'b'.repeat(40) : 'different';
    await persistExecutions(f.input, f.directory); expectDq(await gate(f), 'DQ-12');
  });
  for (const key of ['featureId', 'caseId', 'producer', 'projectId']) await t.test(`identity-${key}`, async () => {
    const f = await executionFixture(); f.executions[0].execution.identity = { ...f.test.executionIdentity, [key]: 'different' };
    await persistExecutions(f.input, f.directory); expectDq(await gate(f), 'DQ-03');
  });
  const f = await executionFixture(); delete f.input.policy.executionPolicy;
  expectDq(await gate(f), 'DQ-01');
});

test('EAC TC-04/05: zero future tolerance and inclusive maximum age, millisecond boundary3', async t => {
  for (const [age, verdict] of [[1, 'go'], [0, 'go'], [-1, 'disqualified'], [86400000 - 1, 'go'], [86400000, 'go'], [86400000 + 1, 'disqualified']]) {
    await t.test(`age=${age}`, async () => { const f = await executionFixture([run('pass', age)]); const g = await gate(f); assert.equal(g.verdict, verdict); if (verdict !== 'go') assert.ok(has(g, 'DQ-05')); });
  }
});

test('EAC TC-06: strict calendar/timezone and explicit finite positive age policy', async t => {
  for (const value of ['2026-09-10T00:00:00', '2026-02-30T00:00:00Z', '2026-09-10T24:00:00Z', 'invalid', '2026-09-10T00:00:00.0001Z']) {
    await t.test(value, async () => { const f = await executionFixture([{ status: 'pass', completedAt: value }]); expectDq(await gate(f), 'DQ-05'); });
  }
  for (const value of [undefined, 0, -1, Infinity, NaN]) await t.test(`H=${value}`, async () => {
    const f = await executionFixture(); f.input.policy.executionPolicy.maxEvidenceAgeHours = value; expectDq(await gate(f), 'DQ-01');
  });
  const f = await executionFixture([{ status: 'pass', completedAt: '2026-09-10T09:00:00+09:00' }]); assert.equal((await gate(f)).verdict, 'go');
});

test('EAC TC-07/08/09/10: latest result wins without success fallback', async t => {
  for (const [old, latest, expected] of [['fail', 'pass', 'go'], ['pass', 'fail', 'no_go'], ...['skipped', 'blocked', 'cancelled', 'unknown', 'running'].map(s => ['pass', s, 'disqualified'])]) {
    await t.test(`${old}->${latest}`, async () => { const f = await executionFixture([run(old, 1000), run(latest)]); const g = await gate(f);
      assert.equal(g.verdict, expected, JSON.stringify(g)); assert.equal(g.executionAccounting.selections[0].selectedRunId, 'synthetic-run-1');
      assert.ok(g.executionAccounting.selections[0].excluded.some(e => e.evidenceId === f.executions[0].id && e.reason === 'superseded'));
      if (expected === 'no_go') assert.ok(g.blockers.every(b => b.evidenceId === f.executions[1].id)); });
  }
  for (const completedAt of ['2026-09-10T00:00:00.001Z', '2026-02-30T00:00:00Z']) await t.test(`invalid-current-${completedAt}`, async () => {
    const f = await executionFixture([run('pass', 1000), { status: 'pass', completedAt }]); expectDq(await gate(f), 'DQ-05');
  });
  const stale = await executionFixture([run('pass', 86400002), run('pass', 86400001)]); expectDq(await gate(stale), 'DQ-05');
});

test('EAC TC-11/12: conflicting run identity and ambiguous latest time fail; exact duplicate counts once', async () => {
  const tie = await executionFixture([run(), run()]); expectDq(await gate(tie), 'DQ-05');
  const conflict = await executionFixture([run('pass', 1000), run('fail')]);
  conflict.executions[1].execution.runId = conflict.executions[0].execution.runId;
  await persistExecutions(conflict.input, conflict.directory); expectDq(await gate(conflict), 'DQ-03');
  const f = await executionFixture();
  f.input.graph.nodes.push({ ...structuredClone(f.executions[0]), id: 'qeg:eac-execution-copy' });
  f.input.graph.edges.push({ id: 'qeg:eac-copy-edge', kind: 'evidenced_by', from: f.test.id, to: 'qeg:eac-execution-copy', traceability });
  const g = await gate(f); assert.equal(g.verdict, 'go'); assert.equal(g.executionAccounting.selections[0].consecutivePasses, 1);
  f.input.graph.nodes.reverse(); f.input.graph.edges.reverse();
  assert.deepEqual(await gate(f), g);
});

test('EAC TC-13/14: independent blocker, missing execution, mock and edge mismatch cannot pass', async () => {
  const f = await executionFixture();
  f.test.testExecutionMode = 'mock'; expectDq(await gate(f), 'DQ-05');
  f.test.testExecutionMode = 'real'; f.executions[0].execution.executionMode = 'mock'; await persistExecutions(f.input, f.directory); expectDq(await gate(f), 'DQ-05');
  f.executions[0].execution.executionMode = 'real'; f.input.graph.edges[0].from = 'qeg:claim-001'; await persistExecutions(f.input, f.directory); expectDq(await gate(f), 'DQ-03');
  const missing = await executionFixture([]); expectDq(await gate(missing), 'DQ-05');
  const blocked = await executionFixture(); blocked.input.policy.inputContract.requireExecutedTests = false;
  blocked.input.graph.nodes.push({ id: 'qeg:independent-risk', kind: 'risk', title: 'Unresolved independent defect', sourceArtifactIds: [], traceability,
    priority: 'P2', severity: 'high', likelihood: 0.8, businessImpact: 0.9, complianceCriticality: 0, evidenceGap: 1, novelty: 0 });
  const blockedGate = await gate(blocked); assert.equal(blockedGate.verdict, 'no_go'); assert.ok(blockedGate.blockers.some(b => b.id === 'blocker-qeg:independent-risk'));
  const duplicateIdentity = await executionFixture(); duplicateIdentity.input.graph.nodes.push({ ...duplicateIdentity.test, id: 'qeg:other-test' }); expectDq(await gate(duplicateIdentity), 'DQ-03');
});

test('EAC TC-15: raw missing, modified, unreadable, escaped path and semantically different payload fail closed', async t => {
  for (const mode of ['missing', 'hash', 'payload', 'binding', 'outside', 'reference']) await t.test(mode, async () => {
    const f = await executionFixture(); const raw = f.executions[0].execution.rawArtifactRef;
    if (mode === 'missing') await unlink(join(f.directory, raw.path));
    if (mode === 'hash') await writeFile(join(f.directory, raw.path), '{}');
    if (mode === 'payload') { const bytes = json({ unexpected: 'different raw with correct hash' }); await writeFile(join(f.directory, raw.path), bytes); raw.contentHash = rawHash(bytes); f.executions[0].evidenceRefs[0].contentHash = raw.contentHash; }
    if (mode === 'binding') { const bytes = json({ bindingVersion: 'qeg-build/v1', target: { ...f.input.policy.executionPolicy.target, buildId: 'other' } });
      await writeFile(join(f.directory, f.input.policy.executionPolicy.buildBindingRef.path), bytes); f.input.policy.executionPolicy.buildBindingRef.contentHash = rawHash(bytes); }
    if (mode === 'outside') raw.path = '../outside.json';
    if (mode === 'reference') f.executions[0].evidenceRefs[0].path = 'execution/missing.json';
    expectDq(await gate(f, { strict: false }), 'DQ-06');
  });
  const f = await executionFixture(); const original = fs.readFile; const path = join(f.directory, f.executions[0].execution.rawArtifactRef.path);
  const mock = t.mock.method(fs, 'readFile', async (...args) => { if (String(args[0]) === path) throw Object.assign(new Error('fixture denied'), { code: 'EACCES' }); return original(...args); });
  syncBuiltinESMExports();
  try { const report = await api.verifyEvidenceArtifacts(f.input, { baseDir: f.directory }); assert.ok(report.items.some(i => i.code === 'IO_ERROR' && i.message.includes('Cannot read'))); expectDq(api.evaluateGate({ ...f.input, evidenceVerification: report }), 'DQ-06'); }
  finally { mock.mock.restore(); syncBuiltinESMExports(); }
});

test('EAC TC-16/17/18: explicit history, planning, fingerprint reuse and wall clock invariance', async t => {
  const f = await executionFixture([run('fail', 86400001), run()]);
  f.executions[0].execution.target.buildId = 'old-build'; f.executions[0].execution.target.revision = 'b'.repeat(40);
  f.executions[0].execution.rawArtifactRef.revision = 'b'.repeat(40); f.executions[0].execution.historySourceRefs = sourceRefs;
  await persistExecutions(f.input, f.directory); const g = await gate(f); assert.equal(g.verdict, 'go', JSON.stringify(g));
  assert.equal(g.executionAccounting.selections[0].excluded[0].reason, 'explicit_history');
  delete f.executions[0].execution.historySourceRefs; expectDq(await gate(f), 'DQ-12');
  const fresh = await executionFixture(); const report = await api.verifyEvidenceArtifacts(fresh.input, { baseDir: fresh.directory });
  const before = api.evaluateGate({ ...fresh.input, evidenceVerification: report });
  const mockedClock = t.mock.method(Date, 'now', () => Date.parse('2037-01-01T00:00:00Z'));
  assert.deepEqual(api.evaluateGate({ ...fresh.input, evidenceVerification: report }), before); mockedClock.mock.restore();
  fresh.input.policy.executionPolicy.maxEvidenceAgeHours = 48; expectDq(api.evaluateGate({ ...fresh.input, evidenceVerification: report }), 'DQ-06');
  expectDq(api.evaluateGate(fresh.input), 'DQ-06');
  const planning = await executionFixture([]); planning.input.policy.inputContract.requireExecutedTests = false;
  assert.equal((await gate(planning)).executionAccounting, undefined);
  const optional = { id: 'qeg:optional', adapter: 'junit', kind: 'execution_evidence', path: 'missing-optional.xml' };
  planning.input.metadata.inputArtifacts.push(optional); const v = await api.verifyEvidenceArtifacts(planning.input, { baseDir: planning.directory }); assert.equal(v.status, 'warn');
});

test('EAC TC-02/03/13/18/25: raw manual target checks, feature isolation and upstream no_go', async () => {
  const f = await executionFixture(); const { manifest, loaded } = await createRawProducerFixture(f.directory, api);
  const evaluate = async () => { await persistRawFixture(f.directory, manifest, loaded); const graph = api.buildGraph(manifest, loaded);
    const input = { metadata: graph.metadata, graph, policy: manifest.policy, waivers: [], placementPlan: api.placeTests(graph, manifest.policy) };
    return api.evaluateGate({ ...input, evidenceVerification: await api.verifyEvidenceArtifacts(input, { baseDir: f.directory }) }); };
  loaded[12].payload.build_id = 'other'; expectDq(await evaluate(), 'DQ-12');
  loaded[12].payload.build_id = 'build-fixture'; loaded[12].payload.timestamp = '2026-09-10T00:00:00.001Z'; expectDq(await evaluate(), 'DQ-05');
  loaded[12].payload.timestamp = T;
  loaded[12].payload.build_id = 'build-fixture'; loaded[13].payload.status = 'no_go'; assert.equal((await evaluate()).verdict, 'no_go');
  loaded[13].payload.status = 'go'; loaded[13].payload.build_id = 'other'; expectDq(await evaluate(), 'DQ-12');
  loaded[13].payload.build_id = 'build-fixture';
  const prior = structuredClone(loaded[12]); prior.ref.id += '-prior'; prior.ref.path = prior.ref.path.replace('.json', '-prior.json');
  prior.payload.run_id = 'RUN-PRIOR'; prior.payload.timestamp = '2026-09-09T23:59:59Z'; prior.payload.result = 'fail';
  manifest.artifacts.push(prior.ref); loaded.push(prior);
  const rerun = await evaluate(); assert.equal(rerun.verdict, 'go', JSON.stringify(rerun));
  assert.equal(rerun.executionAccounting.selections[0].selectedRunId, 'RUN-001');
  for (const command of ['build-graph', 'place-tests', 'gate']) assert.equal(cli(f.directory, command).status, 0, command);
  const copies = structuredClone(loaded.slice(9));
  for (const item of copies) { item.ref.id += '-feature2'; item.ref.path = item.ref.path.replace('.json', '-feature2.json'); item.payload.feature_id = 'SPEC-OTHER'; manifest.artifacts.push(item.ref); loaded.push(item); }
  const g = await evaluate(); assert.equal(g.verdict, 'go', JSON.stringify(g)); assert.equal(g.executionAccounting.selections.length, 2);
});

test('EAC TC-25: every profile retains target/time/file DQs with waiver and strict=false', async t => {
  for (const profile of ['lean', 'standard', 'strict', 'ipo_controlled']) await t.test(profile, async () => {
    for (const mode of ['target', 'future', 'raw']) {
      const f = await executionFixture(); f.input.metadata.profile = f.input.graph.metadata.profile = f.input.policy.profile = profile;
      f.input.graph.nodes.push({ id: 'qeg:eac-risk', kind: 'risk', title: 'Waived synthetic risk', sourceArtifactIds: [], traceability,
        priority: 'P1', severity: 'high', likelihood: 0.2, businessImpact: 0.5, complianceCriticality: 0, evidenceGap: 0, novelty: 0 });
      f.input.placementPlan.obligations[0].riskIds = ['qeg:eac-risk'];
      f.input.waivers = [{ id: 'qeg:eac-waiver', linkedRiskIds: ['qeg:eac-risk'], approver: 'fixture-approver', approvalAuthority: 'fixture-authority', reason: 'Fixture only', expiry: '2026-12-01T00:00:00Z',
        impactScope: 'fixture', rollbackOrContainment: 'restore', followUpOwner: 'fixture-owner', recheckCondition: 'next build', sourceRefs }];
      if (mode === 'target') f.executions[0].execution.target.buildId = 'other';
      if (mode === 'future') f.executions[0].execution.completedAt = '2026-09-10T00:00:00.001Z';
      await persistExecutions(f.input, f.directory);
      if (mode === 'raw') await unlink(join(f.directory, f.executions[0].execution.rawArtifactRef.path));
      expectDq(await gate(f, { strict: false }), mode === 'target' ? 'DQ-12' : mode === 'future' ? 'DQ-05' : 'DQ-06');
      if (mode === 'target') {
        f.input.graph.nodes = f.input.graph.nodes.filter(n => !n.execution); f.input.graph.edges = [];
        delete f.test.executionIdentity; delete f.input.policy.executionPolicy;
        const waived = await gate(f, { strict: false });
        assert.equal(waived.disqualifications.length, 0, 'Waiver can relieve missing execution, but cannot erase supplied current violations');
        assert.equal(waived.executionAccounting, undefined);
      }
    }
  });
});

test('EAC TC-06/14/18: retirement needs measured consecutive passes; graph order preserves DQ meaning', async () => {
  const f = await executionFixture([run('fail', 2000), run('pass', 1000), run('pass')]);
  f.test.evidenceStrength = 1; f.test.recentGreenRuns = 99;
  const g = await gate(f); assert.equal(g.executionAccounting.selections[0].consecutivePasses, 2);
  const fixture = JSON.parse(await readFile('fixtures/positive-placement-change-retirement/gate-input.json', 'utf8'));
  const report = await api.verifyEvidenceArtifacts(fixture, { baseDir: resolve('fixtures/positive-placement-change-retirement') });
  assert.equal(api.evaluateGate({ ...fixture, evidenceVerification: report }).verdict, 'go');
  const last = fixture.graph.nodes.filter(n => n.execution).at(-1); last.execution.status = 'skipped'; delete last.passed;
  expectDq(api.evaluateGate({ ...fixture, evidenceVerification: report }), 'DQ-14');
  const invalid = await executionFixture([run('pass', -1), run('pass', -2)]); const first = await gate(invalid);
  invalid.input.graph.nodes.reverse(); invalid.input.graph.edges.reverse(); assert.deepEqual(await gate(invalid), first);
});
