import type {
  ExcludedTestEvidence,
  QualityEvidenceGraph,
  QegNode,
  TestEvidenceAccounting,
  TestNode,
} from "../types.js";

export function isTestNode(node: QegNode): node is TestNode {
  return node.kind === "test";
}

/**
 * Only executions against real behavior can improve a QEG Gate decision.
 * Mock tests remain in the graph for traceability but are excluded from every
 * test-evidence count and threshold.
 */
export function isGateEligibleTestEvidence(test: TestNode): boolean {
  return test.testExecutionMode === "real";
}

export function buildTestEvidenceAccounting(
  graph: QualityEvidenceGraph
): TestEvidenceAccounting {
  const tests = graph.nodes.filter(isTestNode);
  const countedTestIds = tests
    .filter((test) =>
      isGateEligibleTestEvidence(test) &&
      (test.evidenceStrength !== undefined || test.recentGreenRuns !== undefined)
    )
    .map((test) => test.id);
  const excludedMockTests: ExcludedTestEvidence[] = tests
    .filter((test) => !isGateEligibleTestEvidence(test))
    .map((test) => ({
      testId: test.id,
      reason: "mock_test",
      sourceRefs: test.traceability.sourceRefs,
    }));

  return { countedTestIds, excludedMockTests };
}
