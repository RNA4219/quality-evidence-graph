import type { QegNode, QegEdge, LegacyTestNode } from "../types.js";
import { requirementAncestors } from "./requirements.js";

/** Follow only explicit trace links. Shared requirements do not imply coverage of every risk. */
export function enrichTestCoverage(nodes: readonly QegNode[], edges: readonly QegEdge[]): QegNode[] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const changedFor = (id: string): string[] => {
    const related = edges.flatMap(e => e.from === id && (e.kind === "touches" || e.kind === "derives_from") ? [e.to]
      : e.to === id && e.kind === "touches" ? [e.from] : []);
    return related.flatMap(ref => { const n = byId.get(ref); return n?.kind === "changed_code" ? [n.id] : n?.kind === "finding" ? [...n.changedCodeIds] : []; });
  };
  const enriched = nodes.map(node => {
    if (node.kind !== "test" || node.testType === "resilience") return node;
    const explicit = edges.filter(e => e.to === node.id && e.kind === "requires_test").map(e => byId.get(e.from));
    const risks = [...new Set([...(node.coveredRiskIds ?? []), ...explicit.filter(n => n?.kind === "risk").map(n => n!.id)])].sort();
    const requirements = requirementAncestors([...(node.coveredRequirementIds ?? []), ...explicit.filter(n => n?.kind === "requirement").map(n => n!.id)], nodes, edges);
    const changes = [...new Set([...(node.coveredChangedCodeIds ?? []), ...risks.flatMap(changedFor), ...requirements.flatMap(changedFor)])].sort();
    return { ...node, coveredRiskIds: risks, coveredRequirementIds: requirements, coveredChangedCodeIds: changes } satisfies LegacyTestNode;
  });
  return enriched.map(node => {
    if (node.kind !== "risk") return node;
    const observed = enriched.some(test => {
      if (test.kind !== "test" || test.testType === "resilience" || test.deleted || test.testExecutionMode !== "real" || !test.coveredRiskIds?.includes(node.id)) return false;
      if (!test.oracleRefs?.length || !test.expectedResults?.length || !test.oracleType || test.oracleType === "missing") return false;
      const refs = new Set(edges.filter(e => e.kind === "evidenced_by" && e.from === test.id).map(e => e.to));
      const executions = enriched.filter(e => e.kind === "execution_evidence" && refs.has(e.id));
      return executions.length > 0 && executions.every(e => e.kind === "execution_evidence" && e.passed !== undefined && e.evidenceRefs.length > 0);
    });
    // Evidence completeness is separate from passing: a failed execution remains a Gate blocker.
    return observed ? { ...node, evidenceGap: 0 } : node;
  });
}
