import type { Disqualification, GateResult } from "../types.js";
import type { GateEvaluationInput } from "./context.js";
import { createGateEvaluationContext } from "./context.js";
import { detectAllDQs } from "./dq-detectors.js";
import { evaluateReliability } from "./reliability.js";
import { validateWaiver } from "./waivers.js";
import {
  buildReasons,
  computeRequiredHumanReview,
  computeResidualRisks,
  computeVerdict,
} from "./verdict.js";
import { buildTestEvidenceAccounting } from "./test-evidence.js";

export function evaluateGate(input: GateEvaluationInput): GateResult {
  // A Gate must be reproducible.  The evaluation clock is the recorded QEG
  // creation time, never the machine clock of the evaluator.
  const executionMs = Date.parse(input.metadata.createdAt);
  const clockDqs: Disqualification[] = Number.isFinite(executionMs) ? [] : [{
    code: "DQ-01",
    message: `metadata.createdAt is not a parseable evaluation clock: ${input.metadata.createdAt}`,
    nodeIds: [],
    sourceRefs: [{ id: "qeg:evaluation-clock", path: "docs/spec/reliability-extension.md" }],
  }];
  const executionTime = new Date(executionMs);
  const validWaivers = Number.isFinite(executionMs) ? input.waivers.filter(
    (waiver) => validateWaiver(waiver, input.graph, executionTime).valid
  ) : [];
  const context = createGateEvaluationContext({
    ...input,
    preflightDisqualifications: [...(input.preflightDisqualifications ?? []), ...clockDqs],
  }, validWaivers);

  const reliability = evaluateReliability(context);
  const enrichedContext = { ...context, blockers: [...context.blockers, ...reliability.blockers] };
  const disqualifications = [...detectAllDQs(enrichedContext), ...reliability.disqualifications];
  const blockers = enrichedContext.blockers;
  const residualRisks = computeResidualRisks(enrichedContext);
  const requiredHumanReview = computeRequiredHumanReview(input.graph, validWaivers, residualRisks);
  const verdict = computeVerdict(
    disqualifications,
    blockers,
    residualRisks,
    requiredHumanReview,
    validWaivers
  );

  return {
    metadata: input.metadata,
    verdict,
    reasons: buildReasons(
      verdict,
      disqualifications,
      blockers,
      residualRisks,
      requiredHumanReview,
      validWaivers
    ),
    disqualifications,
    blockers,
    residualRisks,
    requiredHumanReview,
    testEvidenceAccounting: buildTestEvidenceAccounting(input.graph),
    reliability: reliability.accounting,
  };
}
