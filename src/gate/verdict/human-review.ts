import type { QegNode, QualityEvidenceGraph, RiskNode, StableId, Waiver } from "../../types.js";

export function computeRequiredHumanReview(
  graph: QualityEvidenceGraph,
  validWaivers: readonly Waiver[],
  residualRisks: readonly StableId[]
): StableId[] {
  const required: StableId[] = [];

  for (const waiver of validWaivers) {
    required.push(waiver.id);
  }

  for (const riskId of residualRisks) {
    required.push(riskId);
  }

  for (const node of graph.nodes) {
    if (isLowConfidenceRisk(node)) {
      required.push(node.id);
    }
  }

  return required;
}

function isLowConfidenceRisk(node: QegNode): node is RiskNode {
  return node.kind === "risk" && node.traceability.confidence === "low";
}
