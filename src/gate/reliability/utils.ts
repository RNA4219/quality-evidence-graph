import { createHash } from "crypto";
import type {
  Disqualification,
  GateBlocker,
  MetricSignalEntry,
  ResilienceExecutionEvidenceNode,
  ResilienceSlo,
  ResilienceTestNode,
  SignalPhase,
  SignalSemanticRole,
  SourceRef,
  TestNode,
} from "../../types.js";
import type { DQDetectorInput } from "../context.js";

export const RELIABILITY_REF: SourceRef = {
  id: "qeg:reliability-extension",
  path: "docs/spec/reliability-extension.md",
};

export function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function isResilienceTest(node: TestNode): node is ResilienceTestNode {
  return node.testType === "resilience";
}

export function isResilienceEvidence(node: unknown): node is ResilienceExecutionEvidenceNode {
  return Boolean(node) && typeof node === "object" &&
    (node as { kind?: string }).kind === "execution_evidence" &&
    (node as { evidenceType?: string }).evidenceType === "resilience";
}

export function dq(
  code: Disqualification["code"],
  message: string,
  nodeIds: readonly string[],
): Disqualification {
  return {
    code,
    message,
    nodeIds: [...nodeIds].sort(lexicalCompare),
    sourceRefs: [RELIABILITY_REF],
  };
}

export function isFullGitObjectId(value: string | undefined): boolean {
  return Boolean(value && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value));
}

export function isSha256(value: string | undefined): boolean {
  return Boolean(value && /^sha256:[a-f0-9]{64}$/.test(value));
}

export function sameNumber(left: number | undefined, right: number | undefined): boolean {
  return left !== undefined && right !== undefined && left === right;
}

export function nearestRank(values: readonly number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil((percentile / 100) * sorted.length) - 1] ?? null;
}

export function uniqueNodeIds(disqualifications: readonly Disqualification[]): readonly string[] {
  return [...new Set(disqualifications.flatMap((item) => item.nodeIds))].sort(lexicalCompare);
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => lexicalCompare(left, right));
    return "{" + entries
      .map(([key, child]) => JSON.stringify(key) + ":" + canonicalJson(child))
      .join(",") + "}";
  }
  return JSON.stringify(value);
}

export function decisionFingerprint(evidence: ResilienceExecutionEvidenceNode): string {
  const {
    id: _id,
    title: _title,
    traceability: _traceability,
    sourceArtifactIds: _sourceArtifactIds,
    ...decisionFields
  } = evidence;
  return createHash("sha256").update(canonicalJson(decisionFields)).digest("hex");
}

export function isPassing(evidence: ResilienceExecutionEvidenceNode): boolean {
  return evidence.status === "pass" && evidence.passed !== false;
}

export function requiresQualificationEvidence(
  evidence: ResilienceExecutionEvidenceNode,
): boolean {
  return evidence.status === "pass" ||
    evidence.status === "fail" ||
    evidence.status === "aborted";
}

export function uniqueSourceRefs(
  ...groups: readonly (readonly SourceRef[])[]
): SourceRef[] {
  const byKey = new Map<string, SourceRef>();
  for (const ref of groups.flat()) {
    byKey.set(ref.id + String.fromCharCode(0) + ref.path, ref);
  }
  return [...byKey.values()].sort(
    (left, right) => lexicalCompare(left.id, right.id) || lexicalCompare(left.path, right.path),
  );
}

export interface NumericBounds {
  readonly min: number;
  readonly max: number;
}

export function targetBounds(slo: ResilienceSlo): NumericBounds {
  if (slo.target.targetType === "min") {
    return { min: slo.target.value, max: Number.POSITIVE_INFINITY };
  }
  if (slo.target.targetType === "max") {
    return { min: Number.NEGATIVE_INFINITY, max: slo.target.value };
  }
  return { min: slo.target.min, max: slo.target.max };
}

export function policyBounds(
  input: DQDetectorInput,
  role: SignalSemanticRole,
  phase: SignalPhase,
): NumericBounds | undefined {
  const thresholds = input.policy.reliabilityPolicy?.thresholds;
  if (!thresholds) return undefined;
  if (phase === "fault" && role === "traffic_count") {
    return { min: thresholds.minRequestCount, max: Number.POSITIVE_INFINITY };
  }
  if (phase === "fault" && role === "error_rate") {
    return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxErrorRate };
  }
  if (phase === "fault" && role === "latency_p95") {
    return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxLatencyP95Ms };
  }
  if (phase === "fault" && role === "saturation") {
    return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxSaturationPct };
  }
  if (phase === "experiment" && role === "duplicate_side_effects") {
    return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxDuplicateSideEffects };
  }
  if (phase === "experiment" && role === "data_inconsistencies") {
    return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxDataInconsistencies };
  }
  return undefined;
}

export function targetSatisfied(value: number, slo: ResilienceSlo): boolean {
  const bounds = targetBounds(slo);
  return value >= bounds.min && value <= bounds.max;
}

export function metricMatchesSlo(metric: MetricSignalEntry, slo: ResilienceSlo): boolean {
  return metric.metricName === slo.metricName &&
    metric.semanticRole === slo.semanticRole &&
    metric.aggregation === slo.aggregation &&
    metric.unit === slo.unit &&
    (slo.semanticRole !== "custom" ||
      metric.customSemanticRoleName === slo.customSemanticRoleName);
}

export function sortDisqualifications(
  values: readonly Disqualification[],
): Disqualification[] {
  return [...values].sort(
    (left, right) =>
      lexicalCompare(left.code, right.code) ||
      lexicalCompare(left.nodeIds.join(String.fromCharCode(0)), right.nodeIds.join(String.fromCharCode(0))) ||
      lexicalCompare(left.message, right.message),
  );
}

export function sortBlockers(values: readonly GateBlocker[]): GateBlocker[] {
  return [...values].sort(
    (left, right) =>
      lexicalCompare(left.ruleId ?? "", right.ruleId ?? "") ||
      lexicalCompare(left.riskIds.join(String.fromCharCode(0)), right.riskIds.join(String.fromCharCode(0))) ||
      lexicalCompare(left.testId ?? "", right.testId ?? "") ||
      lexicalCompare(left.evidenceId ?? "", right.evidenceId ?? "") ||
      lexicalCompare(left.id, right.id),
  );
}
