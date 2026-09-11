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
import { detectGraphIntegrity } from "./dq/graph-integrity.js";
import { evaluateRequiredExecutions } from "./dq/placement-coverage.js";
import { sourceDiagnostics } from "./diagnostics.js";
import { upstreamDecisions } from "./upstream.js";
import { evaluateExecutions } from "./execution/evaluator.js";
import { timestampNanos } from "../timestamps.js";

export function evaluateGate(input: GateEvaluationInput): GateResult {
  // A Gate must be reproducible.  The evaluation clock is the recorded QEG
  // creation time, never the machine clock of the evaluator.
  const executionNanos = timestampNanos(input.metadata.createdAt);
  const clockDqs: Disqualification[] = executionNanos !== undefined ? [] : [{
    code: "DQ-01",
    message: `metadata.createdAt is not a parseable evaluation clock: ${input.metadata.createdAt}`,
    nodeIds: [],
    sourceRefs: [{ id: "qeg:evaluation-clock", path: "docs/spec/reliability-extension.md" }],
  }];
  const validWaivers = executionNanos !== undefined ? input.waivers.filter(
    (waiver) => validateWaiver(waiver, input.graph, input.metadata.createdAt).valid
  ) : [];
  const context = createGateEvaluationContext({
    ...input,
    preflightDisqualifications: [...(input.preflightDisqualifications ?? []), ...clockDqs],
  }, validWaivers);

  const reliability = evaluateReliability(context);
  const qualified = evaluateExecutions(context);
  context.executionAccounting = qualified.accounting;
  const executions = evaluateRequiredExecutions(context, reliability.accounting);
  const upstream = upstreamDecisions(input.graph);
  const enrichedContext = { ...context, blockers: [...context.blockers, ...reliability.blockers, ...executions.blockers, ...qualified.blockers, ...upstream.blockers] };
  const disqualifications = sourceDiagnostics([...detectAllDQs(enrichedContext), ...detectGraphIntegrity(context), ...executions.disqualifications, ...qualified.disqualifications, ...upstream.disqualifications, ...reliability.disqualifications], input.graph);
  const blockers = sourceDiagnostics(enrichedContext.blockers, input.graph);
  const residualRisks = computeResidualRisks(enrichedContext);
  const requiredHumanReview = [...new Set([...computeRequiredHumanReview(input.graph, validWaivers, residualRisks, input.placementPlan), ...upstream.humanReview])];
  const verdict = computeVerdict(
    disqualifications,
    blockers,
    residualRisks,
    requiredHumanReview,
    validWaivers
  );

  return {
    ...(input.policy.inputContract ? { evaluationScope: input.policy.inputContract.evaluationScope } : {}),
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
    testEvidenceAccounting: buildTestEvidenceAccounting(input.graph, qualified.accounting),
    ...(qualified.accounting ? { executionAccounting: qualified.accounting } : {}),
    reliability: reliability.accounting,
  };
}
