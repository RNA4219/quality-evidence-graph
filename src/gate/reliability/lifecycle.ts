import type {
  Disqualification,
  ResilienceExecutionEvidenceNode,
  ResilienceTestNode,
} from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import { findAbortSignal } from "./signals.js";
import {
  dq,
  requiresQualificationEvidence,
  sameNumber
} from "./utils.js";


export function abortTriggered(
  condition: ResilienceTestNode["resilienceScenario"]["abortConditions"][number],
  observed: number,
): boolean {
  switch (condition.operator) {
    case "gt":
      return observed > condition.threshold;
    case "gte":
      return observed >= condition.threshold;
    case "lt":
      return observed < condition.threshold;
    case "lte":
      return observed <= condition.threshold;
    case "eq":
      return observed === condition.threshold;
    case "ne":
      return observed !== condition.threshold;
  }
}


export function lifecycleDqs(
  input: DQDetectorInput,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode,
): Disqualification[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const evaluationMs = Date.parse(input.metadata.createdAt);
  const start = Date.parse(evidence.startedAt);
  const end = Date.parse(evidence.endedAt);
  const ageMs = evaluationMs - end;
  const scenario = test.resilienceScenario;
  const reasons: string[] = [];

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    (Number.isFinite(evaluationMs) && end > evaluationMs)
  ) {
    reasons.push("invalid or future execution timestamps");
  }
  if (
    Number.isFinite(ageMs) &&
    ageMs > policy.maxEvidenceAgeHours * 60 * 60 * 1000
  ) {
    reasons.push("evidence exceeds maximum age");
  }
  if (
    evidence.environment !== policy.requiredEnvironment ||
    evidence.environment !== scenario.blastRadius.environment
  ) {
    reasons.push("environment differs from policy or scenario");
  }
  if (
    requiresQualificationEvidence(evidence) &&
    policy.requireSteadyStateBeforeFault &&
    evidence.steadyStateConfirmed !== true
  ) {
    reasons.push("steady state is not confirmed");
  }
  if (
    requiresQualificationEvidence(evidence) &&
    (!evidence.fault || evidence.fault.type !== scenario.faultModel)
  ) {
    reasons.push("fault is absent or differs from scenario");
  }
  if (requiresQualificationEvidence(evidence) && evidence.fault) {
    const faultStart = Date.parse(evidence.fault.faultStartedAt);
    const faultEnd = Date.parse(evidence.fault.faultEndedAt);
    if (
      !Number.isFinite(faultStart) ||
      !Number.isFinite(faultEnd) ||
      faultStart < start ||
      faultEnd > end ||
      faultStart > faultEnd
    ) {
      reasons.push("fault interval is outside execution");
    }
    if (
      Number.isFinite(faultStart) &&
      Number.isFinite(faultEnd) &&
      evidence.fault.appliedDurationMs !== faultEnd - faultStart
    ) {
      reasons.push("appliedDurationMs differs from the fault interval");
    }
    if (evidence.recoveryConfirmedAt !== undefined) {
      const recoveryAt = Date.parse(evidence.recoveryConfirmedAt);
      if (
        !Number.isFinite(recoveryAt) ||
        recoveryAt < faultEnd ||
        recoveryAt > end
      ) {
        reasons.push("recoveryConfirmedAt is outside the recovery interval");
      }
      if (
        evidence.recoveryDurationMs !== undefined &&
        Number.isFinite(recoveryAt) &&
        evidence.recoveryDurationMs !== recoveryAt - faultEnd
      ) {
        reasons.push(
          "recoveryDurationMs differs from the measured recovery interval",
        );
      }
    }
  }

  if (evidence.status === "aborted") {
    const record = evidence.abortRecord;
    const condition = scenario.abortConditions.find(
      (item) => item.id === record?.conditionId,
    );
    const resolved = record
      ? findAbortSignal(evidence, record.signalEntryId)
      : undefined;
    if (!record || !condition || !resolved) {
      reasons.push("abort record, condition, or signal entry is absent");
    } else {
      const entry = resolved.entry;
      const observedValue =
        "observedValue" in entry ? entry.observedValue : entry.matchedCount;
      const signalName =
        "metricName" in entry ? entry.metricName : entry.signalName;
      const aggregation = "aggregation" in entry ? entry.aggregation : "count";
      const triggeredAt = Date.parse(record.triggeredAt);
      const windowStart = Date.parse(entry.windowStart);
      const windowEnd = Date.parse(entry.windowEnd);
      const faultStart = evidence.fault
        ? Date.parse(evidence.fault.faultStartedAt)
        : Number.NaN;
      const faultEnd = evidence.fault
        ? Date.parse(evidence.fault.faultEndedAt)
        : Number.NaN;
      if (
        resolved.source !== condition.source ||
        signalName !== condition.signal ||
        aggregation !== condition.aggregation ||
        record.unit !== condition.unit ||
        ("unit" in entry && entry.unit !== condition.unit)
      ) {
        reasons.push("abort signal contract differs from its condition");
      }
      if (
        !sameNumber(observedValue, record.observedValue) ||
        !abortTriggered(condition, observedValue)
      ) {
        reasons.push("abort observed value does not trigger its condition");
      }
      if (
        !Number.isFinite(triggeredAt) ||
        triggeredAt < windowStart ||
        triggeredAt > windowEnd ||
        triggeredAt < faultStart ||
        triggeredAt > faultEnd
      ) {
        reasons.push("abort timestamp is outside signal or fault windows");
      }
    }
  } else if (evidence.abortRecord) {
    reasons.push("non-aborted evidence contains an abort record");
  }

  return reasons.length > 0
    ? [
        dq(
          "DQ-18",
          "Resilience lifecycle invalid: " + [...new Set(reasons)].join("; "),
          [evidence.id, test.id],
        ),
      ]
    : [];
}
