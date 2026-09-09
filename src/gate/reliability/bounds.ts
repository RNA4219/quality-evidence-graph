import type {
  MetricSignalEntry,
  ResilienceSlo,
  SignalPhase,
  SignalSemanticRole
} from "../../types.js";
import type { DQDetectorInput } from "../context.js";


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
