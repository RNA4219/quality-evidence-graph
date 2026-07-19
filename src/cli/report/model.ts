import type {
  Disqualification,
  DisqualificationCode,
  GateBlocker,
  GateVerdict,
  ReliabilityAccounting,
  StableId,
} from "../../types.js";
import type { ReportSelection } from "./change-selection.js";

export type ReportTargetStatus = "passed" | "baseline_accepted" | "gate_failed" | "cli_error";
export type ReportFormat = "text" | "json";

export interface ReportOptions {
  readonly format: ReportFormat;
  readonly outPath?: string;
  readonly githubSummary?: boolean;
  readonly baselinePath?: string;
  readonly changedOnly?: boolean;
  readonly diffPath?: string;
}

export interface ReportExpectedComparison {
  readonly fixture: string;
  readonly expectedVerdict: GateVerdict;
  readonly expectedExitCode: number;
  readonly contractRef: string;
  readonly validationPassed: boolean;
  readonly verdictMatch: boolean;
  readonly exitCodeMatch: boolean;
  readonly dqMatch: boolean;
  readonly expectedDqCodes: readonly DisqualificationCode[];
  readonly actualDqCodes: readonly DisqualificationCode[];
  readonly unexpectedDqCodes: readonly DisqualificationCode[];
  readonly missingDqCodes: readonly DisqualificationCode[];
  readonly blockerMatch: boolean;
  readonly expectedBlockerIds: readonly string[];
  readonly actualBlockerIds: readonly string[];
}

export interface ReportTargetResult {
  readonly target: string;
  readonly status: ReportTargetStatus;
  readonly exitCode: number;
  readonly verdict?: GateVerdict;
  readonly reasons: readonly string[];
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
  readonly residualRisks: readonly StableId[];
  readonly requiredHumanReview: readonly StableId[];
  readonly reliability: ReliabilityAccounting;
  readonly expected?: ReportExpectedComparison;
  readonly error?: string;
}

export interface DqSummaryItem {
  readonly code: DisqualificationCode;
  readonly count: number;
  readonly remediation: string;
}

export interface ReportSummary {
  readonly totalTargets: number;
  readonly passed: number;
  readonly baselineAccepted: number;
  readonly gateFailed: number;
  readonly cliErrors: number;
  readonly dqCounts: readonly DqSummaryItem[];
  readonly blockerCount: number;
  readonly residualRiskCount: number;
  readonly humanReviewCount: number;
}

export interface ReportError {
  readonly code: "CHANGE_DETECTION_FAILED";
  readonly message: string;
}

export interface CiReport {
  readonly reportVersion: "qeg-ci-report-v2";
  readonly generatedAt: string;
  readonly selection: ReportSelection;
  readonly errors: readonly ReportError[];
  readonly summary: ReportSummary;
  readonly targets: readonly ReportTargetResult[];
  readonly diff?: ReportDiff;
}

export interface ReportDiffItem {
  readonly target: string;
  readonly code: DisqualificationCode;
  readonly message: string;
  readonly nodeIds: readonly StableId[];
}

export interface ReportDiff {
  readonly previousReport: string;
  readonly new: readonly ReportDiffItem[];
  readonly resolved: readonly ReportDiffItem[];
  readonly unchanged: readonly ReportDiffItem[];
}

export interface CreateCiReportOptions {
  readonly baselinePath?: string;
  readonly changedOnly?: boolean;
  readonly diffPath?: string;
}

