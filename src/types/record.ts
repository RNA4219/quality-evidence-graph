import type { ArtifactRef } from "./evidence.js";
import type { GateResult } from "./gate.js";
import type { QualityEvidenceGraph, TestPlacementPlan } from "./graph.js";
import type { QegMetadata } from "./evidence.js";

export interface QualityEvidenceRecord {
  readonly metadata: QegMetadata;
  readonly graph: QualityEvidenceGraph;
  readonly placementPlan: TestPlacementPlan;
  readonly gate: GateResult;
  readonly exports: readonly ExportRef[];
  readonly auditTrail?: AuditTrail;
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
