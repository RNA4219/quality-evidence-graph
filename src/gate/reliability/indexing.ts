import type { TestNode } from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import type { ReliabilityIndex } from "./contracts.js";
import { isResilienceTest, lexicalCompare } from "./utils.js";

export function buildReliabilityIndex(input: DQDetectorInput): ReliabilityIndex {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) throw new Error("reliability policy is required");

  const allTests = input.graph.nodes
    .filter((node): node is TestNode => node.kind === "test")
    .sort((left, right) => lexicalCompare(left.id, right.id));
  const resilienceTests = allTests.filter(isResilienceTest);
  const testsById = new Map(resilienceTests.map((test) => [test.id, test]));
  const requiredRisks = [...(input.riskNodes ??
    input.graph.nodes.filter((node) => node.kind === "risk"))]
    .filter((risk) => policy.requiredForSeverities.includes(risk.severity))
    .sort((left, right) => lexicalCompare(left.id, right.id));
  const testsByRiskId = new Map(
    requiredRisks.map((risk) => [
      risk.id,
      resilienceTests.filter(
        (test) =>
          !test.deleted &&
          test.testExecutionMode === "real" &&
          test.coveredRiskIds.includes(risk.id),
      ),
    ]),
  );
  const excludedMockTests = resilienceTests
    .filter((test) => test.testExecutionMode === "mock")
    .map((test) => ({
      testId: test.id,
      reason: "mock_test" as const,
      sourceRefs: [...test.traceability.sourceRefs].sort(
        (left, right) =>
          lexicalCompare(left.id, right.id) || lexicalCompare(left.path, right.path),
      ),
    }))
    .sort((left, right) => lexicalCompare(left.testId, right.testId));

  return {
    allTests,
    resilienceTests,
    testsById,
    requiredRisks,
    testsByRiskId,
    excludedMockTests,
  };
}
