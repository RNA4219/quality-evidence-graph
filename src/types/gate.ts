import type {
  DisqualificationCode,
  GateProfile,
  GateVerdict,
  IsoDateTime,
  ResilienceEnvironment,
  SignalSemanticRole,
  StableId,
} from "./primitives.js";
import type { QegMetadata, SourceRef } from "./evidence.js";

export interface ExitCodePolicy {
  readonly go: 0;
  readonly conditional_go: 2;
  readonly no_go: 2;
  readonly disqualified: 2;
}

export interface PlacementRetirementPolicy {
  readonly minEvidenceStrength: number;
  readonly minConsecutiveGreen: number;
  readonly requireRiskCoverage: boolean;
  readonly sourceRefs: readonly SourceRef[];
}

export interface ReliabilityRequiredSignals {
  readonly metrics: true;
  readonly traces: boolean;
  readonly logs: boolean;
}

export interface ReliabilityThresholds {
  readonly minRequestCount: number;
  readonly maxErrorRate: number;
  readonly maxLatencyP95Ms: number;
  readonly maxSaturationPct: number;
  readonly maxRecoverySeconds: number;
  readonly maxDuplicateSideEffects: number;
  readonly maxDataInconsistencies: number;
}

export interface ReliabilitySafetyPolicy {
  readonly allowedEnvironments: readonly Exclude<ResilienceEnvironment, "production">[];
  readonly forbidProduction: true;
  readonly maxBlastRadiusTargets: number;
  readonly maxFaultDurationSeconds: number;
}

export interface ReliabilityPolicy {
  readonly enabled: true;
  readonly requiredForSeverities: readonly import("./primitives.js").Severity[];
  readonly requiredEnvironment: Exclude<ResilienceEnvironment, "production">;
  readonly allowedExecutionModes: readonly ["real"];
  readonly maxEvidenceAgeHours: number;
  readonly requireRevisionMatch: true;
  readonly requireSteadyStateBeforeFault: true;
  readonly requireRecoveryObservation: true;
  readonly requiredSignals: ReliabilityRequiredSignals;
  readonly thresholds: ReliabilityThresholds;
  readonly safety: ReliabilitySafetyPolicy;
  readonly sourceRefs: readonly SourceRef[];
}

export interface GatePolicy {
  readonly policyId: string;
  readonly policyHash: string;
  readonly profile: GateProfile;
  readonly effectiveDate: IsoDateTime;
  readonly approver: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly dqScope: readonly DisqualificationCode[];
  readonly exitCodePolicy: ExitCodePolicy;
  readonly placementRetirementPolicy?: PlacementRetirementPolicy;
  readonly reliabilityPolicy?: ReliabilityPolicy;
}

export interface RevertConditionStatus {
  readonly placementChangeId: StableId;
  readonly condition: string;
  readonly triggered: boolean;
  readonly sourceRefs: readonly SourceRef[];
}

export interface GatePolicyProposal {
  readonly proposalId: StableId;
  readonly producer: "rand" | "ctg" | "mbb" | "hate";
  readonly proposedPolicy: Partial<GatePolicy>;
  readonly rationale: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly policyHash?: string;
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
  readonly ruleId?: "BLK-REL-01" | "BLK-REL-02" | "BLK-REL-03" | "BLK-REL-04";
  readonly testId?: StableId;
  readonly evidenceId?: StableId;
  /** A waived reliability blocker remains auditable but does not force no_go. */
  readonly effective?: boolean;
  readonly waiverId?: StableId;
}

export interface ExcludedTestEvidence {
  readonly testId: StableId;
  readonly reason: "mock_test";
  readonly sourceRefs: readonly SourceRef[];
}

export interface TestEvidenceAccounting {
  readonly countedTestIds: readonly StableId[];
  readonly excludedMockTests: readonly ExcludedTestEvidence[];
}

export interface ReliabilityDrillDown {
  readonly riskId: StableId;
  readonly testId: StableId;
  readonly selectedEvidenceId?: StableId;
  readonly adapter?: string;
  readonly experimentId?: StableId;
  readonly attempt?: number;
  readonly targetRevision?: string;
  readonly environmentId?: string;
  readonly selectionReason: string;
  readonly exclusionReason?: string;
  readonly disqualificationCodes: readonly DisqualificationCode[];
  readonly blockerIds: readonly StableId[];
}

export interface ReliabilityAccountingEnabled {
  readonly enabled: true;
  readonly requiredRiskCount: number;
  readonly qualifiedRiskCount: number;
  readonly passingRiskCount: number;
  readonly riskCoverageRate: number | null;
  readonly requiredExecutionCount: number;
  readonly qualifiedExecutionCount: number;
  readonly passingExecutionCount: number;
  readonly resiliencePassRate: number | null;
  readonly recoverySecondsP50: number | null;
  readonly recoverySecondsP95: number | null;
  readonly recoverySampleCount: number;
  readonly duplicateSideEffectsCount: number;
  readonly dataInconsistenciesCount: number;
  readonly evidenceAgeHours: Readonly<Record<StableId, number>>;
  readonly excludedMockTests: readonly ExcludedTestEvidence[];
  readonly dqCountByRule: Readonly<Record<"DQ-12" | "DQ-18" | "DQ-19" | "DQ-20" | "DQ-21", number>>;
  readonly drillDown: readonly ReliabilityDrillDown[];
}

export interface ReliabilityAccountingDisabled {
  readonly enabled: false;
}

export type ReliabilityAccounting = ReliabilityAccountingEnabled | ReliabilityAccountingDisabled;

export interface GateResult {
  readonly metadata: QegMetadata;
  readonly verdict: GateVerdict;
  readonly reasons: readonly string[];
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
  readonly residualRisks: readonly StableId[];
  readonly requiredHumanReview: readonly StableId[];
  readonly testEvidenceAccounting: TestEvidenceAccounting;
  readonly reliability: ReliabilityAccounting;
}
