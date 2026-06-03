import type { StableId } from "../../types.js";
import type { GateEvaluationContext } from "../context.js";

export function computeResidualRisks(context: GateEvaluationContext): StableId[] {
  const residualRisks: StableId[] = [];

  for (const risk of context.riskNodes) {
    if (context.waiverRiskIds.has(risk.id)) {
      residualRisks.push(risk.id);
      continue;
    }

    if (risk.severity !== "critical" && risk.severity !== "high" && risk.evidenceGap <= 0.5) {
      residualRisks.push(risk.id);
    }
  }

  return residualRisks;
}
