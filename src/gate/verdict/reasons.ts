import type { Disqualification, GateBlocker, GateVerdict, StableId, Waiver } from "../../types.js";

export function buildReasons(
  verdict: GateVerdict,
  disqualifications: readonly Disqualification[],
  blockers: readonly GateBlocker[],
  residualRisks: readonly StableId[],
  requiredHumanReview: readonly StableId[],
  validWaivers: readonly Waiver[]
): string[] {
  const reasons: string[] = [];

  appendDisqualifications(reasons, disqualifications);
  appendBlockers(reasons, blockers);

  if (validWaivers.length > 0) {
    reasons.push(`Valid waivers: ${validWaivers.length} (conditional_go required)`);
  }
  if (residualRisks.length > 0) {
    reasons.push(`Residual risks: ${residualRisks.length}`);
  }
  if (requiredHumanReview.length > 0) {
    reasons.push(`Required human review: ${requiredHumanReview.length}`);
  }
  if (verdict === "go") {
    reasons.push("All gate conditions satisfied");
  }

  return reasons;
}

function appendDisqualifications(
  reasons: string[],
  disqualifications: readonly Disqualification[]
): void {
  if (disqualifications.length === 0) return;

  reasons.push(`Disqualified: ${disqualifications.length} DQ code(s)`);
  for (const dq of disqualifications) {
    reasons.push(`- ${dq.code}: ${dq.message}`);
  }
}

function appendBlockers(reasons: string[], blockers: readonly GateBlocker[]): void {
  if (blockers.length === 0) return;

  reasons.push(`No-go blockers: ${blockers.length}`);
  for (const blocker of blockers) {
    reasons.push(`- ${blocker.message}`);
  }
}
