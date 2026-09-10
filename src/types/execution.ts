import type { SourceRef } from "./evidence.js";

export interface ExecutionTarget {
  readonly projectId: string;
  readonly buildId: string;
  readonly revision: string;
  readonly environmentId: string;
}
export interface VerifiedExecutionRef {
  readonly id: string;
  readonly path: string;
  readonly contentHash: string;
  readonly revision: string;
}
export interface ExecutionPolicy {
  readonly target: ExecutionTarget;
  readonly maxEvidenceAgeHours: number;
  readonly buildBindingRef: VerifiedExecutionRef;
  readonly sourceRefs: readonly SourceRef[];
}
export interface ExecutionIdentity {
  readonly producer: string;
  readonly projectId: string;
  readonly featureId: string;
  readonly caseId: string;
}
export interface IngestExecutionContext {
  readonly projectId: string;
  readonly environmentId: string;
  readonly producerVersion: string;
}
export type ExecutionStatus = "pass" | "fail" | "skipped" | "blocked" | "cancelled" | "unknown" | "running";
export interface ExecutionDetails {
  readonly executionVersion: "qeg-execution/v1";
  readonly testId: string;
  readonly identity: ExecutionIdentity;
  readonly producerVersion: string;
  readonly runId: string;
  readonly target: ExecutionTarget;
  readonly completedAt: string;
  readonly status: ExecutionStatus;
  readonly executionMode: "real" | "mock";
  readonly rawArtifactRef: VerifiedExecutionRef;
  readonly historySourceRefs?: readonly SourceRef[];
}
export interface ExecutionSelection {
  readonly testId: string;
  readonly selectedEvidenceId?: string;
  readonly selectedRunId?: string;
  readonly selectedStatus?: ExecutionStatus;
  readonly reason: string;
  readonly consecutivePasses: number;
  readonly excluded: readonly { readonly evidenceId: string; readonly reason: string }[];
}
export interface ExecutionAccounting {
  readonly evaluatedAt: string;
  readonly target?: ExecutionTarget;
  readonly selections: readonly ExecutionSelection[];
}
