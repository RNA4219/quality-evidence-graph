import type { GateBlocker, QegNode, QualityEvidenceGraph, RiskNode, Waiver } from "../../types.js";
import { buildBlockers } from "../context.js";

export function computeBlockers(
  graph: QualityEvidenceGraph,
  validWaivers: readonly Waiver[]
): GateBlocker[] {
  void validWaivers;
  const riskNodes = graph.nodes.filter((node: QegNode): node is RiskNode => node.kind === "risk");
  return buildBlockers(riskNodes);
}
