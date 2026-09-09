import type { ChangedCodeNode, Disqualification, ExecutionEvidenceNode, GateBlocker, TestObligation, TestPlacementNode } from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import { inputSource } from "../../input-contract.js";

function relatedRiskIds(input: DQDetectorInput, changeId: string): Set<string> {
  const ids = new Set(input.placementPlan?.obligations.filter(o => o.changedCodeIds.includes(changeId)).flatMap(o => [...o.riskIds]) ?? []);
  const riskIds = new Set(input.graph.nodes.filter(n => n.kind === "risk").map(n => n.id));
  for (const edge of input.graph.edges) {
    if (edge.from === changeId && riskIds.has(edge.to)) ids.add(edge.to);
    if (edge.to === changeId && riskIds.has(edge.from)) ids.add(edge.from);
  }
  return ids;
}

function isWaived(input: DQDetectorInput, riskIds: ReadonlySet<string>): boolean {
  return riskIds.size > 0 && [...riskIds].every(id => input.validWaivers.some(w => w.linkedRiskIds.includes(id)));
}

function placementsFor(input: DQDetectorInput, obligation: TestObligation): readonly TestPlacementNode[] {
  return input.placementPlan?.placements.filter(p => p.obligationId === obligation.id && p.disposition !== "blocked") ?? [];
}

export function detectPlacementCoverage(input: DQDetectorInput, changes: readonly ChangedCodeNode[]): Disqualification[] {
  const result: Disqualification[] = [];
  for (const change of changes) {
    const obligations = input.placementPlan?.obligations.filter(o => o.changedCodeIds.includes(change.id)) ?? [];
    const covered = obligations.length > 0 && obligations.every(o => placementsFor(input, o).length > 0);
    if (!covered && !isWaived(input, relatedRiskIds(input, change.id))) result.push({
      code: "DQ-05", message: `Changed code "${change.path}" without test obligation or waiver`, nodeIds: [change.id],
      sourceRefs: change.traceability.sourceRefs.length > 0 ? change.traceability.sourceRefs : [inputSource("/placementPlan", `Coverage for ${change.id}`)],
    });
  }
  return result;
}

function matchingExecutions(input: DQDetectorInput, testId: string): readonly ExecutionEvidenceNode[] {
  const linked = new Set(input.graph.edges.filter(e => e.kind === "evidenced_by" && e.from === testId).map(e => e.to));
  return input.graph.nodes.filter((n): n is ExecutionEvidenceNode => n.kind === "execution_evidence" &&
    ((n.evidenceType === "resilience" && n.testId === testId) || (n.evidenceType !== "resilience" && linked.has(n.id))));
}

export function evaluateRequiredExecutions(input: DQDetectorInput): { disqualifications: Disqualification[]; blockers: GateBlocker[] } {
  const disqualifications: Disqualification[] = [];
  const blockers: GateBlocker[] = [];
  if (!input.policy.inputContract?.requireExecutedTests) return { disqualifications, blockers };
  for (const risk of input.graph.nodes.filter(n => n.kind === "risk")) {
    if (!isWaived(input, new Set([risk.id])) && !input.placementPlan?.obligations.some(o => o.riskIds.includes(risk.id) && o.gateRelevance === "blocking")) {
      disqualifications.push({ code: "DQ-05", message: `Risk "${risk.id}" has no blocking test obligation`, nodeIds: [risk.id],
        sourceRefs: risk.traceability.sourceRefs.length ? risk.traceability.sourceRefs : [inputSource("/placementPlan", risk.id)] });
    }
  }
  for (const obligation of input.placementPlan?.obligations ?? []) {
    if (obligation.gateRelevance !== "blocking" || isWaived(input, new Set(obligation.riskIds))) continue;
    const selectedIds = [...new Set(placementsFor(input, obligation).flatMap(p => [...p.selectedTestIds]))];
    const tests = selectedIds.map(id => input.graph.nodes.find(n => n.id === id && n.kind === "test"));
    let missing = selectedIds.length === 0;
    for (const test of tests) {
      if (!test || test.kind !== "test" || test.deleted || test.testExecutionMode !== "real") { missing = true; continue; }
      // Resilienceのlatest/qualificationは専用evaluatorが担当し、legacy成功へfallbackしない。
      if (test.testType === "resilience") continue;
      const evidence = matchingExecutions(input, test.id);
      if (evidence.length === 0 || evidence.some(e => e.passed === undefined || e.evidenceRefs.length === 0)) missing = true;
      for (const failed of evidence.filter(e => e.passed === false)) blockers.push({
        id: `qeg:failed-${obligation.id}-${test.id}-${failed.id}`, message: `Required test "${test.title}" failed`,
        riskIds: obligation.riskIds, testId: test.id, evidenceId: failed.id,
        sourceRefs: failed.traceability.sourceRefs.length > 0 ? failed.traceability.sourceRefs : [inputSource("/graph/nodes", failed.id)],
      });
    }
    if (missing) disqualifications.push({ code: "DQ-05", message: `Obligation "${obligation.id}" lacks required real execution evidence`,
      nodeIds: [obligation.id, ...selectedIds], sourceRefs: [inputSource("/placementPlan", obligation.id)] });
  }
  return { disqualifications, blockers };
}
