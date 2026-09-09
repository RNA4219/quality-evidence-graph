import type {
  Disqualification,
  ResilienceExecutionEvidenceNode,
  ResilienceTestNode,
  SourceRef,
  TestNode
} from "../../types.js";
import { lexicalCompare } from "./collections.js";
export { metricMatchesSlo, policyBounds, targetBounds, targetSatisfied } from "./bounds.js";
export type { NumericBounds } from "./bounds.js";
export { decisionFingerprint } from "./fingerprint.js";
export { lexicalCompare, nearestRank, sortBlockers, sortDisqualifications, uniqueNodeIds, uniqueSourceRefs } from "./collections.js";


export const RELIABILITY_REF: SourceRef = {
  id: "qeg:reliability-extension",
  path: "docs/spec/reliability-extension.md",
};


export function isResilienceTest(node: TestNode): node is ResilienceTestNode {
  return node.testType === "resilience";
}


export function isResilienceEvidence(node: unknown): node is ResilienceExecutionEvidenceNode {
  return Boolean(node) && typeof node === "object" &&
    (node as { kind?: string }).kind === "execution_evidence" &&
    (node as { evidenceType?: string }).evidenceType === "resilience";
}


export function dq(
  code: Disqualification["code"],
  message: string,
  nodeIds: readonly string[],
): Disqualification {
  return {
    code,
    message,
    nodeIds: [...nodeIds].sort(lexicalCompare),
    sourceRefs: [RELIABILITY_REF],
  };
}


export function isFullGitObjectId(value: string | undefined): boolean {
  return Boolean(value && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value));
}


export function isSha256(value: string | undefined): boolean {
  return Boolean(value && /^sha256:[a-f0-9]{64}$/.test(value));
}


export function sameNumber(left: number | undefined, right: number | undefined): boolean {
  return left !== undefined && right !== undefined && left === right;
}


export function isPassing(evidence: ResilienceExecutionEvidenceNode): boolean {
  return evidence.status === "pass" && evidence.passed !== false;
}


export function requiresQualificationEvidence(
  evidence: ResilienceExecutionEvidenceNode,
): boolean {
  return evidence.status === "pass" ||
    evidence.status === "fail" ||
    evidence.status === "aborted";
}
