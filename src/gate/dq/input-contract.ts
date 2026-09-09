import type { Disqualification } from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import { artifactKey, inputSource, UPSTREAM_REQUIRED_ARTIFACTS } from "../../input-contract.js";

export function detectInputContract(input: DQDetectorInput): Disqualification[] {
  const contract = input.policy.inputContract;
  const dq = (message: string, pointer: string): Disqualification => ({
    code: "DQ-01", message, nodeIds: [], sourceRefs: [inputSource(pointer, message)],
  });
  if (!contract) return [dq("Gate policy inputContract is required; choose an explicit input mode and scope", "/policy/inputContract")];
  const scope = contract.evaluationScope;
  if (!["native_graph", "upstream_artifacts"].includes(contract.mode) || !Array.isArray(contract.requiredArtifacts) ||
    contract.requiredArtifacts.some(ref => !ref || typeof ref.adapter !== "string" || !ref.adapter || typeof ref.kind !== "string" || !ref.kind) ||
    typeof contract.requireExecutedTests !== "boolean" || !scope || !["fixture", "isolated_consumer", "real_environment"].includes(scope.kind) ||
    typeof scope.target !== "string" || !scope.target.trim() || !Array.isArray(scope.notEvaluated) || scope.notEvaluated.some(item => typeof item !== "string") ||
    !Array.isArray(contract.sourceRefs) || !contract.sourceRefs.length || contract.sourceRefs.some(ref => !ref || !ref.id || !ref.path)) {
    return [dq("Gate inputContract has invalid mode, requirements, scope or source references", "/policy/inputContract")];
  }
  const result: Disqualification[] = [];
  const declared = new Set(contract.requiredArtifacts.map(artifactKey));
  if (declared.size === 0 || declared.size !== contract.requiredArtifacts.length) {
    result.push(dq("Required artifact set must be non-empty and unique", "/policy/inputContract/requiredArtifacts"));
  }
  const expected = contract.mode === "upstream_artifacts"
    ? [...new Map([...UPSTREAM_REQUIRED_ARTIFACTS, ...contract.requiredArtifacts].map(ref => [artifactKey(ref), ref])).values()]
    : contract.requiredArtifacts;
  if (contract.mode === "upstream_artifacts" && UPSTREAM_REQUIRED_ARTIFACTS.some(ref => !declared.has(artifactKey(ref)))) {
    result.push(dq("Upstream input contract cannot omit any of the fourteen required artifact kinds", "/policy/inputContract/requiredArtifacts"));
  }
  const available = new Set(input.metadata.inputArtifacts.map(artifactKey));
  const missing = expected.filter(ref => !available.has(artifactKey(ref))).map(artifactKey).sort();
  if (missing.length > 0) result.push(dq(`Missing required artifacts: ${missing.join(", ")}`, "/metadata/inputArtifacts"));
  const producers = [...new Set(expected.map(ref => ref.adapter))].sort();
  const absentStatuses = producers.filter(producer => input.metadata.requiredConnectorStatus?.[producer] === undefined);
  if (absentStatuses.length > 0) result.push(dq(`Required producer status missing: ${absentStatuses.join(", ")}`, "/metadata/requiredConnectorStatus"));
  if (input.graph.nodes.length === 0) result.push(dq("Empty graph is not sufficient for a Gate decision", "/graph/nodes"));
  return result;
}
