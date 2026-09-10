import { createHash } from "crypto";
import type { ExecutionDetails, ExecutionIdentity, ExecutionPolicy, ExecutionTarget, LegacyExecutionEvidenceNode, LegacyTestNode, SourceRef, VerifiedExecutionRef } from "../../types.js";
import type { GateEvaluationInput } from "../context.js";
import { canonicalJson } from "../reliability/fingerprint.js";

export const same = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);
export const compareId = (a: { id: string }, b: { id: string }): number => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export const nonblank = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
export const fullRevision = (v: unknown): v is string => typeof v === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(v);
export function validSources(v: unknown): v is readonly SourceRef[] {
  return Array.isArray(v) && v.length > 0 && v.every(r => r && nonblank(r.id) && nonblank(r.path));
}
export function validRef(v: VerifiedExecutionRef | undefined): boolean {
  return Boolean(v && nonblank(v.id) && nonblank(v.path) && /^sha256:[a-f0-9]{64}$/.test(v.contentHash) && fullRevision(v.revision));
}
export function validTarget(v: ExecutionTarget | undefined): boolean {
  return Boolean(v && nonblank(v.projectId) && nonblank(v.buildId) && nonblank(v.environmentId) && fullRevision(v.revision));
}
export function validIdentity(v: ExecutionIdentity | undefined): boolean {
  return Boolean(v && [v.producer, v.projectId, v.featureId, v.caseId].every(nonblank));
}
export function validPolicy(v: ExecutionPolicy | undefined): v is ExecutionPolicy {
  return Boolean(v && validTarget(v.target) && Number.isFinite(v.maxEvidenceAgeHours) && v.maxEvidenceAgeHours > 0 &&
    Number.isFinite(v.maxEvidenceAgeHours * 3600000) && validRef(v.buildBindingRef) && validSources(v.sourceRefs));
}
export function validExecution(v: ExecutionDetails | undefined): v is ExecutionDetails {
  return Boolean(v && v.executionVersion === "qeg-execution/v1" && validIdentity(v.identity) && validTarget(v.target) &&
    [v.testId, v.producerVersion, v.runId].every(nonblank) && validRef(v.rawArtifactRef) &&
    ["pass", "fail", "skipped", "blocked", "cancelled", "unknown", "running"].includes(v.status) &&
    ["real", "mock"].includes(v.executionMode) && (v.historySourceRefs === undefined || validSources(v.historySourceRefs)));
}
/** Explicit timezone and actual calendar validation. No wall clock. */
export function executionTime(value: unknown): number {
  if (typeof value !== "string") return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s, , tz] = m;
  const year = Number(y);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(mo) - 1] ?? 0;
  if (+mo! < 1 || +mo! > 12 || +d! < 1 || +d! > days || +h! > 23 || +mi! > 59 || +s! > 59) return NaN;
  if (tz !== "Z" && (Number(tz!.slice(1, 3)) > 23 || Number(tz!.slice(4, 6)) > 59)) return NaN;
  return Date.parse(value);
}

/** Preserve producer micro/nanoseconds when ordering, checking freshness and rejecting future evidence. */
export function executionNanos(value: unknown): bigint | undefined {
  const milliseconds = executionTime(value);
  if (!Number.isFinite(milliseconds)) return undefined;
  const fraction = /\.(\d{1,9})(?:Z|[+-]\d{2}:\d{2})$/.exec(String(value))?.[1] ?? "";
  return BigInt(milliseconds) * 1000000n + BigInt(fraction.padEnd(9, "0").slice(3));
}
type ExecutionInput = Pick<GateEvaluationInput, "metadata" | "graph" | "policy">;
export function normalTests(input: ExecutionInput): LegacyTestNode[] {
  return input.graph.nodes.filter((n): n is LegacyTestNode => n.kind === "test" && n.testType !== "resilience").sort(compareId);
}
export function normalEvidence(input: ExecutionInput): LegacyExecutionEvidenceNode[] {
  return input.graph.nodes.filter((n): n is LegacyExecutionEvidenceNode => n.kind === "execution_evidence" && n.evidenceType !== "resilience").sort(compareId);
}
export function executionFingerprint(input: ExecutionInput): string {
  const sorted = <T extends { id: string }>(items: readonly T[]): T[] => [...items].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return createHash("sha256").update(canonicalJson({
    metadata: { ...input.metadata, inputArtifacts: sorted(input.metadata.inputArtifacts) },
    graphMetadata: { ...input.graph.metadata, inputArtifacts: sorted(input.graph.metadata.inputArtifacts) }, policy: input.policy.executionPolicy,
    tests: sorted(normalTests(input)), evidence: sorted(normalEvidence(input)), edges: sorted(input.graph.edges),
  })).digest("hex");
}
