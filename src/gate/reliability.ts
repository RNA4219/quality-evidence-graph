import { createHash } from "crypto";
import type {
  Disqualification,
  GateBlocker,
  MetricSignalEntry,
  ReliabilityAccounting,
  ReliabilityDrillDown,
  ResilienceExecutionEvidenceNode,
  ResilienceSlo,
  ResilienceTestNode,
  SignalPhase,
  SignalSemanticRole,
  SourceRef,
  TestNode,
  TraceOrLogSignalEntry,
} from "../types.js";
import type { DQDetectorInput } from "./context.js";
import { validateReliabilitySemantics } from "../validation/reliability-semantics.js";

export interface ReliabilityEvaluation {
  readonly accounting: ReliabilityAccounting;
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
}

const RELIABILITY_REF: SourceRef = {
  id: "qeg:reliability-extension",
  path: "docs/spec/reliability-extension.md",
};

function isResilienceTest(node: TestNode): node is ResilienceTestNode {
  return node.testType === "resilience" && node.resilienceScenario !== undefined;
}

function isResilienceEvidence(node: unknown): node is ResilienceExecutionEvidenceNode {
  return Boolean(node) && typeof node === "object" &&
    (node as { kind?: string }).kind === "execution_evidence" &&
    (node as { evidenceType?: string }).evidenceType === "resilience";
}

function dq(code: Disqualification["code"], message: string, nodeIds: readonly string[]): Disqualification {
  return { code, message, nodeIds, sourceRefs: [RELIABILITY_REF] };
}

function isFullGitObjectId(value: string | undefined): boolean {
  return Boolean(value && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value));
}

function isSha256(value: string | undefined): boolean {
  return Boolean(value && /^sha256:[a-f0-9]{64}$/.test(value));
}

function sameNumber(left: number | undefined, right: number | undefined): boolean {
  return left !== undefined && right !== undefined && left === right;
}

function nearestRank(values: readonly number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((percentile / 100) * sorted.length) - 1] ?? null;
}

function uniqueNodeIds(disqualifications: readonly Disqualification[]): readonly string[] {
  return [...new Set(disqualifications.flatMap((item) => item.nodeIds))];
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => lexicalCompare(left, right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function decisionFingerprint(evidence: ResilienceExecutionEvidenceNode): string {
  // Audit decoration is excluded by contract; every remaining resilience
  // field can affect selection, validation, accounting, or drill-down.
  const { id: _id, title: _title, traceability: _traceability, sourceArtifactIds: _sourceArtifactIds, ...decisionFields } = evidence;
  return createHash("sha256").update(canonicalJson(decisionFields)).digest("hex");
}

function isPassing(evidence: ResilienceExecutionEvidenceNode): boolean {
  return evidence.status === "pass" && evidence.passed !== false;
}

function requiresQualificationEvidence(evidence: ResilienceExecutionEvidenceNode): boolean {
  return evidence.status === "pass" || evidence.status === "fail" || evidence.status === "aborted";
}

function uniqueSourceRefs(...groups: readonly (readonly SourceRef[])[]): SourceRef[] {
  const byKey = new Map<string, SourceRef>();
  for (const ref of groups.flat()) byKey.set(`${ref.id}\u0000${ref.path}`, ref);
  return [...byKey.values()];
}

function hasValidRelWaiver(
  input: DQDetectorInput,
  riskId: string,
  testId: string
): string | undefined {
  return input.validWaivers.find(
    (waiver) => waiver.linkedRiskIds.includes(riskId) &&
      Boolean(waiver.linkedTestIds?.includes(testId))
  )?.id;
}

function blocker(
  input: DQDetectorInput,
  ruleId: GateBlocker["ruleId"],
  riskId: string,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode | undefined,
  message: string,
  waiverId?: string
): GateBlocker {
  const unwaivable = ruleId === "BLK-REL-04";
  return {
    id: ["blocker", "rel", ruleId?.slice(-2) ?? "00", riskId, test.id, evidence?.id ?? "none"].join(":"),
    message,
    riskIds: [riskId],
    sourceRefs: uniqueSourceRefs(
      [RELIABILITY_REF],
      input.policy.reliabilityPolicy?.sourceRefs ?? [],
      test.traceability.sourceRefs,
      evidence?.traceability.sourceRefs ?? []
    ),
    ruleId,
    testId: test.id,
    ...(evidence ? { evidenceId: evidence.id } : {}),
    effective: unwaivable || !waiverId,
    ...(!unwaivable && waiverId ? { waiverId } : {}),
  };
}

function abortTriggered(condition: ResilienceTestNode["resilienceScenario"]["abortConditions"][number], observed: number): boolean {
  switch (condition.operator) {
    case "gt": return observed > condition.threshold;
    case "gte": return observed >= condition.threshold;
    case "lt": return observed < condition.threshold;
    case "lte": return observed <= condition.threshold;
    case "eq": return observed === condition.threshold;
    case "ne": return observed !== condition.threshold;
  }
}

type ArtifactFailureClass = "non_revision" | "revision";

function artifactFailureClasses(input: DQDetectorInput): ReadonlyMap<string, ArtifactFailureClass> {
  const byArtifact = new Map<string, ArtifactFailureClass>();
  for (const item of input.evidenceVerification?.items ?? []) {
    if (item.severity !== "fail" || item.code === "VERIFIED") continue;
    const current = byArtifact.get(item.artifactId);
    if (item.code !== "REVISION_MISMATCH" || current === "non_revision") {
      byArtifact.set(item.artifactId, "non_revision");
    } else {
      byArtifact.set(item.artifactId, "revision");
    }
  }
  return byArtifact;
}

function artifactVerificationDqs(input: DQDetectorInput): Disqualification[] {
  const report = input.evidenceVerification;
  if (!report) {
    return [dq("DQ-06", "Reliability policy is enabled but artifact verification report is missing", [])];
  }
  const classes = artifactFailureClasses(input);
  const result: Disqualification[] = [];
  const preflightOwnsDq06 = input.preflightDisqualifications.some((item) => item.code === "DQ-06");
  for (const artifactId of [...classes.keys()].sort(lexicalCompare)) {
    const failureClass = classes.get(artifactId);
    if (failureClass === "non_revision") {
      if (!preflightOwnsDq06) {
        result.push(dq("DQ-06", "Artifact verification failed for " + artifactId, [artifactId]));
      }
    } else if (failureClass === "revision") {
      result.push(dq("DQ-12", "Artifact revision mismatch for " + artifactId, [artifactId]));
    }
  }
  if (report.status === "fail" && classes.size === 0 && !preflightOwnsDq06) {
    result.push(dq("DQ-06", "Artifact verification failed without a classified artifact diagnostic", []));
  }
  return result;
}

function semanticInputDqs(input: DQDetectorInput): Disqualification[] {
  const issues = validateReliabilitySemantics(input);
  if (
    issues.length === 0 ||
    input.preflightDisqualifications.some((item) => item.code === "DQ-01")
  ) {
    return [];
  }
  return issues.map((issue) =>
    dq(
      "DQ-01",
      "[" + issue.ruleId + "] " + issue.message + " at " + issue.path,
      issue.nodeId ? [issue.nodeId] : [],
    ),
  );
}

function evidenceIntegrityDqs(
  input: DQDetectorInput,
  evidence: ResilienceExecutionEvidenceNode
): Disqualification[] {
  const head = input.metadata.headRef;
  const reportClasses = artifactFailureClasses(input);
  const mismatches: string[] = [];
  if (!head || evidence.targetRevision !== head) mismatches.push("targetRevision");
  if (
    evidence.rawArtifactRef.revision !== head &&
    !reportClasses.has(evidence.rawArtifactRef.id)
  ) {
    mismatches.push("rawArtifactRef.revision");
  }
  for (const ref of evidence.evidenceRefs) {
    if (ref.revision !== head && !reportClasses.has(ref.id)) {
      mismatches.push("evidenceRef:" + ref.id);
    }
  }
  if (mismatches.length === 0) return [];
  return [
    dq(
      "DQ-12",
      "Resilience evidence revision mismatch (" + mismatches.join(", ") + ")",
      [evidence.id],
    ),
  ];
}

function policyIntegrityDqs(input: DQDetectorInput): Disqualification[] {
  const { metadata, graph, policy } = input;
  const allowedProfiles = new Set(["standard", "strict", "ipo_controlled"]);
  const requiredDqScope: readonly Disqualification["code"][] = ["DQ-18", "DQ-19", "DQ-20", "DQ-21"];
  const valuesMatch =
    metadata.profile === policy.profile &&
    graph.metadata.profile === policy.profile &&
    metadata.policyId === policy.policyId &&
    graph.metadata.policyId === policy.policyId &&
    metadata.policyHash === policy.policyHash &&
    graph.metadata.policyHash === policy.policyHash &&
    metadata.headRef === graph.metadata.headRef;
  if (
    !isFullGitObjectId(metadata.headRef) ||
    !isFullGitObjectId(graph.metadata.headRef) ||
    !isSha256(policy.policyHash) ||
    !isSha256(metadata.policyHash) ||
    !isSha256(graph.metadata.policyHash) ||
    !allowedProfiles.has(policy.profile) ||
    !requiredDqScope.every((code) => policy.dqScope.includes(code)) ||
    !valuesMatch
  ) {
    return [dq("DQ-21", "Reliability policy identity, SHA-256 hash, profile, DQ scope, or full revision is invalid or does not match across Gate, graph, and policy", [])];
  }
  return [];
}

interface NumericBounds { readonly min: number; readonly max: number; }

function targetBounds(slo: ResilienceSlo): NumericBounds {
  if (slo.target.targetType === "min") return { min: slo.target.value, max: Number.POSITIVE_INFINITY };
  if (slo.target.targetType === "max") return { min: Number.NEGATIVE_INFINITY, max: slo.target.value };
  return { min: slo.target.min, max: slo.target.max };
}

function policyBounds(
  input: DQDetectorInput,
  role: SignalSemanticRole,
  phase: SignalPhase
): NumericBounds | undefined {
  const thresholds = input.policy.reliabilityPolicy?.thresholds;
  if (!thresholds) return undefined;
  if (phase === "fault" && role === "traffic_count") return { min: thresholds.minRequestCount, max: Number.POSITIVE_INFINITY };
  if (phase === "fault" && role === "error_rate") return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxErrorRate };
  if (phase === "fault" && role === "latency_p95") return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxLatencyP95Ms };
  if (phase === "fault" && role === "saturation") return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxSaturationPct };
  if (phase === "experiment" && role === "duplicate_side_effects") return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxDuplicateSideEffects };
  if (phase === "experiment" && role === "data_inconsistencies") return { min: Number.NEGATIVE_INFINITY, max: thresholds.maxDataInconsistencies };
  return undefined;
}

function targetSatisfied(value: number, slo: ResilienceSlo): boolean {
  const bounds = targetBounds(slo);
  return value >= bounds.min && value <= bounds.max;
}

function metricMatchesSlo(metric: MetricSignalEntry, slo: ResilienceSlo): boolean {
  return metric.metricName === slo.metricName &&
    metric.semanticRole === slo.semanticRole &&
    metric.aggregation === slo.aggregation &&
    metric.unit === slo.unit &&
    (slo.semanticRole !== "custom" || metric.customSemanticRoleName === slo.customSemanticRoleName);
}

function scenarioDqs(input: DQDetectorInput, test: ResilienceTestNode): Disqualification[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const reasons: string[] = [];
  for (const slo of test.resilienceScenario.steadyState.slos) {
    if (policy.requireRecoveryObservation && !slo.evaluationPhases.includes("recovery")) {
      reasons.push("SLO " + slo.name + " omits recovery phase");
    }
    const bounds = targetBounds(slo);
    for (const phase of slo.evaluationPhases) {
      const policyLimit = policyBounds(input, slo.semanticRole, phase);
      if (
        policyLimit &&
        Math.max(bounds.min, policyLimit.min) > Math.min(bounds.max, policyLimit.max)
      ) {
        reasons.push(
          "SLO " + slo.name + " conflicts with the effective policy threshold in " + phase,
        );
      }
    }
  }
  return reasons.length > 0
    ? [
        dq(
          "DQ-18",
          "Resilience scenario is incompatible with policy: " +
            [...new Set(reasons)].join("; "),
          [test.id],
        ),
      ]
    : [];
}

function findAbortSignal(
  evidence: ResilienceExecutionEvidenceNode,
  entryId: string
): { readonly source: "metric" | "trace_count" | "log_count"; readonly entry: MetricSignalEntry | TraceOrLogSignalEntry } | undefined {
  const manifest = evidence.signalManifest;
  if (!manifest) return undefined;
  const metric = manifest.metrics.find((entry) => entry.id === entryId);
  if (metric) return { source: "metric", entry: metric };
  const trace = manifest.traces.find((entry) => entry.id === entryId);
  if (trace) return { source: "trace_count", entry: trace };
  const log = manifest.logs.find((entry) => entry.id === entryId);
  return log ? { source: "log_count", entry: log } : undefined;
}

function lifecycleDqs(
  input: DQDetectorInput,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode
): Disqualification[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const evaluationMs = Date.parse(input.metadata.createdAt);
  const start = Date.parse(evidence.startedAt);
  const end = Date.parse(evidence.endedAt);
  const ageMs = evaluationMs - end;
  const scenario = test.resilienceScenario;
  const reasons: string[] = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || (Number.isFinite(evaluationMs) && end > evaluationMs)) reasons.push("invalid or future execution timestamps");
  if (Number.isFinite(ageMs) && ageMs > policy.maxEvidenceAgeHours * 60 * 60 * 1000) reasons.push("evidence exceeds maximum age");
  if (evidence.environment !== policy.requiredEnvironment || evidence.environment !== scenario.blastRadius.environment) reasons.push("environment differs from policy or scenario");
  if (requiresQualificationEvidence(evidence) && policy.requireSteadyStateBeforeFault && evidence.steadyStateConfirmed !== true) reasons.push("steady state is not confirmed");
  if (requiresQualificationEvidence(evidence) && (!evidence.fault || evidence.fault.type !== scenario.faultModel)) reasons.push("fault is absent or differs from scenario");
  if (requiresQualificationEvidence(evidence) && evidence.fault) {
    const faultStart = Date.parse(evidence.fault.faultStartedAt);
    const faultEnd = Date.parse(evidence.fault.faultEndedAt);
    if (!Number.isFinite(faultStart) || !Number.isFinite(faultEnd) || faultStart < start || faultEnd > end || faultStart > faultEnd) reasons.push("fault interval is outside execution");
    if (Number.isFinite(faultStart) && Number.isFinite(faultEnd) && evidence.fault.appliedDurationMs !== faultEnd - faultStart) reasons.push("appliedDurationMs differs from the fault interval");
    if (evidence.recoveryConfirmedAt !== undefined) {
      const recoveryAt = Date.parse(evidence.recoveryConfirmedAt);
      if (!Number.isFinite(recoveryAt) || recoveryAt < faultEnd || recoveryAt > end) reasons.push("recoveryConfirmedAt is outside the recovery interval");
      if (evidence.recoveryDurationMs !== undefined && Number.isFinite(recoveryAt) && evidence.recoveryDurationMs !== recoveryAt - faultEnd) reasons.push("recoveryDurationMs differs from the measured recovery interval");
    }
  }
  if (evidence.status === "aborted") {
    const record = evidence.abortRecord;
    const condition = scenario.abortConditions.find((item) => item.id === record?.conditionId);
    const resolved = record ? findAbortSignal(evidence, record.signalEntryId) : undefined;
    if (!record || !condition || !resolved) {
      reasons.push("abort record, condition, or signal entry is absent");
    } else {
      const entry = resolved.entry;
      const observedValue = "observedValue" in entry ? entry.observedValue : entry.matchedCount;
      const signalName = "metricName" in entry ? entry.metricName : entry.signalName;
      const aggregation = "aggregation" in entry ? entry.aggregation : "count";
      const triggeredAt = Date.parse(record.triggeredAt);
      const windowStart = Date.parse(entry.windowStart);
      const windowEnd = Date.parse(entry.windowEnd);
      const faultStart = evidence.fault ? Date.parse(evidence.fault.faultStartedAt) : Number.NaN;
      const faultEnd = evidence.fault ? Date.parse(evidence.fault.faultEndedAt) : Number.NaN;
      if (resolved.source !== condition.source || signalName !== condition.signal || aggregation !== condition.aggregation || record.unit !== condition.unit || ("unit" in entry && entry.unit !== condition.unit)) reasons.push("abort signal contract differs from its condition");
      if (!sameNumber(observedValue, record.observedValue) || !abortTriggered(condition, observedValue)) reasons.push("abort observed value does not trigger its condition");
      if (!Number.isFinite(triggeredAt) || triggeredAt < windowStart || triggeredAt > windowEnd || triggeredAt < faultStart || triggeredAt > faultEnd) reasons.push("abort timestamp is outside signal or fault windows");
    }
  } else if (evidence.abortRecord) {
    reasons.push("non-aborted evidence contains an abort record");
  }
  return reasons.length > 0 ? [dq("DQ-18", `Resilience lifecycle invalid: ${[...new Set(reasons)].join("; ")}`, [evidence.id, test.id])] : [];
}

const OBSERVED_METRICS: readonly {
  readonly field: keyof NonNullable<ResilienceExecutionEvidenceNode["observed"]>;
  readonly phase: SignalPhase;
  readonly role: SignalSemanticRole;
  readonly aggregation: MetricSignalEntry["aggregation"];
  readonly unit: string;
}[] = [
  { field: "requestCount", phase: "fault", role: "traffic_count", aggregation: "count", unit: "count" },
  { field: "errorRate", phase: "fault", role: "error_rate", aggregation: "rate", unit: "ratio" },
  { field: "latencyP95Ms", phase: "fault", role: "latency_p95", aggregation: "p95", unit: "ms" },
  { field: "saturationPct", phase: "fault", role: "saturation", aggregation: "max", unit: "percent" },
  { field: "duplicateSideEffects", phase: "experiment", role: "duplicate_side_effects", aggregation: "count", unit: "count" },
  { field: "dataInconsistencies", phase: "experiment", role: "data_inconsistencies", aggregation: "count", unit: "count" },
];

function signalDqs(
  input: DQDetectorInput,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode
): Disqualification[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const scenario = test.resilienceScenario;
  const manifest = evidence.signalManifest;
  const reasons: string[] = [];
  const qualificationRequired = requiresQualificationEvidence(evidence);
  if (!manifest) return qualificationRequired || evidence.observed
    ? [dq("DQ-20", "Resilience signalManifest is missing", [evidence.id, test.id])]
    : [];
  const allEntries = [...manifest.metrics, ...manifest.traces, ...manifest.logs];
  const entryIds = allEntries.map((entry) => entry.id);
  const refIds = evidence.evidenceRefs.map((ref) => ref.id);
  if (new Set(entryIds).size !== entryIds.length) reasons.push("signal entry IDs are not unique");
  if (new Set(refIds).size !== refIds.length) reasons.push("signal evidenceRef IDs are not unique");
  const refs = new Map(evidence.evidenceRefs.map((ref) => [ref.id, ref]));
  const executionStart = Date.parse(evidence.startedAt);
  const executionEnd = Date.parse(evidence.endedAt);
  const faultStart = evidence.fault ? Date.parse(evidence.fault.faultStartedAt) : Number.NaN;
  const faultEnd = evidence.fault ? Date.parse(evidence.fault.faultEndedAt) : Number.NaN;
  const recoveryEnd = evidence.recoveryConfirmedAt ? Date.parse(evidence.recoveryConfirmedAt) : Number.NaN;
  const evaluationMs = Date.parse(input.metadata.createdAt);
  for (const entry of allEntries) {
    const ref = refs.get(entry.evidenceRefId);
    const expectedKind = manifest.metrics.includes(entry as MetricSignalEntry) ? "observability_metric" : manifest.traces.includes(entry as TraceOrLogSignalEntry) ? "observability_trace" : "observability_log";
    if (!ref || !ref.contentHash || ref.revision !== evidence.targetRevision || ref.evidenceKind !== expectedKind) reasons.push(`signal ${entry.id} has no matching hash-backed ${expectedKind} reference`);
    const windowStart = Date.parse(entry.windowStart);
    const windowEnd = Date.parse(entry.windowEnd);
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowStart < executionStart || windowEnd > executionEnd || windowStart > windowEnd) reasons.push(`signal ${entry.id} has an invalid execution window`);
    if (entry.phase === "steady_state" && Number.isFinite(faultStart) && windowEnd > faultStart) reasons.push(`signal ${entry.id} exceeds the steady-state window`);
    if (entry.phase === "fault" && Number.isFinite(faultStart) && Number.isFinite(faultEnd) && (windowStart < faultStart || windowEnd > faultEnd)) reasons.push(`signal ${entry.id} is outside the fault window`);
    if (entry.phase === "recovery" && Number.isFinite(faultEnd) && Number.isFinite(recoveryEnd) && (windowStart < faultEnd || windowEnd > recoveryEnd)) reasons.push(`signal ${entry.id} is outside the recovery window`);
    if (ref) {
      const capturedAt = Date.parse(ref.capturedAt ?? "");
      if (!Number.isFinite(capturedAt) || capturedAt < windowEnd || (Number.isFinite(evaluationMs) && capturedAt > evaluationMs)) reasons.push(`signal ${entry.id} has an invalid capturedAt`);
    }
  }
  if (qualificationRequired) {
    if (policy.requiredSignals.metrics && manifest.metrics.length === 0) reasons.push("policy requires metrics");
    for (const requiredMetric of scenario.steadyState.requiredMetrics) {
      if (!manifest.metrics.some((metric) => metric.metricName === requiredMetric && metric.phase === "steady_state")) reasons.push(`required steady-state metric ${requiredMetric} is missing`);
    }
    for (const slo of scenario.steadyState.slos) {
      for (const phase of slo.evaluationPhases) {
        if (!manifest.metrics.some((metric) => metricMatchesSlo(metric, slo) && metric.phase === phase)) {
          reasons.push(`SLO ${slo.name} has no exact ${phase} signal`);
        }
      }
    }
  }
  const metricGroups = new Map<string, Set<number>>();
  for (const metric of manifest.metrics) {
    const key = [metric.phase, metric.semanticRole, metric.customSemanticRoleName ?? "", metric.aggregation, metric.unit].join("\u0000");
    const values = metricGroups.get(key) ?? new Set<number>();
    values.add(metric.observedValue);
    metricGroups.set(key, values);
  }
  if ([...metricGroups.values()].some((values) => values.size > 1)) reasons.push("same-role signal measurements contain conflicting values");
  const requireTraces = qualificationRequired && (policy.requiredSignals.traces || scenario.steadyState.requiredTraces);
  const requireLogs = qualificationRequired && (policy.requiredSignals.logs || scenario.steadyState.requiredLogs);
  const requiredPhases: SignalPhase[] = policy.requireRecoveryObservation ? ["fault", "recovery"] : ["fault"];
  if (requireTraces && requiredPhases.some((phase) => !manifest.traces.some((entry) => entry.phase === phase && entry.matchedCount > 0))) reasons.push("required trace phases are missing or empty");
  if (requireLogs && requiredPhases.some((phase) => !manifest.logs.some((entry) => entry.phase === phase && entry.matchedCount > 0))) reasons.push("required log phases are missing or empty");
  if (qualificationRequired) {
    for (const condition of scenario.abortConditions) {
      if (condition.source === "metric" && !manifest.metrics.some((entry) => entry.phase === "fault" && entry.metricName === condition.signal && entry.aggregation === condition.aggregation && entry.unit === condition.unit)) reasons.push(`abort metric ${condition.signal} is missing`);
      if (condition.source === "trace_count" && !manifest.traces.some((entry) => entry.phase === "fault" && entry.signalName === condition.signal && entry.matchedCount > 0)) reasons.push(`abort trace ${condition.signal} is missing or empty`);
      if (condition.source === "log_count" && !manifest.logs.some((entry) => entry.phase === "fault" && entry.signalName === condition.signal && entry.matchedCount > 0)) reasons.push(`abort log ${condition.signal} is missing or empty`);
    }
  }
  const observed = evidence.observed;
  if (qualificationRequired && !observed) reasons.push("observed summary is missing");
  if (observed) {
    for (const expected of OBSERVED_METRICS) {
      const matches = manifest.metrics.filter((metric) => metric.phase === expected.phase && metric.semanticRole === expected.role && metric.aggregation === expected.aggregation && metric.unit === expected.unit);
      const values = new Set(matches.map((metric) => metric.observedValue));
      if (matches.length === 0) reasons.push(`observed ${expected.field} has no canonical signal`);
      if (values.size > 1) reasons.push(`observed ${expected.field} has conflicting signal values`);
      const measured = matches[0]?.observedValue;
      if (measured !== undefined && !sameNumber(measured, observed[expected.field])) reasons.push(`observed ${expected.field} differs from signal manifest`);
    }
  }
  return reasons.length > 0 ? [dq("DQ-20", `Resilience signals invalid: ${[...new Set(reasons)].join("; ")}`, [evidence.id, test.id])] : [];
}

function steadyStateSloDqs(test: ResilienceTestNode, evidence: ResilienceExecutionEvidenceNode): Disqualification[] {
  const violations = test.resilienceScenario.steadyState.slos.filter((slo) => slo.evaluationPhases.includes("steady_state") &&
    evidence.signalManifest?.metrics.some((metric) => metric.phase === "steady_state" && metricMatchesSlo(metric, slo) && !targetSatisfied(metric.observedValue, slo)));
  return violations.length > 0 ? [dq("DQ-18", `Steady-state SLO is not satisfied: ${violations.map((slo) => slo.name).join(", ")}`, [evidence.id, test.id])] : [];
}

function safetyBlockers(input: DQDetectorInput, testsById: ReadonlyMap<string, ResilienceTestNode>): GateBlocker[] {
  const policy = input.policy.reliabilityPolicy;
  const head = input.metadata.headRef;
  if (!policy || !head) return [];
  const allowedEnvironments = new Set<string>(policy.safety.allowedEnvironments);
  const blockers: GateBlocker[] = [];
  for (const candidate of input.graph.nodes.filter(isResilienceEvidence)) {
    const test = testsById.get(candidate.testId);
    if (!test || test.testExecutionMode !== "real" || candidate.targetRevision !== head) continue;
    const environmentViolation =
      candidate.environment === "production" ||
      !allowedEnvironments.has(candidate.environment) ||
      candidate.environment !== test.resilienceScenario.blastRadius.environment;
    const faultViolation = candidate.fault ? (
      candidate.fault.actualTargetIds.length > policy.safety.maxBlastRadiusTargets ||
      candidate.fault.appliedDurationMs > policy.safety.maxFaultDurationSeconds * 1000 ||
      candidate.fault.actualTargetIds.length > test.resilienceScenario.blastRadius.maxTargets ||
      candidate.fault.actualTargetIds.some((targetId) => !test.resilienceScenario.blastRadius.allowedTargets.includes(targetId)) ||
      candidate.fault.appliedDurationMs > test.resilienceScenario.blastRadius.maxDurationSeconds * 1000
    ) : false;
    if (environmentViolation || faultViolation) {
      for (const riskId of test.coveredRiskIds) {
        blockers.push(blocker(input, "BLK-REL-04", riskId, test, candidate, "Safety policy violated by a current real resilience attempt"));
      }
    }
  }
  return blockers;
}

function selectedEvidence(
  input: DQDetectorInput,
  test: ResilienceTestNode
): { evidence?: ResilienceExecutionEvidenceNode; disqualifications: Disqualification[]; exclusionReason?: string } {
  const all = input.graph.nodes.filter(isResilienceEvidence).filter((evidence) => evidence.testId === test.id);
  const current = all.filter((evidence) => evidence.targetRevision === input.metadata.headRef);
  if (current.length === 0) {
    const revisionDqs = all.flatMap((evidence) => evidenceIntegrityDqs(input, evidence));
    return { disqualifications: revisionDqs.length > 0 ? revisionDqs : [dq("DQ-18", "No current resilience evidence exists for required test", [test.id])], exclusionReason: "no_current_real_evidence" };
  }
  const invalidTimestamps = current.filter((evidence) => !Number.isFinite(Date.parse(evidence.endedAt)));
  if (invalidTimestamps.length > 0) {
    return { disqualifications: [dq("DQ-18", "Current resilience evidence has an invalid endedAt timestamp", invalidTimestamps.map((evidence) => evidence.id))], exclusionReason: "invalid_current_timestamp" };
  }
  const byIdentity = new Map<string, ResilienceExecutionEvidenceNode[]>();
  for (const evidence of current) {
    const key = [evidence.adapter, evidence.experimentId, evidence.attempt, evidence.targetRevision].join("\u0000");
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), evidence]);
  }
  for (const duplicates of byIdentity.values()) {
    if (duplicates.length > 1 && new Set(duplicates.map(decisionFingerprint)).size > 1) {
      return { disqualifications: [dq("DQ-19", "Current resilience evidence reuses an execution identity with conflicting decision fingerprints", duplicates.map((evidence) => evidence.id))], exclusionReason: "ambiguous_execution_identity" };
    }
  }
  const newestTime = Math.max(...current.map((evidence) => Date.parse(evidence.endedAt)));
  const newest = current.filter((evidence) => Date.parse(evidence.endedAt) === newestTime);
  const fingerprints = new Set(newest.map(decisionFingerprint));
  if (fingerprints.size > 1) {
    return { disqualifications: [dq("DQ-19", "Latest current resilience evidence has conflicting decision fingerprints", newest.map((evidence) => evidence.id))], exclusionReason: "ambiguous_latest_evidence" };
  }
  return { evidence: [...newest].sort((left, right) => lexicalCompare(left.id, right.id))[0], disqualifications: [] };
}

function blockersForEvidence(
  input: DQDetectorInput,
  riskId: string,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode
): GateBlocker[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const waiverId = hasValidRelWaiver(input, riskId, test.id);
  const threshold = policy.thresholds;
  const observed = evidence.observed;
  const blockers: GateBlocker[] = [];
  let thresholdViolated = Boolean(observed && (
    observed.requestCount < threshold.minRequestCount ||
    observed.errorRate > threshold.maxErrorRate ||
    observed.latencyP95Ms > threshold.maxLatencyP95Ms ||
    observed.saturationPct > threshold.maxSaturationPct ||
    observed.duplicateSideEffects > threshold.maxDuplicateSideEffects ||
    observed.dataInconsistencies > threshold.maxDataInconsistencies
  ));
  let recoverySloViolated = false;
  for (const slo of test.resilienceScenario.steadyState.slos) {
    for (const metric of evidence.signalManifest?.metrics ?? []) {
      if (!metricMatchesSlo(metric, slo) || !slo.evaluationPhases.includes(metric.phase as "steady_state" | "fault" | "recovery")) continue;
      if (!targetSatisfied(metric.observedValue, slo)) {
        if (metric.phase === "fault") thresholdViolated = true;
        if (metric.phase === "recovery") recoverySloViolated = true;
      }
    }
  }
  if (thresholdViolated) blockers.push(blocker(input, "BLK-REL-01", riskId, test, evidence, "Resilience SLO threshold exceeded", waiverId));
  if (requiresQualificationEvidence(evidence) && policy.requireRecoveryObservation && (
    evidence.recovered !== true || evidence.recoveryConfirmedAt === undefined || evidence.recoveryDurationMs === undefined || evidence.recoveryDurationMs > threshold.maxRecoverySeconds * 1000 || recoverySloViolated
  )) blockers.push(blocker(input, "BLK-REL-02", riskId, test, evidence, "Recovery is absent or exceeds the resilience threshold", waiverId));
  if (!isPassing(evidence)) blockers.push(blocker(input, "BLK-REL-03", riskId, test, evidence, `Resilience execution status is ${evidence.status}`, waiverId));
  return blockers;
}

export function evaluateReliability(input: DQDetectorInput): ReliabilityEvaluation {
  if (!input.policy.reliabilityPolicy) return { accounting: { enabled: false }, disqualifications: [], blockers: [] };
  const policy = input.policy.reliabilityPolicy;
  const allTests = input.graph.nodes.filter((node): node is TestNode => node.kind === "test");
  const resilienceTests = allTests.filter(isResilienceTest);
  const testsById = new Map(resilienceTests.map((test) => [test.id, test]));
  const requiredRisks = (input.riskNodes ?? input.graph.nodes.filter((node) => node.kind === "risk"))
    .filter((risk) => policy.requiredForSeverities.includes(risk.severity));
  const excludedMockTests = resilienceTests.filter((test) => test.testExecutionMode === "mock").map((test) => ({ testId: test.id, reason: "mock_test" as const, sourceRefs: test.traceability.sourceRefs }));
  const disqualifications: Disqualification[] = [
    ...semanticInputDqs(input),
    ...artifactVerificationDqs(input),
    ...policyIntegrityDqs(input),
  ];
  const blockers: GateBlocker[] = [];
  const drillDown: ReliabilityDrillDown[] = [];
  const selectedByTest = new Map<string, ResilienceExecutionEvidenceNode>();
  const qualifiedRiskIds = new Set<string>();
  const passingRiskIds = new Set<string>();

  for (const risk of requiredRisks) {
    const tests = resilienceTests.filter((test) => !test.deleted && test.coveredRiskIds.includes(risk.id) && test.testExecutionMode === "real");
    if (tests.length === 0) {
      const mockOnly = resilienceTests.some((test) => !test.deleted && test.coveredRiskIds.includes(risk.id));
      disqualifications.push(dq("DQ-18", mockOnly ? "Required risk has only mock resilience tests" : "Required risk has no real resilience test", [risk.id]));
      continue;
    }
    let riskQualified = true;
    let riskPassing = true;
    for (const test of tests) {
      const selection = selectedByTest.get(test.id) ? { evidence: selectedByTest.get(test.id), disqualifications: [] as Disqualification[] } : selectedEvidence(input, test);
      if (selection.evidence) selectedByTest.set(test.id, selection.evidence);
      disqualifications.push(...selection.disqualifications);
      const evidence = selection.evidence;
      const localDqs: Disqualification[] = [];
      const localBlockers: GateBlocker[] = [];
      if (evidence) {
        const integrity = evidenceIntegrityDqs(input, evidence);
        localDqs.push(...integrity);
        if (integrity.length === 0) {
          const scenario = scenarioDqs(input, test);
          localDqs.push(...scenario);
          if (scenario.length === 0) {
            const lifecycle = lifecycleDqs(input, test, evidence);
            localDqs.push(...lifecycle);
            if (lifecycle.length === 0) {
              const signals = signalDqs(input, test, evidence);
              localDqs.push(...signals);
              if (signals.length === 0 && requiresQualificationEvidence(evidence)) localDqs.push(...steadyStateSloDqs(test, evidence));
            }
          }
        }
        if (localDqs.length === 0) localBlockers.push(...blockersForEvidence(input, risk.id, test, evidence));
      }
      if (!evidence || localDqs.length > 0 || selection.disqualifications.length > 0) riskQualified = false;
      if (!evidence || localDqs.length > 0 || selection.disqualifications.length > 0 || !isPassing(evidence) || localBlockers.some((item) => item.effective !== false)) riskPassing = false;
      disqualifications.push(...localDqs);
      blockers.push(...localBlockers);
      drillDown.push({
        riskId: risk.id,
        testId: test.id,
        ...(evidence ? { selectedEvidenceId: evidence.id, adapter: evidence.adapter, experimentId: evidence.experimentId, attempt: evidence.attempt, targetRevision: evidence.targetRevision, environmentId: evidence.environmentId } : {}),
        selectionReason: evidence ? "latest_current_execution" : "no_selectable_current_execution",
        ...(selection.exclusionReason ? { exclusionReason: selection.exclusionReason } : {}),
        disqualificationCodes: [...new Set([...selection.disqualifications, ...localDqs].map((item) => item.code))],
        blockerIds: localBlockers.map((item) => item.id),
      });
    }
    if (riskQualified) qualifiedRiskIds.add(risk.id);
    if (riskQualified && riskPassing) passingRiskIds.add(risk.id);
  }
  const safety = safetyBlockers(input, testsById);
  blockers.push(...safety);
  const selected = [...selectedByTest.values()];
  const unsafeRiskIds = new Set(blockers.filter((item) => item.ruleId === "BLK-REL-04" && item.effective !== false).flatMap((item) => item.riskIds));
  const effectiveBlockerTestIds = new Set(blockers.filter((item) => item.effective !== false).map((item) => item.testId));
  const uniqueDqs = disqualifications.filter((item, index, all) => all.findIndex((candidate) => candidate.code === item.code && candidate.message === item.message && candidate.nodeIds.join("\u0000") === item.nodeIds.join("\u0000")) === index);
  const dqNodeIds = new Set(uniqueNodeIds(uniqueDqs));
  const globallyDisqualified = !input.evidenceVerification || input.evidenceVerification.status === "fail" ||
    input.preflightDisqualifications.some((item) => item.code === "DQ-01" || item.code === "DQ-06") ||
    uniqueDqs.some((item) => item.code === "DQ-21" && item.nodeIds.length === 0);
  const qualifiedSelected = globallyDisqualified ? [] : selected.filter((evidence) => !dqNodeIds.has(evidence.id) && !dqNodeIds.has(evidence.testId));
  const passingSelected = qualifiedSelected.filter((evidence) => isPassing(evidence) && !effectiveBlockerTestIds.has(evidence.testId));
  const recoverySeconds = qualifiedSelected
    .filter((evidence) => evidence.recovered === true && evidence.recoveryDurationMs !== undefined)
    .map((evidence) => (evidence.recoveryDurationMs ?? 0) / 1000);
  const evidenceAgeHours: Record<string, number> = {};
  for (const evidence of selected) {
    const age = (Date.parse(input.metadata.createdAt) - Date.parse(evidence.endedAt)) / 3_600_000;
    if (Number.isFinite(age) && age >= 0) evidenceAgeHours[evidence.id] = age;
  }
  const countBy = (code: "DQ-12" | "DQ-18" | "DQ-19" | "DQ-20" | "DQ-21") => uniqueDqs.filter((item) => item.code === code).length;
  const qualifiedRiskCount = globallyDisqualified ? 0 : qualifiedRiskIds.size;
  const passingRiskCount = globallyDisqualified ? 0 : [...passingRiskIds].filter((riskId) => !unsafeRiskIds.has(riskId)).length;
  const finalDrillDown = drillDown.map((item) => ({
    ...item,
    blockerIds: [...new Set([...item.blockerIds, ...safety.filter((blockerItem) => blockerItem.testId === item.testId && blockerItem.riskIds.includes(item.riskId)).map((blockerItem) => blockerItem.id)])],
  }));
  return {
    accounting: {
      enabled: true,
      requiredRiskCount: requiredRisks.length,
      qualifiedRiskCount,
      passingRiskCount,
      riskCoverageRate: requiredRisks.length === 0 ? null : qualifiedRiskCount / requiredRisks.length,
      requiredExecutionCount: new Set(drillDown.map((item) => item.testId)).size,
      qualifiedExecutionCount: qualifiedSelected.length,
      passingExecutionCount: passingSelected.length,
      resiliencePassRate: qualifiedSelected.length === 0 ? null : passingSelected.length / qualifiedSelected.length,
      recoverySecondsP50: nearestRank(recoverySeconds, 50),
      recoverySecondsP95: nearestRank(recoverySeconds, 95),
      recoverySampleCount: recoverySeconds.length,
      duplicateSideEffectsCount: selected.reduce((sum, evidence) => sum + (evidence.observed?.duplicateSideEffects ?? 0), 0),
      dataInconsistenciesCount: selected.reduce((sum, evidence) => sum + (evidence.observed?.dataInconsistencies ?? 0), 0),
      evidenceAgeHours,
      excludedMockTests,
      dqCountByRule: { "DQ-12": countBy("DQ-12"), "DQ-18": countBy("DQ-18"), "DQ-19": countBy("DQ-19"), "DQ-20": countBy("DQ-20"), "DQ-21": countBy("DQ-21") },
      drillDown: finalDrillDown,
    },
    disqualifications: uniqueDqs,
    blockers,
  };
}
