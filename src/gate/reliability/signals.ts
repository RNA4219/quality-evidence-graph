import type {
  Disqualification,
  MetricSignalEntry,
  ResilienceExecutionEvidenceNode,
  ResilienceTestNode,
  SignalPhase,
  SignalSemanticRole,
  TraceOrLogSignalEntry,
} from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import {
  dq,
  metricMatchesSlo,
  requiresQualificationEvidence,
  sameNumber,
  targetSatisfied,
} from "./utils.js";

export function findAbortSignal(
  evidence: ResilienceExecutionEvidenceNode,
  entryId: string,
):
  | {
      readonly source: "metric" | "trace_count" | "log_count";
      readonly entry: MetricSignalEntry | TraceOrLogSignalEntry;
    }
  | undefined {
  const manifest = evidence.signalManifest;
  if (!manifest) return undefined;
  const metric = manifest.metrics.find((entry) => entry.id === entryId);
  if (metric) return { source: "metric", entry: metric };
  const trace = manifest.traces.find((entry) => entry.id === entryId);
  if (trace) return { source: "trace_count", entry: trace };
  const log = manifest.logs.find((entry) => entry.id === entryId);
  return log ? { source: "log_count", entry: log } : undefined;
}

const OBSERVED_METRICS: readonly {
  readonly field: keyof NonNullable<ResilienceExecutionEvidenceNode["observed"]>;
  readonly phase: SignalPhase;
  readonly role: SignalSemanticRole;
  readonly aggregation: MetricSignalEntry["aggregation"];
  readonly unit: string;
}[] = [
  {
    field: "requestCount",
    phase: "fault",
    role: "traffic_count",
    aggregation: "count",
    unit: "count",
  },
  {
    field: "errorRate",
    phase: "fault",
    role: "error_rate",
    aggregation: "rate",
    unit: "ratio",
  },
  {
    field: "latencyP95Ms",
    phase: "fault",
    role: "latency_p95",
    aggregation: "p95",
    unit: "ms",
  },
  {
    field: "saturationPct",
    phase: "fault",
    role: "saturation",
    aggregation: "max",
    unit: "percent",
  },
  {
    field: "duplicateSideEffects",
    phase: "experiment",
    role: "duplicate_side_effects",
    aggregation: "count",
    unit: "count",
  },
  {
    field: "dataInconsistencies",
    phase: "experiment",
    role: "data_inconsistencies",
    aggregation: "count",
    unit: "count",
  },
];

export function signalDqs(
  input: DQDetectorInput,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode,
): Disqualification[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const scenario = test.resilienceScenario;
  const manifest = evidence.signalManifest;
  const reasons: string[] = [];
  const qualificationRequired = requiresQualificationEvidence(evidence);
  if (!manifest) {
    return qualificationRequired || evidence.observed
      ? [dq("DQ-20", "Resilience signalManifest is missing", [evidence.id, test.id])]
      : [];
  }

  const allEntries = [...manifest.metrics, ...manifest.traces, ...manifest.logs];
  const refIds = evidence.evidenceRefs.map((ref) => ref.id);
  if (new Set(refIds).size !== refIds.length) {
    reasons.push("signal evidenceRef IDs are not unique");
  }
  const refs = new Map(evidence.evidenceRefs.map((ref) => [ref.id, ref]));
  const executionStart = Date.parse(evidence.startedAt);
  const executionEnd = Date.parse(evidence.endedAt);
  const faultStart = evidence.fault
    ? Date.parse(evidence.fault.faultStartedAt)
    : Number.NaN;
  const faultEnd = evidence.fault
    ? Date.parse(evidence.fault.faultEndedAt)
    : Number.NaN;
  const recoveryEnd = evidence.recoveryConfirmedAt
    ? Date.parse(evidence.recoveryConfirmedAt)
    : Number.NaN;
  const evaluationMs = Date.parse(input.metadata.createdAt);

  for (const entry of allEntries) {
    const ref = refs.get(entry.evidenceRefId);
    const expectedKind = manifest.metrics.includes(entry as MetricSignalEntry)
      ? "observability_metric"
      : manifest.traces.includes(entry as TraceOrLogSignalEntry)
        ? "observability_trace"
        : "observability_log";
    if (
      !ref ||
      !ref.contentHash ||
      ref.revision !== evidence.targetRevision ||
      ref.evidenceKind !== expectedKind
    ) {
      reasons.push(
        "signal " + entry.id + " has no matching hash-backed " + expectedKind + " reference",
      );
    }
    const windowStart = Date.parse(entry.windowStart);
    const windowEnd = Date.parse(entry.windowEnd);
    if (
      !Number.isFinite(windowStart) ||
      !Number.isFinite(windowEnd) ||
      windowStart < executionStart ||
      windowEnd > executionEnd ||
      windowStart > windowEnd
    ) {
      reasons.push("signal " + entry.id + " has an invalid execution window");
    }
    if (
      entry.phase === "steady_state" &&
      Number.isFinite(faultStart) &&
      windowEnd > faultStart
    ) {
      reasons.push("signal " + entry.id + " exceeds the steady-state window");
    }
    if (
      entry.phase === "fault" &&
      Number.isFinite(faultStart) &&
      Number.isFinite(faultEnd) &&
      (windowStart < faultStart || windowEnd > faultEnd)
    ) {
      reasons.push("signal " + entry.id + " is outside the fault window");
    }
    if (
      entry.phase === "recovery" &&
      Number.isFinite(faultEnd) &&
      Number.isFinite(recoveryEnd) &&
      (windowStart < faultEnd || windowEnd > recoveryEnd)
    ) {
      reasons.push("signal " + entry.id + " is outside the recovery window");
    }
    if (ref) {
      const capturedAt = Date.parse(ref.capturedAt ?? "");
      if (
        !Number.isFinite(capturedAt) ||
        capturedAt < windowEnd ||
        (Number.isFinite(evaluationMs) && capturedAt > evaluationMs)
      ) {
        reasons.push("signal " + entry.id + " has an invalid capturedAt");
      }
    }
  }

  if (qualificationRequired) {
    if (policy.requiredSignals.metrics && manifest.metrics.length === 0) {
      reasons.push("policy requires metrics");
    }
    for (const requiredMetric of scenario.steadyState.requiredMetrics) {
      if (
        !manifest.metrics.some(
          (metric) =>
            metric.metricName === requiredMetric && metric.phase === "steady_state",
        )
      ) {
        reasons.push("required steady-state metric " + requiredMetric + " is missing");
      }
    }
    for (const slo of scenario.steadyState.slos) {
      for (const phase of slo.evaluationPhases) {
        if (
          !manifest.metrics.some(
            (metric) => metricMatchesSlo(metric, slo) && metric.phase === phase,
          )
        ) {
          reasons.push("SLO " + slo.name + " has no exact " + phase + " signal");
        }
      }
    }
  }

  const metricGroups = new Map<string, Set<number>>();
  for (const metric of manifest.metrics) {
    const key = [
      metric.phase,
      metric.semanticRole,
      metric.customSemanticRoleName ?? "",
      metric.aggregation,
      metric.unit,
    ].join(String.fromCharCode(0));
    const values = metricGroups.get(key) ?? new Set<number>();
    values.add(metric.observedValue);
    metricGroups.set(key, values);
  }
  if ([...metricGroups.values()].some((values) => values.size > 1)) {
    reasons.push("same-role signal measurements contain conflicting values");
  }

  const requireTraces =
    qualificationRequired &&
    (policy.requiredSignals.traces || scenario.steadyState.requiredTraces);
  const requireLogs =
    qualificationRequired &&
    (policy.requiredSignals.logs || scenario.steadyState.requiredLogs);
  const requiredPhases: SignalPhase[] = policy.requireRecoveryObservation
    ? ["fault", "recovery"]
    : ["fault"];
  if (
    requireTraces &&
    requiredPhases.some(
      (phase) =>
        !manifest.traces.some(
          (entry) => entry.phase === phase && entry.matchedCount > 0,
        ),
    )
  ) {
    reasons.push("required trace phases are missing or empty");
  }
  if (
    requireLogs &&
    requiredPhases.some(
      (phase) =>
        !manifest.logs.some(
          (entry) => entry.phase === phase && entry.matchedCount > 0,
        ),
    )
  ) {
    reasons.push("required log phases are missing or empty");
  }

  if (qualificationRequired) {
    for (const condition of scenario.abortConditions) {
      if (
        condition.source === "metric" &&
        !manifest.metrics.some(
          (entry) =>
            entry.phase === "fault" &&
            entry.metricName === condition.signal &&
            entry.aggregation === condition.aggregation &&
            entry.unit === condition.unit,
        )
      ) {
        reasons.push("abort metric " + condition.signal + " is missing");
      }
      if (
        condition.source === "trace_count" &&
        !manifest.traces.some(
          (entry) =>
            entry.phase === "fault" &&
            entry.signalName === condition.signal &&
            entry.matchedCount > 0,
        )
      ) {
        reasons.push("abort trace " + condition.signal + " is missing or empty");
      }
      if (
        condition.source === "log_count" &&
        !manifest.logs.some(
          (entry) =>
            entry.phase === "fault" &&
            entry.signalName === condition.signal &&
            entry.matchedCount > 0,
        )
      ) {
        reasons.push("abort log " + condition.signal + " is missing or empty");
      }
    }
  }

  const observed = evidence.observed;
  if (qualificationRequired && !observed) reasons.push("observed summary is missing");
  if (observed) {
    for (const expected of OBSERVED_METRICS) {
      const matches = manifest.metrics.filter(
        (metric) =>
          metric.phase === expected.phase &&
          metric.semanticRole === expected.role &&
          metric.aggregation === expected.aggregation &&
          metric.unit === expected.unit,
      );
      const values = new Set(matches.map((metric) => metric.observedValue));
      if (matches.length === 0) {
        reasons.push("observed " + expected.field + " has no canonical signal");
      }
      if (values.size > 1) {
        reasons.push("observed " + expected.field + " has conflicting signal values");
      }
      const measured = matches[0]?.observedValue;
      if (measured !== undefined && !sameNumber(measured, observed[expected.field])) {
        reasons.push(
          "observed " + expected.field + " differs from signal manifest",
        );
      }
    }
  }

  return reasons.length > 0
    ? [
        dq(
          "DQ-20",
          "Resilience signals invalid: " + [...new Set(reasons)].join("; "),
          [evidence.id, test.id],
        ),
      ]
    : [];
}

export function steadyStateSloDqs(
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode,
): Disqualification[] {
  const violations = test.resilienceScenario.steadyState.slos.filter(
    (slo) =>
      slo.evaluationPhases.includes("steady_state") &&
      evidence.signalManifest?.metrics.some(
        (metric) =>
          metric.phase === "steady_state" &&
          metricMatchesSlo(metric, slo) &&
          !targetSatisfied(metric.observedValue, slo),
      ),
  );
  return violations.length > 0
    ? [
        dq(
          "DQ-18",
          "Steady-state SLO is not satisfied: " +
            violations.map((slo) => slo.name).join(", "),
          [evidence.id, test.id],
        ),
      ]
    : [];
}
