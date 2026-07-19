import type {
  AdapterKind,
  ArtifactKind,
  GateProfile,
  IsoDateTime,
  PackagePhase,
  QegVersion,
  StorageClassification,
  StableId,
  WorkflowCookbookRefKind,
} from "./primitives.js";
import type { GatePolicy, GatePolicyProposal } from "./gate.js";

export interface SourceRef {
  readonly id: StableId;
  readonly path: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly excerptHash?: string;
  readonly revision?: string;
  readonly label?: string;
}

export interface EvidenceRef extends SourceRef {
  readonly evidenceKind: EvidenceKind;
  readonly contentHash?: string;
  readonly capturedAt?: IsoDateTime;
}

export type EvidenceKind =
  | "code"
  | "spec"
  | "test_result"
  | "coverage"
  | "sarif"
  | "human_review"
  | "audit"
  | "policy"
  | "observability_metric"
  | "observability_trace"
  | "observability_log";

/** Hash-backed observability artifact referenced by resilience signal entries. */
export interface SignalEvidenceRef extends EvidenceRef {
  readonly evidenceKind: "observability_metric" | "observability_trace" | "observability_log";
  readonly contentHash: string;
  readonly capturedAt: IsoDateTime;
  readonly revision: string;
}

export interface ArtifactRef {
  readonly id: StableId;
  readonly adapter: AdapterKind;
  readonly kind: ArtifactKind;
  readonly path: string;
  readonly schemaId?: string;
  readonly contentHash?: string;
  readonly revision?: string;
}

export type ProducerReadinessStatus =
  | "passed"
  | "passed_with_risk"
  | "needs_review"
  | "blocked_input"
  | "failed"
  | "unknown";

export type ProducerCheckConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "timed_out"
  | "action_required"
  | "skipped"
  | "unknown";

export interface ProducerCheckRef {
  readonly id: StableId;
  readonly producer: AdapterKind | string;
  readonly name: string;
  readonly conclusion: ProducerCheckConclusion;
  readonly readinessStatus?: ProducerReadinessStatus;
  readonly headSha?: string;
  readonly runId?: string;
  readonly url?: string;
  readonly sourceRefs?: readonly SourceRef[];
}

export interface WorkflowCookbookRef {
  readonly id: StableId;
  readonly kind: WorkflowCookbookRefKind;
  readonly path: string;
  readonly nodeId?: string;
  readonly contentHash?: string;
}

export interface Waiver {
  readonly id: StableId;
  readonly linkedRiskIds: readonly StableId[];
  /** Required when waiving BLK-REL-01 through BLK-REL-03. */
  readonly linkedTestIds?: readonly StableId[];
  readonly approver: string;
  readonly approvalAuthority: string;
  readonly reason: string;
  readonly expiry: IsoDateTime;
  readonly impactScope: string;
  readonly rollbackOrContainment: string;
  readonly followUpOwner: string;
  readonly recheckCondition: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly valid?: boolean;
  readonly invalidReason?: string;
}

export interface ApprovalEvidence {
  readonly id: StableId;
  readonly approver: string;
  readonly roleOrAuthority: string;
  readonly approvedDecision: string;
  readonly approvedAt: IsoDateTime;
  readonly policyId: string;
  readonly policyHash: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly evidencePackageHash: string;
}

export interface ControlRoles {
  readonly producer: string;
  readonly reviewer: string;
  readonly approver: string;
  readonly waiverApprover: string;
  readonly releaseOwner: string;
}

export interface Retention {
  readonly retentionPeriod: string;
  readonly retentionOwner: string;
  readonly storageLocation: string;
  readonly contentHash: string;
  readonly capturedAt: IsoDateTime;
  readonly tamperEvidence: string;
  readonly reverificationMethod: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly storageClassification: StorageClassification;
}

export interface ManualEvidenceItem {
  readonly executedCaseId: StableId;
  readonly result: "pass" | "fail" | "blocked" | "skipped";
  readonly expectedResult: string;
  readonly oracleRefs: readonly EvidenceRef[];
  readonly traceTo: readonly StableId[];
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly reviewerNote?: string;
}

export interface QegOutputRefs {
  readonly qegBundle: ArtifactRef;
  readonly testPlacementPlan: ArtifactRef;
  readonly gateVerdict: ArtifactRef;
  readonly qualityEvidenceRecord: ArtifactRef;
  readonly markdownSummary?: ArtifactRef;
}

export interface EvidencePackage {
  readonly id: StableId;
  readonly createdAt: IsoDateTime;
  readonly createdBy: string;
  readonly inputArtifactHashes: readonly ArtifactRef[];
  readonly qegOutputs: QegOutputRefs;
  readonly gatePolicy: GatePolicy;
  readonly gatePolicyProposals?: readonly GatePolicyProposal[];
  readonly waivers: readonly Waiver[];
  readonly approvalEvidence: readonly ApprovalEvidence[];
  readonly manualEvidence: readonly ManualEvidenceItem[];
  readonly retention: Retention;
  readonly sourceRefs: readonly SourceRef[];
  readonly phase: PackagePhase;
  readonly evidencePackageHash: string;
  readonly controlRoles?: ControlRoles;
  readonly notes?: string;
}

export interface QegMetadata {
  readonly qegVersion: QegVersion;
  readonly runId: StableId;
  readonly createdAt: IsoDateTime;
  readonly baseRef?: string;
  readonly headRef?: string;
  readonly repoRoot?: string;
  readonly profile: GateProfile;
  readonly policyId?: string;
  readonly policyHash?: string;
  readonly inputArtifacts: readonly ArtifactRef[];
  readonly producerChecks?: readonly ProducerCheckRef[];
  readonly workflowRefs?: readonly WorkflowCookbookRef[];
  readonly benchmarkMode?: boolean;
  readonly hiddenOracleAccessed?: boolean;
  readonly requiredConnectorStatus?: Readonly<Record<string, "success" | "contract_violation">>;
}
