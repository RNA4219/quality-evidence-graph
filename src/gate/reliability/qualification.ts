import type {
  Disqualification,
  ResilienceExecutionEvidenceNode,
  ResilienceTestNode,
} from "../../types.js";
import { validateReliabilitySemantics } from "../../validation/reliability-semantics.js";
import type { DQDetectorInput } from "../context.js";
import { findAbortSignal, signalDqs, steadyStateSloDqs } from "./signals.js";
import {
  dq,
  isFullGitObjectId,
  isSha256,
  policyBounds,
  requiresQualificationEvidence,
  sameNumber,
  targetBounds,
} from "./utils.js";

type ArtifactFailureClass = "non_revision" | "revision";

function artifactFailureClasses(
  input: DQDetectorInput,
): ReadonlyMap<string, ArtifactFailureClass> {
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
    return [
      dq(
        "DQ-06",
        "Reliability policy is enabled but artifact verification report is missing",
        [],
      ),
    ];
  }
  const classes = artifactFailureClasses(input);
  const result: Disqualification[] = [];
  const preflightOwnsDq06 = input.preflightDisqualifications.some(
    (item) => item.code === "DQ-06",
  );
  for (const artifactId of [...classes.keys()].sort()) {
    const failureClass = classes.get(artifactId);
    if (failureClass === "non_revision") {
      if (!preflightOwnsDq06) {
        result.push(
          dq("DQ-06", "Artifact verification failed for " + artifactId, [artifactId]),
        );
      }
    } else if (failureClass === "revision") {
      result.push(
        dq("DQ-12", "Artifact revision mismatch for " + artifactId, [artifactId]),
      );
    }
  }
  if (report.status === "fail" && classes.size === 0 && !preflightOwnsDq06) {
    result.push(
      dq(
        "DQ-06",
        "Artifact verification failed without a classified artifact diagnostic",
        [],
      ),
    );
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

function policyIntegrityDqs(input: DQDetectorInput): Disqualification[] {
  const { metadata, graph, policy } = input;
  const allowedProfiles = new Set(["standard", "strict", "ipo_controlled"]);
  const requiredDqScope: readonly Disqualification["code"][] = [
    "DQ-18",
    "DQ-19",
    "DQ-20",
    "DQ-21",
  ];
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
    return [
      dq(
        "DQ-21",
        "Reliability policy identity, SHA-256 hash, profile, DQ scope, or full revision is invalid or does not match across Gate, graph, and policy",
        [],
      ),
    ];
  }
  return [];
}

export function globalQualificationDqs(
  input: DQDetectorInput,
): Disqualification[] {
  return [
    ...semanticInputDqs(input),
    ...artifactVerificationDqs(input),
    ...policyIntegrityDqs(input),
  ];
}

export function evidenceRevisionDqs(
  input: DQDetectorInput,
  evidence: ResilienceExecutionEvidenceNode,
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
  return mismatches.length > 0
    ? [
        dq(
          "DQ-12",
          "Resilience evidence revision mismatch (" + mismatches.join(", ") + ")",
          [evidence.id],
        ),
      ]
    : [];
}

function scenarioDqs(
  input: DQDetectorInput,
  test: ResilienceTestNode,
): Disqualification[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const reasons: string[] = [];
  for (const slo of test.resilienceScenario.steadyState.slos) {
    if (
      policy.requireRecoveryObservation &&
      !slo.evaluationPhases.includes("recovery")
    ) {
      reasons.push("SLO " + slo.name + " omits recovery phase");
    }
    const bounds = targetBounds(slo);
    for (const phase of slo.evaluationPhases) {
      const policyLimit = policyBounds(input, slo.semanticRole, phase);
      if (
        policyLimit &&
        Math.max(bounds.min, policyLimit.min) >
          Math.min(bounds.max, policyLimit.max)
      ) {
        reasons.push(
          "SLO " +
            slo.name +
            " conflicts with the effective policy threshold in " +
            phase,
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

function abortTriggered(
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

function lifecycleDqs(
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

export function qualifyEvidence(
  input: DQDetectorInput,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode,
): Disqualification[] {
  const revision = evidenceRevisionDqs(input, evidence);
  if (revision.length > 0) return revision;
  const scenario = scenarioDqs(input, test);
  if (scenario.length > 0) return scenario;
  const lifecycle = lifecycleDqs(input, test, evidence);
  if (lifecycle.length > 0) return lifecycle;
  const signals = signalDqs(input, test, evidence);
  if (signals.length > 0) return signals;
  return requiresQualificationEvidence(evidence)
    ? steadyStateSloDqs(test, evidence)
    : [];
}
