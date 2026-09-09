import type {
  Disqualification,
  ResilienceExecutionEvidenceNode,
  ResilienceTestNode,
} from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import { lifecycleDqs } from "./lifecycle.js";
import { artifactFailureClasses } from "./preflight.js";
import { signalDqs, steadyStateSloDqs } from "./signals.js";
import {
  dq,
  policyBounds,
  requiresQualificationEvidence,
  targetBounds
} from "./utils.js";
export { globalQualificationDqs } from "./preflight.js";


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
