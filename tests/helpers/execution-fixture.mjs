import { mkdir, writeFile, readFile, cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { rawHash } from './raw-producer-fixture.mjs';

export const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceRefs = [{ id: 'qeg:eac-synthetic-source', path: 'gate-input.json', label: 'EAC synthetic acceptance scenario' }];
export const traceability = { sourceRefs, assumptions: ['Synthetic execution, not a live producer run'], confidence: 'high' };
export async function persistExecutions(input, directory) {
  await mkdir(join(directory, 'execution'), { recursive: true });
  const policy = input.policy.executionPolicy;
  const binding = json({ bindingVersion: 'qeg-build/v1', target: policy.target });
  policy.buildBindingRef.contentHash = rawHash(binding);
  await writeFile(join(directory, policy.buildBindingRef.path), binding);
  for (const node of input.graph.nodes.filter(n => n.execution)) {
    const { rawArtifactRef, historySourceRefs, ...raw } = node.execution;
    const bytes = json(raw);
    rawArtifactRef.contentHash = rawHash(bytes);
    await writeFile(join(directory, rawArtifactRef.path), bytes);
    node.evidenceRefs = [{ ...rawArtifactRef, evidenceKind: 'test_result', capturedAt: node.execution.completedAt }];
  }
  await writeFile(join(directory, 'gate-input.json'), json(input));
}
export function addExecutions(input, test, runs = [{ status: 'pass', completedAt: input.metadata.createdAt }]) {
  const revision = 'a'.repeat(40);
  const target = { projectId: 'synthetic-eac', buildId: 'synthetic-build-1', revision, environmentId: 'synthetic-ci' };
  input.metadata.headRef = revision; input.graph.metadata.headRef = revision;
  for (const metadata of [input.metadata, input.graph.metadata, input.placementPlan?.metadata].filter(Boolean)) {
    for (const ref of metadata.inputArtifacts) ref.revision = revision;
  }
  if (input.placementPlan) input.placementPlan.metadata.headRef = revision;
  input.policy.executionPolicy = { target, maxEvidenceAgeHours: 24, sourceRefs,
    buildBindingRef: { id: 'qeg:eac-build', path: 'execution/build.json', contentHash: 'sha256:' + '0'.repeat(64), revision } };
  if (input.evidencePackage) input.evidencePackage.gatePolicy = input.policy;
  test.executionIdentity = { producer: 'qeg-native', projectId: target.projectId, featureId: 'synthetic-feature', caseId: test.id };
  return runs.map((run, index) => {
    const id = `qeg:eac-execution-${index}`;
    const ref = { id: `qeg:eac-raw-${index}`, path: `execution/run-${index}.json`, contentHash: 'sha256:' + '0'.repeat(64), revision };
    const node = { id, kind: 'execution_evidence', title: `Synthetic execution ${index}`, sourceArtifactIds: [], traceability,
      execution: { executionVersion: 'qeg-execution/v1', testId: test.id, identity: test.executionIdentity, producerVersion: 'synthetic-contract-v1',
        target: { ...target }, runId: `synthetic-run-${index}`, completedAt: run.completedAt, status: run.status, executionMode: 'real', rawArtifactRef: ref },
      ...(['pass', 'fail'].includes(run.status) ? { passed: run.status === 'pass' } : {}), evidenceRefs: [] };
    input.graph.nodes.push(node);
    input.graph.edges.push({ id: `qeg:eac-edge-${index}`, kind: 'evidenced_by', from: test.id, to: id, traceability });
    return node;
  });
}
export async function executionFixture(runs) {
  const directory = await mkdtemp(join(tmpdir(), 'qeg-eac-'));
  await cp(resolve('fixtures/positive-release-go'), directory, { recursive: true });
  const input = JSON.parse(await readFile(join(directory, 'gate-input.json'), 'utf8'));
  input.metadata.createdAt = input.graph.metadata.createdAt = '2026-09-10T00:00:00.000Z';
  input.policy.inputContract.requireExecutedTests = true;
  const test = { id: 'qeg:eac-test', kind: 'test', title: 'Synthetic normal test', sourceArtifactIds: [], traceability,
    layer: 'unit', testExecutionMode: 'real', existing: true };
  input.graph.nodes.push(test);
  input.placementPlan = { metadata: input.metadata, obligations: [{ id: 'qeg:eac-obligation', changedCodeIds: [], riskIds: [], requirementIds: [], failureModeIds: [],
    priority: 'P1', riskPriorityIndex: 0.5, gateRelevance: 'blocking', traceability }], placements: [{ id: 'qeg:eac-placement', kind: 'test_placement',
    title: 'Synthetic placement', obligationId: 'qeg:eac-obligation', primaryLayer: 'unit', disposition: 'reuse', gateRelevance: 'blocking', candidateScores: [], selectedTestIds: [test.id], sourceArtifactIds: [], traceability }] };
  const executions = addExecutions(input, test, runs);
  await persistExecutions(input, directory);
  return { input, test, executions, directory };
}
