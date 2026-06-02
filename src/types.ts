export type QegVersion = "0.1";

export type StableId = string;

export type IsoDateTime = string;

export type Confidence = "low" | "medium" | "high";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Priority = "P0" | "P1" | "P2" | "P3";

export type GateProfile = "lean" | "standard" | "strict" | "ipo_controlled";

export type GateVerdict = "go" | "conditional_go" | "no_go" | "disqualified";

export type PlacementLayer =
  | "unit"
  | "integration"
  | "system"
  | "e2e"
  | "manual-scripted"
  | "manual-exploratory"
  | "spec-clarification";

export type PlacementDisposition =
  | "reuse"
  | "adapt"
  | "add"
  | "manual-only"
  | "blocked";

export type GateRelevance = "informational" | "advisory" | "blocking";

export type NodeKind =
  | "requirement"
  | "acceptance_criteria"
  | "risk"
  | "failure_mode"
  | "changed_code"
  | "finding"
  | "test"
  | "test_placement"
  | "execution_evidence"
  | "gate_verdict"
  | "waiver"
  | "policy"
  | "acceptance_record";

export type EdgeKind =
  | "derives_from"
  | "satisfies"
  | "risks"
  | "manifests_as"
  | "touches"
  | "supports"
  | "contradicts"
  | "requires_test"
  | "placed_at"
  | "evidenced_by"
  | "waived_by"
  | "governed_by"
  | "decides";

export type AdapterKind =
  | "manual-bb-test-harness"
  | "code-to-gate"
  | "RanD"
  | "junit"
  | "coverage"
  | "sarif"
  | "git-diff"
  | "qeg-native";

export type RequiredAdapterKind =
  | "manual-bb-test-harness"
  | "code-to-gate"
  | "RanD";

export type WorkflowCookbookRefKind =
  | "birdseye-index"
  | "birdseye-capsule"
  | "task-seed"
  | "acceptance-template";

export type ArtifactKind =
  | "phase_contract"
  | "feature_spec"
  | "test_model"
  | "observation_set"
  | "risk_register"
  | "manual_case_set"
  | "effort_plan"
  | "gate_decision"
  | "release_brief"
  | "execution_evidence"
  | "normalized_repo_graph"
  | "diff_analysis"
  | "findings"
  | "invariants"
  | "test_seeds"
  | "release_readiness"
  | "audit"
  | "requirements_packet"
  | "requirements_audit_packet"
  | "junit"
  | "coverage"
  | "sarif"
  | "git_diff"
  | "quality_evidence_record";

export type DisqualificationCode =
  | "DQ-01"
  | "DQ-02"
  | "DQ-03"
  | "DQ-04"
  | "DQ-05"
  | "DQ-06"
  | "DQ-07"
  | "DQ-08"
  | "DQ-09"
  | "DQ-10"
  | "DQ-11"
  | "DQ-12"
  | "DQ-13"
  | "DQ-14"
  | "DQ-15"
  | "DQ-16"
  | "DQ-17";

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

export interface Traceability {
  readonly sourceRefs: readonly SourceRef[];
  readonly assumptions: readonly string[];
  readonly confidence: Confidence;
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
  readonly profile: GateProfile;
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
  readonly residualRisks: readonly StableId[];
}

export interface WaiverNode extends QegNodeBase {
  readonly kind: "waiver";
  readonly linkedRiskIds: readonly StableId[];
  readonly approver: string;
  readonly reason: string;
  readonly expiresAt: IsoDateTime;
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
  readonly reviewedAt?: IsoDateTime;
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

export interface Disqualification {
  readonly code: DisqualificationCode;
  readonly message: string;
  readonly nodeIds: readonly StableId[];
  readonly sourceRefs: readonly SourceRef[];
}

export interface GateBlocker {
  readonly id: StableId;
  readonly message: string;
  readonly riskIds: readonly StableId[];
  readonly sourceRefs: readonly SourceRef[];
}

export interface GateResult {
  readonly metadata: QegMetadata;
  readonly verdict: GateVerdict;
  readonly reasons: readonly string[];
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
  readonly residualRisks: readonly StableId[];
  readonly requiredHumanReview: readonly StableId[];
}

export interface QualityEvidenceGraph {
  readonly metadata: QegMetadata;
  readonly nodes: readonly QegNode[];
  readonly edges: readonly QegEdge[];
  readonly completeness: GraphCompleteness;
}

export interface GraphCompleteness {
  readonly score: number;
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

export interface QualityEvidenceRecord {
  readonly metadata: QegMetadata;
  readonly graph: QualityEvidenceGraph;
  readonly placementPlan: TestPlacementPlan;
  readonly gate: GateResult;
  readonly exports: readonly ExportRef[];
}

export interface ExportRef {
  readonly kind: "json" | "markdown" | "graphml" | "sarif";
  readonly path: string;
  readonly contentHash?: string;
}
