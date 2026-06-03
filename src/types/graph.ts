import type {
  Confidence,
  EdgeKind,
  GateRelevance,
  GateVerdict,
  NodeKind,
  PlacementDisposition,
  PlacementLayer,
  Priority,
  Severity,
  StableId,
} from "./primitives.js";
import type { EvidenceRef, QegMetadata, SourceRef } from "./evidence.js";
import type { Disqualification, GateBlocker } from "./gate.js";

export interface Traceability {
  readonly sourceRefs: readonly SourceRef[];
  readonly assumptions: readonly string[];
  readonly confidence: Confidence;
}

export interface QegNodeBase {
  readonly id: StableId;
  readonly kind: NodeKind;
  readonly title: string;
  readonly traceability: Traceability;
  readonly sourceArtifactIds: readonly StableId[];
}

export interface RequirementNode extends QegNodeBase {
  readonly kind: "requirement";
  readonly priority?: Priority;
  readonly acceptanceCriteriaIds: readonly StableId[];
}

export interface AcceptanceCriteriaNode extends QegNodeBase {
  readonly kind: "acceptance_criteria";
  readonly requirementIds: readonly StableId[];
  readonly oracleRefs: readonly EvidenceRef[];
}

export interface RiskNode extends QegNodeBase {
  readonly kind: "risk";
  readonly priority: Priority;
  readonly severity: Severity;
  readonly likelihood: number;
  readonly businessImpact: number;
  readonly complianceCriticality: number;
  readonly evidenceGap: number;
  readonly novelty: number;
}

export interface FailureModeNode extends QegNodeBase {
  readonly kind: "failure_mode";
  readonly riskIds: readonly StableId[];
  readonly observableSignals: readonly string[];
}

export interface ChangedCodeNode extends QegNodeBase {
  readonly kind: "changed_code";
  readonly path: string;
  readonly language?: string;
  readonly symbols: readonly string[];
  readonly hunks: readonly SourceRef[];
  readonly blastRadius: number;
}

export interface FindingNode extends QegNodeBase {
  readonly kind: "finding";
  readonly severity: Severity;
  readonly ruleId?: string;
  readonly changedCodeIds: readonly StableId[];
}

export interface TestNode extends QegNodeBase {
  readonly kind: "test";
  readonly layer: PlacementLayer;
  readonly command?: string;
  readonly existing: boolean;
}

export interface TestPlacementNode extends QegNodeBase {
  readonly kind: "test_placement";
  readonly obligationId: StableId;
  readonly primaryLayer: PlacementLayer;
  readonly disposition: PlacementDisposition;
  readonly gateRelevance: GateRelevance;
  readonly candidateScores: readonly PlacementCandidateScore[];
  readonly selectedTestIds: readonly StableId[];
}

export interface ExecutionEvidenceNode extends QegNodeBase {
  readonly kind: "execution_evidence";
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly passed?: boolean;
}

export interface GateVerdictNode extends QegNodeBase {
  readonly kind: "gate_verdict";
  readonly verdict: GateVerdict;
  readonly profile: import("./primitives.js").GateProfile;
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
  readonly residualRisks: readonly StableId[];
}

export interface WaiverNode extends QegNodeBase {
  readonly kind: "waiver";
  readonly linkedRiskIds: readonly StableId[];
  readonly approver: string;
  readonly reason: string;
  readonly expiresAt: string;
}

export interface PolicyNode extends QegNodeBase {
  readonly kind: "policy";
  readonly policyId: string;
  readonly policyHash: string;
}

export interface AcceptanceRecordNode extends QegNodeBase {
  readonly kind: "acceptance_record";
  readonly acceptanceId: StableId;
  readonly taskId?: StableId;
  readonly status: "draft" | "active" | "reviewing" | "done";
  readonly reviewedBy?: string;
  readonly reviewedAt?: string;
}

export type QegNode =
  | RequirementNode
  | AcceptanceCriteriaNode
  | RiskNode
  | FailureModeNode
  | ChangedCodeNode
  | FindingNode
  | TestNode
  | TestPlacementNode
  | ExecutionEvidenceNode
  | GateVerdictNode
  | WaiverNode
  | PolicyNode
  | AcceptanceRecordNode;

export interface QegEdge {
  readonly id: StableId;
  readonly kind: EdgeKind;
  readonly from: StableId;
  readonly to: StableId;
  readonly traceability: Traceability;
}

export interface PlacementCandidateScore {
  readonly layer: PlacementLayer;
  readonly eligible: boolean;
  readonly finalScore: number;
  readonly fit: LayerFitScore;
  readonly costPenalty: LayerCostPenalty;
  readonly rationale: readonly string[];
  readonly sourceRefs: readonly SourceRef[];
}

export interface LayerFitScore {
  readonly oracleFit: number;
  readonly changeProximity: number;
  readonly interactionFit: number;
  readonly businessFidelity: number;
  readonly observability: number;
  readonly stability: number;
  readonly reuseGain: number;
}

export interface LayerCostPenalty {
  readonly setupCost: number;
  readonly runtimeCost: number;
  readonly flakeRisk: number;
}

export interface TestObligation {
  readonly id: StableId;
  readonly requirementIds: readonly StableId[];
  readonly riskIds: readonly StableId[];
  readonly failureModeIds: readonly StableId[];
  readonly changedCodeIds: readonly StableId[];
  readonly priority: Priority;
  readonly riskPriorityIndex: number;
  readonly gateRelevance: GateRelevance;
  readonly traceability: Traceability;
}

export interface TestPlacementPlan {
  readonly metadata: QegMetadata;
  readonly obligations: readonly TestObligation[];
  readonly placements: readonly TestPlacementNode[];
}

export interface QualityEvidenceGraph {
  readonly metadata: QegMetadata;
  readonly nodes: readonly QegNode[];
  readonly edges: readonly QegEdge[];
  readonly completeness: GraphCompleteness;
}

export interface GraphCompleteness {
  readonly score: number | undefined;
  readonly partial: boolean;
  readonly parserFailures: readonly ParserFailure[];
  readonly unsupportedClaims: readonly UnsupportedClaim[];
}

export interface ParserFailure {
  readonly path: string;
  readonly reason: string;
  readonly sourceRefs: readonly SourceRef[];
}

export interface UnsupportedClaim {
  readonly id: StableId;
  readonly claim: string;
  readonly nodeIds: readonly StableId[];
  readonly gateRelevant: boolean;
}
