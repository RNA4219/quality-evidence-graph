import type { GateResult } from "./gate.js";
import type { QualityEvidenceGraph, TestPlacementPlan } from "./graph.js";
import type { EvidenceRef, QegMetadata, SourceRef } from "./evidence.js";
import type { Severity, StableId } from "./primitives.js";

export interface QualityEvidenceRecord {
  readonly metadata: QegMetadata;
  readonly graph: QualityEvidenceGraph;
  readonly placementPlan: TestPlacementPlan;
  readonly gate: GateResult;
  readonly exports: readonly ExportRef[];
  readonly auditTrail?: AuditTrail;
  readonly gateEfficacyRecords?: readonly GateEfficacyRecord[];
  readonly recalibrationProposals?: readonly RecalibrationProposal[];
}

export interface AuditTrail {
  readonly evidencePackageHash: string;
  readonly approvalEvidenceSummary: readonly ApprovalEvidenceSummary[];
  readonly gatePolicyHash: string;
  readonly gatePolicyId: string;
}

export interface ApprovalEvidenceSummary {
  readonly id: string;
  readonly approver: string;
  readonly approvedAt: string;
  readonly policyId: string;
  readonly policyHash: string;
  readonly evidencePackageHash: string;
}

export interface ExportRef {
  readonly kind: "json" | "markdown" | "graphml" | "sarif";
  readonly path: string;
  readonly contentHash?: string;
}

export interface EscapedDefectEvidence {
  readonly id: StableId;
  readonly title: string;
  readonly severity: Severity;
  readonly discoveredAt: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly verdictRef?: StableId;
  readonly placementPlanRef?: StableId;
  readonly evidenceRefs?: readonly StableId[];
  readonly affectedPolicyRefs?: readonly StableId[];
  readonly affectedPlacementRefs?: readonly StableId[];
  readonly analysisNotes?: string;
}

export interface EscapedDefectBacklink {
  readonly id: StableId;
  readonly title: string;
  readonly severity: Severity;
  readonly discoveredAt: string;
  readonly linkedVerdictRef: StableId;
  readonly linkedPlacementPlanRef: StableId;
  readonly linkedEvidenceRefs: readonly StableId[];
  readonly sourceRefs: readonly SourceRef[];
}

export interface GateEfficacyRecord {
  readonly verdict_ref: StableId;
  readonly escaped_defects: readonly EscapedDefectBacklink[];
  readonly evidence_used: readonly StableId[];
  readonly policy_hash_at_verdict: string;
  readonly analysis_notes: string;
}

export interface RecalibrationProposal {
  readonly id: StableId;
  readonly scope: "policy" | "placement";
  readonly targetRef: StableId;
  readonly reason: string;
  readonly escapedDefectRefs: readonly StableId[];
  readonly status: "proposed";
  readonly sourceRefs: readonly SourceRef[];
}

export interface OptionalEvidence {
  readonly escapedDefects?: readonly EscapedDefectEvidence[];
  readonly evidenceRefs?: readonly EvidenceRef[];
}
