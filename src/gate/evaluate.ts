import type { GateResult } from "../types.js";
import type { GateEvaluationInput } from "./context.js";
import { createGateEvaluationContext } from "./context.js";
import { detectAllDQs } from "./dq-detectors.js";
import { validateWaiver } from "./waivers.js";
import {
  buildReasons,
  computeRequiredHumanReview,
  computeResidualRisks,
  computeVerdict,
} from "./verdict.js";
import { buildTestEvidenceAccounting } from "./test-evidence.js";

export function evaluateGate(input: GateEvaluationInput): GateResult {
  const { executionTime = new Date() } = input;
  const validWaivers = input.waivers.filter(
    (waiver) => validateWaiver(waiver, input.graph, executionTime).valid
  );
  const context = createGateEvaluationContext(input, validWaivers);

  const disqualifications = detectAllDQs(context);
  const blockers = context.blockers;
  const residualRisks = computeResidualRisks(context);
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
  };
}
