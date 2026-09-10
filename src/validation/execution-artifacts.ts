import type { QegGateInput, VerifiedExecutionRef } from "../types.js";
import { normalEvidence, same, validExecution, validPolicy } from "../gate/execution/contracts.js";
import { validateProducerPayload } from "../adapters/validate.js";

export interface ExecutionArtifactCandidate {
  readonly artifact: VerifiedExecutionRef;
  readonly required: true;
  readonly enforceRequired: true;
  readonly requireContainedRelativePath: true;
  readonly historical?: boolean;
  readonly payloadKey?: string;
  readonly payloadMatches?: (value: unknown) => boolean;
}
export function executionArtifacts(input: QegGateInput): ExecutionArtifactCandidate[] {
  const result: ExecutionArtifactCandidate[] = [];
  const required = { required: true, enforceRequired: true, requireContainedRelativePath: true } as const;
  const policy = input.policy.executionPolicy;
  if (validPolicy(policy)) result.push({ ...required, artifact: policy.buildBindingRef, payloadKey: "build-binding",
    payloadMatches: value => same(value, { bindingVersion: "qeg-build/v1", target: policy.target }) });
  if (validPolicy(policy)) for (const ref of input.metadata.inputArtifacts.filter(a => a.adapter === "manual-bb-test-harness" && a.kind === "gate_decision")) {
    result.push({ ...required, artifact: ref as VerifiedExecutionRef, payloadKey: "manual-build-decision",
      payloadMatches: value => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        validateProducerPayload({ ...ref, contractVersion: "manual-bb/v1" }, value as Record<string, unknown>);
        return (value as Record<string, unknown>).build_id === policy.target.buildId;
      } });
  }
  for (const node of normalEvidence(input)) {
    const detail = node.execution;
    if (!validExecution(detail)) continue;
    const historical = detail.historySourceRefs !== undefined;
    result.push({ ...required, artifact: detail.rawArtifactRef, historical, payloadKey: node.id,
      payloadMatches: value => {
        if (!value || typeof value !== "object") return false;
        const raw = value as Record<string, unknown>;
        if (detail.identity.producer === "manual-bb-test-harness") {
          validateProducerPayload({ ...detail.rawArtifactRef, adapter: "manual-bb-test-harness", kind: "execution_evidence", contractVersion: "manual-bb/v1" }, raw);
          return raw.feature_id === detail.identity.featureId && (raw.tc_id ?? raw.charter_id) === detail.identity.caseId &&
            Boolean(raw.tc_id) !== Boolean(raw.charter_id) && raw.build_id === detail.target.buildId && raw.run_id === detail.runId &&
            raw.timestamp === detail.completedAt && (raw.result === "skip" ? "skipped" : raw.result) === detail.status &&
            (raw.env === undefined || raw.env === detail.target.environmentId);
        }
        const { rawArtifactRef: _ref, historySourceRefs: _history, ...meaning } = detail;
        return same(raw, meaning);
      } });
    for (const ref of node.evidenceRefs) result.push({ ...required, artifact: ref as VerifiedExecutionRef, historical });
  }
  return result;
}
