import type { Disqualification, QegNode, TestPlacementNode } from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import { inputSource } from "../../input-contract.js";

export function detectGraphIntegrity(input: DQDetectorInput): Disqualification[] {
  const result: Disqualification[] = [];
  const issue = (pointer: string, message: string, ids: readonly string[]): void => {
    result.push({ code: "DQ-03", message, nodeIds: ids, sourceRefs: [inputSource(pointer, message)] });
  };
  const unique = (values: readonly { id: string }[], pointer: string): void => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value.id)) issue(pointer, `Duplicate ID "${value.id}"`, [value.id]);
      seen.add(value.id);
    }
  };
  unique(input.graph.nodes, "/graph/nodes");
  unique(input.graph.edges, "/graph/edges");
  unique(input.metadata.inputArtifacts, "/metadata/inputArtifacts");
  const nodes = new Map(input.graph.nodes.map(n => [n.id, n]));
  const resolve = (ids: readonly string[], kind: QegNode["kind"] | undefined, pointer: string): void => {
    for (const id of ids) if (!nodes.has(id) || (kind && nodes.get(id)?.kind !== kind)) {
      issue(pointer, `Unresolved ${kind ?? "node"} reference "${id}"`, [id]);
    }
  };
  const checkPlacementLayer = (placement: TestPlacementNode, pointer: string): void => {
    for (const id of placement.selectedTestIds) {
      const test = nodes.get(id);
      if (test?.kind === "test" && test.layer !== placement.primaryLayer) {
        issue(pointer, `Placement "${placement.id}" layer disagrees with selected test "${id}"`, [placement.id, id]);
      }
    }
  };
  for (const [index, edge] of input.graph.edges.entries()) resolve([edge.from, edge.to], undefined, `/graph/edges/${index}`);
  const artifacts = new Set(input.metadata.inputArtifacts.map(a => a.id));
  for (const [index, node] of input.graph.nodes.entries()) {
    const pointer = `/graph/nodes/${index}`;
    for (const id of node.sourceArtifactIds) if (!artifacts.has(id)) issue(pointer, `Unresolved artifact reference "${id}"`, [node.id, id]);
    if (node.kind === "requirement") resolve(node.acceptanceCriteriaIds, "acceptance_criteria", pointer);
    if (node.kind === "acceptance_criteria") resolve(node.requirementIds, "requirement", pointer);
    if (node.kind === "finding") resolve(node.changedCodeIds, "changed_code", pointer);
    if (node.kind === "failure_mode") resolve(node.riskIds, "risk", pointer);
    if (node.kind === "test") {
      resolve(node.coveredRiskIds ?? [], "risk", pointer);
      if (node.testType !== "resilience") {
        resolve(node.coveredRequirementIds ?? [], "requirement", pointer);
        resolve(node.coveredChangedCodeIds ?? [], "changed_code", pointer);
      }
    }
    if (node.kind === "execution_evidence" && node.evidenceType === "resilience") resolve([node.testId], "test", pointer);
  }
  for (const [index, node] of input.graph.nodes.entries()) if (node.kind === "test_placement") {
    const pointer = `/graph/nodes/${index}`;
    resolve(node.selectedTestIds, "test", pointer);
    checkPlacementLayer(node, pointer);
    if (!input.placementPlan?.obligations.some(o => o.id === node.obligationId)) {
      issue(pointer, `Unresolved obligation "${node.obligationId}"`, [node.id]);
    }
    const planned = input.placementPlan?.placements.find(p => p.id === node.id);
    if (planned && (planned.obligationId !== node.obligationId || planned.primaryLayer !== node.primaryLayer ||
      planned.disposition !== node.disposition || [...planned.selectedTestIds].sort().join("\n") !== [...node.selectedTestIds].sort().join("\n"))) {
      issue(pointer, `Graph and plan disagree for placement "${node.id}"`, [node.id]);
    }
  }
  if (!input.placementPlan) return result;
  const plan = input.placementPlan;
  unique(plan.obligations, "/placementPlan/obligations");
  unique(plan.placements, "/placementPlan/placements");
  const obligations = new Set(plan.obligations.map(o => o.id));
  for (const [index, obligation] of plan.obligations.entries()) {
    const pointer = `/placementPlan/obligations/${index}`;
    resolve(obligation.changedCodeIds, "changed_code", pointer);
    resolve(obligation.riskIds, "risk", pointer);
    resolve(obligation.requirementIds, "requirement", pointer);
    resolve(obligation.failureModeIds, "failure_mode", pointer);
  }
  for (const [index, placement] of plan.placements.entries()) {
    const pointer = `/placementPlan/placements/${index}`;
    if (!obligations.has(placement.obligationId)) issue(pointer, `Unresolved obligation "${placement.obligationId}"`, [placement.id]);
    resolve(placement.selectedTestIds, "test", pointer);
    checkPlacementLayer(placement, pointer);
  }
  return result;
}
