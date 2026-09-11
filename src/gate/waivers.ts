import type {
  QegNode,
  QualityEvidenceGraph,
  RiskNode,
  Waiver,
} from "../types.js";
import { timestampNanos } from "../timestamps.js";

export function validateWaiver(
  waiver: Waiver,
  graph: QualityEvidenceGraph,
  executionTime: Date | string
): { valid: boolean; invalidReason?: string } {
  const reasons: string[] = [];
  const riskIds = new Set(
    graph.nodes
      .filter((node: QegNode): node is RiskNode => node.kind === "risk")
      .map((node) => node.id)
  );

  for (const riskId of waiver.linkedRiskIds) {
    if (!riskIds.has(riskId)) {
      reasons.push(`linkedRiskId "${riskId}" does not resolve to a risk node`);
    }
  }

  if (typeof waiver.approver !== "string" || waiver.approver.trim() === "") {
    reasons.push("approver is empty");
  }
  if (!waiver.approvalAuthority || waiver.approvalAuthority.trim() === "") {
    reasons.push("approvalAuthority is empty");
  }
  if (!waiver.sourceRefs || waiver.sourceRefs.length === 0) {
    reasons.push("sourceRefs is empty (minimum 1 required)");
  }
  const expiry = timestampNanos(waiver.expiry);
  const clock = executionTime instanceof Date
    ? Number.isFinite(executionTime.valueOf()) ? BigInt(executionTime.valueOf()) * 1000000n : undefined
    : timestampNanos(executionTime);
  if (expiry === undefined || clock === undefined || expiry <= clock) {
    reasons.push(`expiry "${waiver.expiry}" is invalid or not after the evaluation time`);
  }
  if (!waiver.impactScope || waiver.impactScope.trim() === "") {
    reasons.push("impactScope is empty");
  }
  if (!waiver.rollbackOrContainment || waiver.rollbackOrContainment.trim() === "") {
    reasons.push("rollbackOrContainment is empty");
  }
  if (!waiver.followUpOwner || waiver.followUpOwner.trim() === "") {
    reasons.push("followUpOwner is empty");
  }
  if (!waiver.recheckCondition || waiver.recheckCondition.trim() === "") {
    reasons.push("recheckCondition is empty");
  }
  if (!waiver.reason || waiver.reason.trim() === "") {
    reasons.push("reason is empty");
  }

  return reasons.length > 0
    ? { valid: false, invalidReason: reasons.join("; ") }
    : { valid: true };
}
