import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export const rawHash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
export const manualTestId = 'mbb:test:' + encodeURIComponent(JSON.stringify(['synthetic-order', 'SPEC-ORDER-01', 'TC-001']));
export async function persistRawFixture(directory, manifest, loaded) {
  for (const item of loaded) {
    const bytes = json(item.payload);
    item.ref.contentHash = rawHash(bytes);
    const ref = manifest.artifacts.find(a => a.id === item.ref.id);
    if (ref) ref.contentHash = item.ref.contentHash;
    await writeFile(join(directory, item.ref.path), bytes);
  }
  await writeFile(join(directory, 'ingest-manifest.json'), json(manifest));
}
export async function createRawProducerFixture(directory, api) {
  const createdAt = '2026-09-10T00:00:00.000Z';
  const headRef = 'a'.repeat(40);
  const sourceRefs = [{ id: 'qeg:raw-fixture-policy', path: 'ingest-manifest.json', label: '/policy' }];
  const policy = { policyId: 'qeg:raw-fixture', policyHash: 'sha256:' + 'b'.repeat(64), profile: 'lean', effectiveDate: createdAt,
    approver: 'fixture-author', sourceRefs, dqScope: Array.from({ length: 21 }, (_, i) => `DQ-${String(i + 1).padStart(2, '0')}`),
    exitCodePolicy: { go: 0, conditional_go: 2, no_go: 2, disqualified: 2 },
    inputContract: { ...api.upstreamInputContract('raw-producer-contract'), evaluationScope: { kind: 'fixture', target: 'raw producer interoperability', notEvaluated: ['real deployment', 'release approval'] } } };
  const metadata = { qegVersion: '0.2', runId: 'qeg:raw-fixture', createdAt, headRef, profile: 'lean', policyId: policy.policyId, policyHash: policy.policyHash, inputArtifacts: [] };
  const target = { projectId: 'synthetic-order', buildId: 'build-fixture', revision: headRef, environmentId: 'synthetic-ci' };
  const binding = json({ bindingVersion: 'qeg-build/v1', target });
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'build-binding.json'), binding);
  policy.executionPolicy = { target, maxEvidenceAgeHours: 24, sourceRefs,
    buildBindingRef: { id: 'qeg:synthetic-build', path: 'build-binding.json', contentHash: rawHash(binding), revision: headRef } };
  const evidence = [{ id: 'ctg:source-order', path: 'src/order.ts', startLine: 1, endLine: 2, kind: 'diff' }];
  const header = name => ({ version: 'ctg/v1', generated_at: createdAt, run_id: 'ctg:run-fixture', repo: { root: '.', base_ref: 'b'.repeat(40), head_ref: headRef },
    tool: { name: 'code-to-gate', version: '1.5.1', plugin_versions: [] }, artifact: name, schema: `${name}@v1` });
  const feature = 'SPEC-ORDER-01';
  const payloads = [
    ['RanD', 'requirements_packet', { schema_version: '1.0', packet_id: 'rand:packet-1', derived_from: 'rand:kano-1', qeg_policy_hash_ref: 'qeg:policyHash:unadopted-proposal',
      product_context: {}, assumptions: ['Fixture scenario'], release_readiness_prelude: {}, requirements: [{ requirement_id: 'rand:REQ-001', title: 'Cancel order', statement: 'Pending orders can be cancelled', priority: 'P1', confidence: 0.9,
        evidence_refs: ['rand:evidence-1'], acceptance_criteria: ['Cancelling a pending order returns success'], risks: [], gate_policy_proposal: { proposal: {}, policyHashRef: 'qeg:policyHash:unadopted-proposal', source: 'rand:kano_requirements_packet' } }] }],
    ['RanD', 'requirements_audit_packet', { schema_version: '1.0', document_id: 'rand:audit-1', summary: 'One audited requirement', assumptions: [], source_refs: { audited_document: 'spec.md', external_evidence: [], implementation_evidence: ['src/order.ts'] },
      gate_summary: { go: 1, conditional_go: 0, no_go: 0 }, requirements: [{ requirement_id: 'rand:REQ-001', original_text: 'Pending orders can be cancelled', confidence: 0.9,
        testability: 'high', implementation_alignment: 'high', gate_verdict: 'go', evidence: [], risks: [], issues: [] }] }],
    ['code-to-gate', 'normalized_repo_graph', { ...header('normalized-repo-graph'), files: [], modules: [], symbols: [], relations: [], tests: [{ id: 'test:tests/order.test.ts', path: 'tests/order.test.ts', framework: 'node:test' }], configs: [], entrypoints: [], diagnostics: [], stats: { partial: false } }],
    ['code-to-gate', 'diff_analysis', { ...header('diff-analysis'), changed_files: [{ path: 'src/order.ts', status: 'modified', additions: 2, deletions: 1, hunks: [{ startLine: 1, endLine: 2 }] }],
      blast_radius: { affectedFiles: ['src/order.ts'], affectedSymbols: [], affectedTests: ['tests/order.test.ts'], affectedEntrypoints: [], maxDepth: 1 }, diff_findings: { new_findings: ['ctg:finding-order'], potentially_affected_findings: [], resolved_findings: [] } }],
    ['code-to-gate', 'findings', { ...header('findings'), completeness: 'complete', findings: [{ id: 'ctg:finding-order', ruleId: 'ORDER-STATE', category: 'testing', severity: 'medium', confidence: 0.9, title: 'Cancellation path changed', summary: 'Exercise the changed transition', evidence }], unsupported_claims: [] }],
    ['code-to-gate', 'risk_register', { ...header('risk-register'), completeness: 'complete', risks: [{ id: 'ctg:risk-order', title: 'Incorrect cancellation', severity: 'high', likelihood: 'medium', impact: ['Order consistency'], confidence: 0.9, sourceFindingIds: ['ctg:finding-order'], evidence, recommendedActions: ['Run cancellation case'] }] }],
    ['code-to-gate', 'test_seeds', { ...header('test-seeds'), completeness: 'complete', seeds: [{ id: 'ctg:seed-order', title: 'Cancel pending order', intent: 'regression', sourceRiskIds: ['ctg:risk-order'], sourceFindingIds: ['ctg:finding-order'], evidence, suggestedLevel: 'integration', notes: 'Guard transition' }] }],
    ['code-to-gate', 'release_readiness', { ...header('release-readiness'), status: 'passed', completeness: 'complete', summary: 'Fixture producer check passed', counts: { findings: 1, critical: 0, high: 0, risks: 1, testSeeds: 1, unsupportedClaims: 0 }, failedConditions: [], recommendedActions: [], artifactRefs: {} }],
    ['code-to-gate', 'audit', { ...header('audit'), inputs: [], policy: { id: 'ctg:policy-1', hash: rawHash('policy') }, exit: { code: 0, status: 'passed', reason: 'Fixture audit complete' } }],
    ['manual-bb-test-harness', 'feature_spec', { feature_id: feature, title: 'Order cancellation', acceptance_criteria: ['Cancel pending order successfully'], source_refs: [{ id: 'rand:REQ-001', kind: 'spec' }], changed_areas: ['src/order.ts'] }],
    ['manual-bb-test-harness', 'risk_register', { feature_id: feature, risks: [{ id: 'RISK-01', scenario: 'Order stays pending after cancellation', impact: 4, likelihood: 2, priority: 'P1', trace_to: ['TC-001'] }] }],
    ['manual-bb-test-harness', 'manual_case_set', { feature_id: feature, manual_cases: [{ tc_id: 'TC-001', title: 'Cancel order', priority: 'P1', primary_view: 'black', techniques: ['state_transition'], source_ref: { type: 'acceptance', refs: ['AC-1'] }, steps: ['Cancel a pending order'], expected_results: ['Order is cancelled'], oracle: { type: 'specified', refs: ['AC-1'] }, trace_to: ['RISK-01', 'ctg:risk-order'] }], exploratory_charters: [], platform_matrix: [], role_matrix: [] }],
    ['manual-bb-test-harness', 'execution_evidence', { run_id: 'RUN-001', feature_id: feature, build_id: 'build-fixture', timestamp: createdAt, tc_id: 'TC-001', result: 'pass', oracle_type: 'specified', oracle_refs: ['AC-1'], expected: ['Order is cancelled'], actual: ['Order is cancelled'], attachments: [] }],
    ['manual-bb-test-harness', 'gate_decision', { feature_id: feature, build_id: 'build-fixture', status: 'go', profile: 'lean', reasons: ['Case executed in the fixture scenario'], evidence_summary: { manual_by_priority: { P1: { total: 1, pass: 1 } }, mandatory_observation_rate: 100 } }],
  ];
  await mkdir(join(directory, 'raw'), { recursive: true });
  const loaded = [];
  for (const [index, [adapter, kind, payload]] of payloads.entries()) {
    const path = `raw/${String(index).padStart(2, '0')}-${kind}.json`;
    const bytes = json(payload);
    const ref = { id: `qeg:raw-${index}`, adapter, kind, path, contractVersion: adapter === 'RanD' ? 'rand-kano/1.0' : adapter === 'code-to-gate' ? 'ctg-artifacts/v1' : 'manual-bb/v1', contentHash: rawHash(bytes), revision: headRef };
    if (adapter === 'manual-bb-test-harness') ref.executionContext = { projectId: target.projectId, environmentId: target.environmentId, producerVersion: 'synthetic-contract-v1' };
    await writeFile(join(directory, path), bytes);
    loaded.push({ ref, payload });
  }
  const manifest = { manifestVersion: 'qeg-ingest/v1', metadata, policy, artifacts: loaded.map(a => a.ref), waivers: [] };
  await writeFile(join(directory, 'ingest-manifest.json'), json(manifest));
  return { manifest, loaded };
}
