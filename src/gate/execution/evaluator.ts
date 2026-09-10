import type { Disqualification, DisqualificationCode, ExecutionAccounting, ExecutionSelection, GateBlocker, LegacyExecutionEvidenceNode } from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import { inputSource } from "../../input-contract.js";
import { executionFingerprint, executionTime, normalEvidence, normalTests, same, validExecution, validIdentity, validPolicy, validRef, validSources, validTarget } from "./contracts.js";
import { selectLatest } from "./selection.js";

export function evaluateExecutions(input: DQDetectorInput): { accounting?: ExecutionAccounting; disqualifications: Disqualification[]; blockers: GateBlocker[] } {
  const evidence = normalEvidence(input);
  const tests = normalTests(input);
  const requiredObligations = new Set(input.placementPlan?.obligations.filter(o =>
    (o.gateRelevance === "blocking" || o.changedCodeIds.length > 0) &&
    !(o.riskIds.length > 0 && o.riskIds.every(id => input.validWaivers.some(w => w.linkedRiskIds.includes(id))))).map(o => o.id));
  const selected = new Set(input.policy.inputContract?.requireExecutedTests ? input.placementPlan?.placements
    .filter(p => p.disposition !== "blocked" && requiredObligations.has(p.obligationId)).flatMap(p => [...p.selectedTestIds]) ?? [] : []);
  const active = tests.filter(t => selected.has(t.id) || t.evidenceStrength !== undefined || t.recentGreenRuns !== undefined ||
    evidence.some(e => e.execution?.testId === t.id || input.graph.edges.some(edge => edge.kind === "evidenced_by" && edge.from === t.id && edge.to === e.id)));
  if (!active.length && !evidence.some(e => e.execution)) return { disqualifications: [], blockers: [] };
  const disqualifications: Disqualification[] = [];
  const blockers: GateBlocker[] = [];
  const add = (code: DisqualificationCode, message: string, nodeIds: string[]): void => {
    const binding = input.policy.executionPolicy?.buildBindingRef;
    const refs = [inputSource("/policy/executionPolicy", message), ...input.graph.nodes.filter(n => nodeIds.includes(n.id)).flatMap(n => [...n.traceability.sourceRefs]),
      ...(binding ? [{ id: binding.id, path: binding.path, revision: binding.revision, label: "EAC-01 target build binding" }] : [])];
    disqualifications.push({ code, message, nodeIds, sourceRefs: [...new Map(refs.map(r => [JSON.stringify(r), r])).values()] });
  };
  const policy = input.policy.executionPolicy;
  const selections: ExecutionSelection[] = [];
  const result = (): { accounting: ExecutionAccounting; disqualifications: Disqualification[]; blockers: GateBlocker[] } => ({
    accounting: { evaluatedAt: input.metadata.createdAt, ...(validTarget(policy?.target) ? { target: policy!.target } : {}), selections }, disqualifications, blockers,
  });
  if (!validPolicy(policy)) { add("DQ-01", "EAC-01/02 explicit source-backed executionPolicy is required", active.map(t => t.id)); return result(); }
  if (policy.target.revision !== input.metadata.headRef || policy.target.revision !== input.graph.metadata.headRef ||
    policy.buildBindingRef.revision !== policy.target.revision) add("DQ-12", "EAC-01 policy, build binding and Gate revisions disagree", []);
  const now = executionTime(input.metadata.createdAt);
  if (!Number.isFinite(now)) add("DQ-05", "EAC-02 invalid evaluation clock (timezone and valid calendar required)", []);
  if (input.evidenceVerification?.executionFingerprint !== executionFingerprint(input) || input.evidenceVerification?.status === "fail") {
    add("DQ-06", "EAC-05 verified artifacts and matching execution fingerprint are required", evidence.map(e => e.id));
  }
  for (const test of active) {
    const aliases = tests.filter(other => other.id !== test.id && validIdentity(test.executionIdentity) && same(test.executionIdentity, other.executionIdentity));
    if (aliases.length) add("DQ-03", "EAC-04 one execution identity maps to multiple tests", [test.id, ...aliases.map(t => t.id)]);
  }
  const globalInvalid = disqualifications.length > 0;
  for (const node of evidence.filter(e => e.execution)) {
    if (!tests.some(t => t.id === node.execution!.testId)) add("DQ-03", "EAC-04 execution references missing or incompatible test", [node.id]);
  }
  for (const test of [...active].sort((a, b) => a.id.localeCompare(b.id, "en"))) {
    const candidates = evidence.filter(e => e.execution?.testId === test.id || input.graph.edges.some(edge => edge.kind === "evidenced_by" && edge.from === test.id && edge.to === e.id));
    const before = disqualifications.length;
    if (!validIdentity(test.executionIdentity)) add("DQ-01", "EAC-04 test executionIdentity is required", [test.id]);
    if (test.testExecutionMode !== "real" || test.deleted) add("DQ-05", "EAC-06 test is mock or deleted", [test.id]);
    const current: LegacyExecutionEvidenceNode[] = [];
    const excluded: { evidenceId: string; reason: string }[] = [];
    for (const node of candidates) {
      const detail = node.execution;
      if (!validExecution(detail)) { add("DQ-01", "EAC-01/04 execution contract is incomplete", [test.id, node.id]); continue; }
      const linked = input.graph.edges.filter(e => e.kind === "evidenced_by" && e.to === node.id).map(e => e.from);
      if (detail.testId !== test.id || !same(test.executionIdentity, detail.identity) || new Set(linked).size !== 1 || linked[0] !== test.id) {
        add("DQ-03", "EAC-04 test, case, feature, producer or graph link disagrees", [test.id, node.id]); continue;
      }
      if (detail.historySourceRefs !== undefined && validSources(detail.historySourceRefs)) {
        excluded.push({ evidenceId: node.id, reason: "explicit_history" }); continue;
      }
      if (!same(detail.target, policy.target) || detail.identity.projectId !== policy.target.projectId || detail.rawArtifactRef.revision !== policy.target.revision) {
        add("DQ-12", "EAC-01 execution target differs from Gate target", [node.id]);
      }
      const completed = executionTime(detail.completedAt);
      if (!Number.isFinite(completed) || completed > now) add("DQ-05", "EAC-02 invalid or future completion time", [node.id]);
      if (detail.executionMode !== "real") add("DQ-05", "EAC-06 mock execution cannot qualify", [node.id]);
      if (node.passed !== undefined && (detail.status !== "pass" && detail.status !== "fail" || node.passed !== (detail.status === "pass"))) {
        add("DQ-03", "EAC-03 passed flag contradicts execution status", [node.id]);
      }
      if (!node.evidenceRefs.length || node.evidenceRefs.some(ref => !validRef(ref as Parameters<typeof validRef>[0]) ||
        ref.revision !== detail.target.revision || ref.evidenceKind === "test_result" && executionTime(ref.capturedAt) !== completed)) {
        add("DQ-06", "EAC-05 execution evidence refs need matching revision, hash and capture time", [node.id]);
      }
      if (detail.identity.producer === "manual-bb-test-harness") {
        const ref = detail.rawArtifactRef;
        if (!node.sourceArtifactIds.includes(ref.id) || !input.metadata.inputArtifacts.some(a => a.id === ref.id && a.adapter === detail.identity.producer &&
          a.kind === "execution_evidence" && a.path === ref.path && a.contentHash === ref.contentHash && a.revision === ref.revision)) {
          add("DQ-06", "EAC-04/05 raw execution disagrees with its source artifact descriptor", [node.id, ref.id]);
        }
      }
      current.push(node);
    }
    if (globalInvalid || before !== disqualifications.length) {
      selections.push({ testId: test.id, reason: "invalid_current_evidence", consecutivePasses: 0,
        excluded: candidates.map(e => ({ evidenceId: e.id, reason: "qualification_failed" })) }); continue;
    }
    const selection = selectLatest(test.id, current, now, policy.maxEvidenceAgeHours * 3600000, excluded);
    if (selection.error) add(selection.error.includes("conflicting") ? "DQ-03" : "DQ-05", selection.error, [test.id, ...current.map(e => e.id)]);
    else if (selection.selection.selectedStatus !== "pass" && selection.selection.selectedStatus !== "fail") add("DQ-05", "EAC-06 latest execution is not completed pass/fail", [test.id]);
    selections.push(selection.selection);
    if (selection.selection.selectedStatus === "fail") {
      const failed = current.find(e => e.id === selection.selection.selectedEvidenceId)!;
      const obligationIds = new Set(input.placementPlan?.placements.filter(p => p.disposition !== "blocked" && p.selectedTestIds.includes(test.id)).map(p => p.obligationId));
      const riskIds = [...new Set([...(test.coveredRiskIds ?? []), ...(input.placementPlan?.obligations.filter(o => obligationIds.has(o.id)).flatMap(o => [...o.riskIds]) ?? [])])].sort();
      blockers.push({ id: `qeg:failed-${test.id}-${failed.id}`, message: `EAC-03 latest qualified test "${test.title}" failed`, testId: test.id,
        evidenceId: failed.id, riskIds, sourceRefs: failed.traceability.sourceRefs.length ? failed.traceability.sourceRefs : [inputSource("/graph/nodes", failed.id)] });
    }
  }
  return result();
}
