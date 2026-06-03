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
import type { GatePolicy } from "./gate.js";

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
  readonly evidenceKind:
    | "code"
    | "spec"
    | "test_result"
    | "coverage"
    | "sarif"
    | "human_review"
    | "audit"
    | "policy";
  readonly capturedAt?: IsoDateTime;
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
  readonly waivers: readonly Waiver[];
  readonly approvalEvidence: readonly ApprovalEvidence[];
  readonly manualEvidence: readonly ManualEvidenceItem[];
  readonly retention: Retention;
  readonly sourceRefs: readonly SourceRef[];
  readonly phase: PackagePhase;
  readonly evidencePackageHash: string;
  readonly controlRoles?: ControlRoles;
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
  readonly workflowRefs?: readonly WorkflowCookbookRef[];
  readonly benchmarkMode?: boolean;
  readonly hiddenOracleAccessed?: boolean;
  readonly requiredConnectorStatus?: {
    readonly "manual-bb-test-harness": "success" | "contract_violation";
    readonly "code-to-gate": "success" | "contract_violation";
    readonly "RanD": "success" | "contract_violation";
  };
}
