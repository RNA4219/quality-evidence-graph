import type { GatePolicy, LegacyTestNode, PlacementCandidateScore, PlacementLayer, QegNode, QualityEvidenceGraph, RiskNode, TestNode, TestObligation, TestPlacementNode, TestPlacementPlan } from "./types.js";
import { requirementAncestors } from "./graph/requirements.js";

export const PLACEMENT_LAYERS: readonly PlacementLayer[] = ["unit", "integration", "system", "e2e", "manual-scripted", "manual-exploratory", "spec-clarification"];
const COSTS = [0.1, 0.25, 0.45, 0.7, 0.6, 0.65, 0.15];
const ordered = (ids: readonly string[]): string[] => [...new Set(ids)].sort();
function linked(graph: QualityEvidenceGraph, id: string, kind: QegNode["kind"]): string[] {
  const ids = graph.edges.flatMap(e => e.from === id ? [e.to] : e.to === id ? [e.from] : []);
  return ordered(ids.filter(ref => graph.nodes.some(n => n.id === ref && n.kind === kind)));
}
function obligation(graph: QualityEvidenceGraph, node: QegNode): TestObligation {
  const risks = node.kind === "risk" ? [node.id] : linked(graph, node.id, "risk");
  const changes = node.kind === "changed_code" ? [node.id] : linked(graph, node.id, "changed_code");
  for (const finding of linked(graph, node.id, "finding")) changes.push(...linked(graph, finding, "changed_code"));
  const risk = node.kind === "risk" ? node : undefined;
  return { id: `qeg:obligation:${encodeURIComponent(node.id)}`, requirementIds: requirementAncestors(linked(graph, node.id, "requirement"), graph.nodes, graph.edges), riskIds: ordered(risks),
    failureModeIds: linked(graph, node.id, "failure_mode"), changedCodeIds: ordered(changes), priority: risk?.priority ?? "P1",
    riskPriorityIndex: risk ? Math.round(100 * (risk.likelihood + risk.businessImpact + risk.complianceCriticality + risk.evidenceGap + risk.novelty) / 5) : 50,
    gateRelevance: "blocking", traceability: node.traceability };
}
function covers(test: TestNode, obligation: TestObligation): boolean {
  if (test.deleted || test.testExecutionMode !== "real") return false;
  if (obligation.riskIds.length) return obligation.riskIds.every(id => test.coveredRiskIds?.includes(id));
  return test.testType !== "resilience" && obligation.changedCodeIds.length > 0 && obligation.changedCodeIds.every(id => test.coveredChangedCodeIds?.includes(id));
}
function hasOracle(test: TestNode): boolean {
  if (test.testType === "resilience") return true;
  return test.oracleType !== undefined && test.oracleType !== "missing" && (test.oracleRefs?.length ?? 0) > 0 && (test.expectedResults?.length ?? 0) > 0;
}
function score(layer: PlacementLayer, index: number, tests: readonly TestNode[], subject: TestObligation): PlacementCandidateScore {
  const matching = tests.filter(t => t.layer === layer && hasOracle(t));
  const clarification = layer === "spec-clarification" && tests.every(t => !hasOracle(t));
  const eligible = matching.length > 0 || clarification;
  const fit = { oracleFit: matching.length ? 1 : 0, changeProximity: matching.length && subject.changedCodeIds.length ? 1 : 0,
    interactionFit: matching.length ? 1 : 0, businessFidelity: matching.length ? (index >= 2 ? 1 : 0.6) : 0,
    observability: matching.length ? 1 : 0, stability: matching.length ? 1 - COSTS[index] / 2 : 0,
    reuseGain: matching.some(t => t.existing) ? 1 : 0 };
  const costPenalty = { setupCost: COSTS[index], runtimeCost: index === 6 ? 0 : COSTS[index], flakeRisk: index === 3 ? 0.4 : index === 5 ? 0.2 : 0.1 };
  return { layer, eligible, fit, costPenalty, finalScore: Math.round(1000 * (Object.values(fit).reduce((a, b) => a + b, 0) - Object.values(costPenalty).reduce((a, b) => a + b, 0))) / 1000,
    rationale: [matching.length ? `${matching.length} explicitly linked test(s) with expected results and oracle references` : clarification ? "Oracle contract is missing; clarification is required" : "No eligible test explicitly covers this obligation",
      "Tie-break: fixed layer order; producer suggestion does not establish execution"],
    sourceRefs: matching.flatMap(t => t.testType === "resilience" ? [...t.traceability.sourceRefs] : [...(t.oracleRefs ?? [])]).concat([...subject.traceability.sourceRefs]) };
}

/** Plan creation never fabricates tests or successful executions and does not mutate the graph. */
export function placeTests(graph: QualityEvidenceGraph, _policy?: GatePolicy): TestPlacementPlan {
  const obligations = graph.nodes.filter((n): n is RiskNode => n.kind === "risk").map(n => obligation(graph, n));
  const coveredChanges = new Set(obligations.flatMap(o => [...o.changedCodeIds]));
  obligations.push(...graph.nodes.filter(n => n.kind === "changed_code" && !coveredChanges.has(n.id)).map(n => obligation(graph, n)));
  obligations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const placements: TestPlacementNode[] = obligations.map(subject => {
    const tests = graph.nodes.filter((n): n is TestNode => n.kind === "test" && covers(n, subject)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const candidateScores = PLACEMENT_LAYERS.map((layer, index) => score(layer, index, tests, subject));
    const selected = [...candidateScores].filter(c => c.eligible).sort((a, b) => b.finalScore - a.finalScore || PLACEMENT_LAYERS.indexOf(a.layer) - PLACEMENT_LAYERS.indexOf(b.layer))[0];
    const layer = selected?.layer ?? "spec-clarification";
    const selectedTests = tests.filter(t => t.layer === layer && hasOracle(t));
    const blocked = selectedTests.length === 0;
    const disposition = blocked ? "blocked" : layer.startsWith("manual-") ? "manual-only" : selectedTests.every(t => t.existing) ? "reuse"
      : selectedTests.some(t => t.existing) ? "adapt" : "add";
    return { id: `qeg:placement:${encodeURIComponent(subject.id)}`, kind: "test_placement", title: `${subject.id}: ${layer}`,
      obligationId: subject.id, primaryLayer: layer, disposition, gateRelevance: subject.gateRelevance, candidateScores,
      selectedTestIds: selectedTests.map(t => t.id), traceability: subject.traceability,
      sourceArtifactIds: ordered(graph.nodes.filter(n => subject.riskIds.includes(n.id) || subject.changedCodeIds.includes(n.id)).flatMap(n => [...n.sourceArtifactIds])) };
  });
  return { metadata: graph.metadata, obligations, placements };
}
