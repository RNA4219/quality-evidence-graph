import type { QegNode, QualityEvidenceGraph, RiskNode, StableId, TestPlacementPlan, Waiver } from "../../types.js";
import { allTestPlacements, isRetiredManualTest } from "../../placement-contract.js";

export function computeRequiredHumanReview(
  graph: QualityEvidenceGraph,
  validWaivers: readonly Waiver[],
  residualRisks: readonly StableId[],
  placementPlan?: TestPlacementPlan
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

  const manualTests = new Set(allTestPlacements(graph, placementPlan)
    .filter(placement => placement.primaryLayer === "manual-scripted")
    .flatMap(placement => [...placement.selectedTestIds]));
  for (const node of graph.nodes) {
    if (node.kind === "test" && node.testType !== "resilience" && node.oracleType === "human" && manualTests.has(node.id) && !isRetiredManualTest(node, placementPlan)) required.push(node.id);
  }

  return [...new Set(required)];
}

function isLowConfidenceRisk(node: QegNode): node is RiskNode {
  return node.kind === "risk" && node.traceability.confidence === "low";
}
