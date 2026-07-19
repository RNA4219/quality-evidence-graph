import type {
  GateBlocker,
  ResilienceExecutionEvidenceNode,
  ResilienceTestNode,
} from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import type { ReliabilityIndex } from "./contracts.js";
import {
  isPassing,
  isResilienceEvidence,
  lexicalCompare,
  metricMatchesSlo,
  requiresQualificationEvidence,
  targetSatisfied,
  uniqueSourceRefs,
  RELIABILITY_REF,
} from "./utils.js";

function validWaiverId(
  input: DQDetectorInput,
  riskId: string,
  testId: string,
): string | undefined {
  return input.validWaivers.find(
    (waiver) =>
      waiver.linkedRiskIds.includes(riskId) &&
      Boolean(waiver.linkedTestIds?.includes(testId)),
  )?.id;
}

function createBlocker(
  input: DQDetectorInput,
  ruleId: NonNullable<GateBlocker["ruleId"]>,
  riskId: string,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode | undefined,
  message: string,
  waiverId?: string,
): GateBlocker {
  const unwaivable = ruleId === "BLK-REL-04";
  return {
    id: [
      "blocker",
      "rel",
      ruleId.slice(-2),
      riskId,
      test.id,
      evidence?.id ?? "none",
    ].join(":"),
    message,
    riskIds: [riskId],
    sourceRefs: uniqueSourceRefs(
      [RELIABILITY_REF],
      input.policy.reliabilityPolicy?.sourceRefs ?? [],
      test.traceability.sourceRefs,
      evidence?.traceability.sourceRefs ?? [],
    ),
    ruleId,
    testId: test.id,
    ...(evidence ? { evidenceId: evidence.id } : {}),
    effective: unwaivable || !waiverId,
    ...(!unwaivable && waiverId ? { waiverId } : {}),
  };
}

export function safetyBlockers(
  input: DQDetectorInput,
  index: ReliabilityIndex,
): GateBlocker[] {
  const policy = input.policy.reliabilityPolicy;
  const head = input.metadata.headRef;
  if (!policy || !head) return [];
  const allowedEnvironments = new Set<string>(policy.safety.allowedEnvironments);
  const blockers: GateBlocker[] = [];

  const candidates = input.graph.nodes
    .filter(isResilienceEvidence)
    .sort((left, right) => lexicalCompare(left.id, right.id));
  for (const candidate of candidates) {
    const test = index.testsById.get(candidate.testId);
    if (
      !test ||
      test.testExecutionMode !== "real" ||
      candidate.targetRevision !== head
    ) {
      continue;
    }
    const environmentViolation =
      candidate.environment === "production" ||
      !allowedEnvironments.has(candidate.environment) ||
      candidate.environment !== test.resilienceScenario.blastRadius.environment;
    const faultViolation = candidate.fault
      ? candidate.fault.actualTargetIds.length >
          policy.safety.maxBlastRadiusTargets ||
        candidate.fault.appliedDurationMs >
          policy.safety.maxFaultDurationSeconds * 1000 ||
        candidate.fault.actualTargetIds.length >
          test.resilienceScenario.blastRadius.maxTargets ||
        candidate.fault.actualTargetIds.some(
          (targetId) =>
            !test.resilienceScenario.blastRadius.allowedTargets.includes(targetId),
        ) ||
        candidate.fault.appliedDurationMs >
          test.resilienceScenario.blastRadius.maxDurationSeconds * 1000
      : false;
    if (!environmentViolation && !faultViolation) continue;
    for (const riskId of [...test.coveredRiskIds].sort(lexicalCompare)) {
      blockers.push(
        createBlocker(
          input,
          "BLK-REL-04",
          riskId,
          test,
          candidate,
          "Safety policy violated by a current real resilience attempt",
        ),
      );
    }
  }
  return blockers;
}

export function evidenceBlockers(
  input: DQDetectorInput,
  riskId: string,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode,
): GateBlocker[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const waiverId = validWaiverId(input, riskId, test.id);
  const threshold = policy.thresholds;
  const observed = evidence.observed;
  const blockers: GateBlocker[] = [];

  let thresholdViolated = Boolean(
    observed &&
      (observed.requestCount < threshold.minRequestCount ||
        observed.errorRate > threshold.maxErrorRate ||
        observed.latencyP95Ms > threshold.maxLatencyP95Ms ||
        observed.saturationPct > threshold.maxSaturationPct ||
        observed.duplicateSideEffects > threshold.maxDuplicateSideEffects ||
        observed.dataInconsistencies > threshold.maxDataInconsistencies),
  );
  let recoverySloViolated = false;
  for (const slo of test.resilienceScenario.steadyState.slos) {
    for (const metric of evidence.signalManifest?.metrics ?? []) {
      if (
        !metricMatchesSlo(metric, slo) ||
        !slo.evaluationPhases.includes(
          metric.phase as "steady_state" | "fault" | "recovery",
        )
      ) {
        continue;
      }
      if (!targetSatisfied(metric.observedValue, slo)) {
        if (metric.phase === "fault") thresholdViolated = true;
        if (metric.phase === "recovery") recoverySloViolated = true;
      }
    }
  }

  if (thresholdViolated) {
    blockers.push(
      createBlocker(
        input,
        "BLK-REL-01",
        riskId,
        test,
        evidence,
        "Resilience SLO threshold exceeded",
        waiverId,
      ),
    );
  }
  if (
    requiresQualificationEvidence(evidence) &&
    policy.requireRecoveryObservation &&
    (evidence.recovered !== true ||
      evidence.recoveryConfirmedAt === undefined ||
      evidence.recoveryDurationMs === undefined ||
      evidence.recoveryDurationMs > threshold.maxRecoverySeconds * 1000 ||
      recoverySloViolated)
  ) {
    blockers.push(
      createBlocker(
        input,
        "BLK-REL-02",
        riskId,
        test,
        evidence,
        "Recovery is absent or exceeds the resilience threshold",
        waiverId,
      ),
    );
  }
  if (!isPassing(evidence)) {
    blockers.push(
      createBlocker(
        input,
        "BLK-REL-03",
        riskId,
        test,
        evidence,
        "Resilience execution status is " + evidence.status,
        waiverId,
      ),
    );
  }
  return blockers;
}
