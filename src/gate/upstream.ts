import type { Disqualification, GateBlocker, QualityEvidenceGraph } from "../types.js";

export function upstreamDecisions(graph: QualityEvidenceGraph): { disqualifications: Disqualification[]; blockers: GateBlocker[]; humanReview: string[] } {
  const disqualifications: Disqualification[] = [];
  const blockers: GateBlocker[] = [];
  const humanReview: string[] = [];
  for (const node of graph.nodes) {
    if (node.kind !== "gate_verdict") continue;
    if (node.verdict === "disqualified") disqualifications.push({ code: "DQ-11", message: `Upstream decision is disqualified: ${node.title}`,
      nodeIds: [node.id], sourceRefs: node.traceability.sourceRefs });
    if (node.verdict === "no_go") blockers.push({ id: `qeg:upstream-${node.id}`, message: `Upstream decision is no_go: ${node.title}`,
      riskIds: [], sourceRefs: node.traceability.sourceRefs });
    if (node.verdict === "conditional_go") humanReview.push(node.id);
  }
  return { disqualifications, blockers, humanReview };
}
