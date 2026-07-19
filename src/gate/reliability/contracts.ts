import type {
  Disqualification,
  GateBlocker,
  ReliabilityAccounting,
  ResilienceExecutionEvidenceNode,
  ResilienceTestNode,
  RiskNode,
  SourceRef,
  TestNode,
} from "../../types.js";

export interface ReliabilityEvaluation {
  readonly accounting: ReliabilityAccounting;
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
}

export interface ReliabilityIndex {
  readonly allTests: readonly TestNode[];
  readonly resilienceTests: readonly ResilienceTestNode[];
  readonly testsById: ReadonlyMap<string, ResilienceTestNode>;
  readonly requiredRisks: readonly RiskNode[];
  readonly testsByRiskId: ReadonlyMap<string, readonly ResilienceTestNode[]>;
  readonly excludedMockTests: readonly {
    readonly testId: string;
    readonly reason: "mock_test";
    readonly sourceRefs: readonly SourceRef[];
  }[];
}

export interface EvidenceSelection {
  readonly evidence?: ResilienceExecutionEvidenceNode;
  readonly disqualifications: readonly Disqualification[];
  readonly exclusionReason?: string;
}

export interface ReliabilityDrillDownSeed {
  readonly riskId: string;
  readonly testId: string;
  readonly evidence?: ResilienceExecutionEvidenceNode;
  readonly selectionReason: "latest_current_execution" | "no_selectable_current_execution";
  readonly exclusionReason?: string;
  readonly disqualificationCodes: readonly Disqualification["code"][];
  readonly blockerIds: readonly string[];
}
