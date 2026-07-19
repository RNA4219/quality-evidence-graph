import type {
  Disqualification,
  GateBlocker,
  GatePolicy,
  GateVerdict,
  StableId,
  Waiver,
} from "../types.js";

export { computeBlockers } from "./verdict/blockers.js";
export { computeRequiredHumanReview } from "./verdict/human-review.js";
export { buildReasons } from "./verdict/reasons.js";
export { computeResidualRisks } from "./verdict/residual-risks.js";

export function computeVerdict(
  disqualifications: readonly Disqualification[],
  blockers: readonly GateBlocker[],
  residualRisks: readonly StableId[],
  requiredHumanReview: readonly StableId[],
  validWaivers: readonly Waiver[]
): GateVerdict {
  if (disqualifications.length > 0) {
    return "disqualified";
  }

  if (blockers.some((blocker) => blocker.effective !== false)) {
    return "no_go";
  }

  if (validWaivers.length > 0 || residualRisks.length > 0 || requiredHumanReview.length > 0) {
    return "conditional_go";
  }

  return "go";
}

export function getExitCode(verdict: GateVerdict, policy: GatePolicy): number {
  return policy.exitCodePolicy[verdict];
}
