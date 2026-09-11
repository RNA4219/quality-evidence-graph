import type { EvidencePackage, StableId } from "../types.js";

/** Preparation go is scoped to preparation; review/release decisions cannot infer affirmative approval. */
export function pendingPackageReview(evidencePackage: EvidencePackage | undefined): StableId[] {
  if (!evidencePackage || evidencePackage.phase === "implementation_preparation") return [];
  const approvals = evidencePackage.approvalEvidence;
  if (!Array.isArray(approvals)) return [evidencePackage.id];
  if (evidencePackage.phase === "pre_release_review" && approvals.length === 0) return [evidencePackage.id];
  // Hash/source validity is independently enforced by DQ-15. Other human decisions remain recorded, never promoted to go.
  if (approvals.some(approval => typeof approval?.approvedDecision !== "string" || approval.approvedDecision.trim() !== "go")) return [evidencePackage.id];
  return [];
}
