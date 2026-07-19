import type {
  Confidence,
  EdgeKind,
  GateRelevance,
  GateVerdict,
  NodeKind,
  PlacementChangeLayer,
  PlacementDisposition,
  PlacementLayer,
  Priority,
  ResilienceAdapter,
  ResilienceEnvironment,
  ResilienceEvidenceStatus,
  ResilienceFaultModel,
  Severity,
  SignalAggregation,
  SignalPhase,
  SignalSemanticRole,
  StableId,
  TestType,
  TestExecutionMode,
  ThresholdOperator,
  AbortSignalSource,
} from "./primitives.js";
import type { EvidenceRef, QegMetadata, SignalEvidenceRef, SourceRef } from "./evidence.js";
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

export interface ResilienceSloTargetMax {
  readonly targetType: "max";
  readonly value: number;
}

export interface ResilienceSloTargetMin {
  readonly targetType: "min";
  readonly value: number;
}

export interface ResilienceSloTargetRange {
  readonly targetType: "range";
  readonly min: number;
  readonly max: number;
}

export type ResilienceSloTarget = ResilienceSloTargetMax | ResilienceSloTargetMin | ResilienceSloTargetRange;

export interface ResilienceSlo {
  readonly name: string;
  readonly metricName: string;
  readonly semanticRole: SignalSemanticRole;
  readonly customSemanticRoleName?: string;
  readonly aggregation: SignalAggregation;
  readonly unit: string;
  readonly evaluationPhases: readonly Extract<SignalPhase, "steady_state" | "fault" | "recovery">[];
  readonly target: ResilienceSloTarget;
}

export interface ResilienceSteadyState {
  readonly slos: readonly ResilienceSlo[];
  readonly requiredMetrics: readonly string[];
  readonly requiredTraces: boolean;
  readonly requiredLogs: boolean;
}

export interface ResilienceBlastRadius {
  readonly environment: ResilienceEnvironment;
  readonly allowedTargets: readonly string[];
  readonly maxTargets: number;
  readonly maxDurationSeconds: number;
}

export interface ResilienceAbortCondition {
  readonly id: StableId;
  readonly source: AbortSignalSource;
  readonly signal: string;
  readonly aggregation: SignalAggregation;
  readonly operator: ThresholdOperator;
  readonly threshold: number;
  readonly unit: string;
}

export interface ResilienceScenario {
  readonly faultModel: ResilienceFaultModel;
  readonly customFaultModelName?: string;
  readonly steadyState: ResilienceSteadyState;
  readonly blastRadius: ResilienceBlastRadius;
  readonly abortConditions: readonly ResilienceAbortCondition[];
}

export interface TestNode extends QegNodeBase {
  readonly kind: "test";
  readonly layer: PlacementLayer;
  /** Mock executions are auditable but never count as Gate evidence. */
  readonly testExecutionMode: TestExecutionMode;
  readonly command?: string;
  readonly existing: boolean;
  readonly evidenceStrength?: number;
  readonly recentGreenRuns?: number;
  readonly coveredRiskIds?: readonly StableId[];
  readonly deleted?: boolean;
  readonly testType?: TestType;
  readonly resilienceScenario?: ResilienceScenario;
}

export interface ResilienceTestNode extends TestNode {
  readonly testType: "resilience";
  readonly resilienceScenario: ResilienceScenario;
  readonly coveredRiskIds: readonly StableId[];
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
  readonly evidenceType?: "resilience";
}

export interface ResilienceRawArtifactRef {
  readonly id: StableId;
  readonly path: string;
  readonly contentHash: string;
  readonly revision: string;
}

export interface ResilienceFault {
  readonly type: ResilienceFaultModel;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly faultStartedAt: string;
  readonly faultEndedAt: string;
  readonly actualTargetIds: readonly string[];
  readonly appliedDurationMs: number;
}

export interface ResilienceAbortRecord {
  readonly conditionId: StableId;
  readonly signalEntryId: StableId;
  readonly triggeredAt: string;
  readonly observedValue: number;
  readonly unit: string;
}

export interface ResilienceObserved {
  readonly requestCount: number;
  readonly errorRate: number;
  readonly latencyP95Ms: number;
  readonly saturationPct: number;
  readonly duplicateSideEffects: number;
  readonly dataInconsistencies: number;
}

export interface MetricSignalEntry {
  readonly id: StableId;
  readonly phase: SignalPhase;
  readonly metricName: string;
  readonly semanticRole: SignalSemanticRole;
  readonly customSemanticRoleName?: string;
  readonly aggregation: SignalAggregation;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly observedValue: number;
  readonly unit: string;
  readonly evidenceRefId: StableId;
}

export interface TraceOrLogSignalEntry {
  readonly id: StableId;
  readonly signalName: string;
  readonly phase: SignalPhase;
  readonly querySummary: string;
  readonly matchedCount: number;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly evidenceRefId: StableId;
}

export interface SignalManifest {
  readonly metrics: readonly MetricSignalEntry[];
  readonly traces: readonly TraceOrLogSignalEntry[];
  readonly logs: readonly TraceOrLogSignalEntry[];
}

export interface ResilienceExecutionEvidenceNode extends ExecutionEvidenceNode {
  readonly evidenceType: "resilience";
  readonly testId: StableId;
  readonly adapter: ResilienceAdapter;
  readonly adapterVersion: string;
  readonly customAdapterName?: string;
  readonly normalizationVersion: "qeg-resilience-evidence-v1";
  readonly experimentId: StableId;
  readonly attempt: number;
  readonly rawArtifactRef: ResilienceRawArtifactRef;
  readonly targetRevision: string;
  readonly environment: ResilienceEnvironment;
  readonly environmentId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly status: ResilienceEvidenceStatus;
  readonly steadyStateConfirmed?: boolean;
  readonly fault?: ResilienceFault;
  readonly abortRecord?: ResilienceAbortRecord;
  readonly recovered?: boolean;
  readonly recoveryConfirmedAt?: string;
  readonly recoveryDurationMs?: number;
  readonly observed?: ResilienceObserved;
  readonly signalManifest?: SignalManifest;
  readonly evidenceRefs: readonly (EvidenceRef | SignalEvidenceRef)[];
}

export interface GateVerdictNode extends QegNodeBase {
  readonly kind: "gate_verdict";
  readonly verdict: GateVerdict;
  readonly profile: import("./primitives.js").GateProfile;
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
  readonly residualRisks: readonly StableId[];
}

export interface EscapedDefectNode extends QegNodeBase {
  readonly kind: "escaped_defect";
  readonly severity: Severity;
  readonly discoveredAt: string;
  readonly linkedVerdictRef: StableId;
  readonly linkedPlacementPlanRef: StableId;
  readonly linkedEvidenceRefs: readonly StableId[];
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
  | EscapedDefectNode
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

export interface PlacementChangeRecord {
  readonly id: StableId;
  readonly subject_id: StableId;
  readonly from_layer: PlacementChangeLayer;
  readonly to_layer: PlacementChangeLayer;
  readonly replacement_ids: readonly StableId[];
  readonly evidence_refs: readonly EvidenceRef[];
  readonly policy_ref: StableId;
  readonly decided_by: string;
  readonly decided_at: string;
  readonly reversible: true;
  readonly revert_condition: string;
}

export interface ManualCaseInventory {
  readonly previous_subject_ids: readonly StableId[];
  readonly current_subject_ids: readonly StableId[];
  readonly sourceRefs: readonly SourceRef[];
}

export interface TestPlacementPlan {
  readonly metadata: QegMetadata;
  readonly obligations: readonly TestObligation[];
  readonly placements: readonly TestPlacementNode[];
  readonly placement_changes?: readonly PlacementChangeRecord[];
  readonly manual_case_inventory?: ManualCaseInventory;
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
