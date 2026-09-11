import type { QualityEvidenceGraph, TestNode, TestObligation, TestPlacementNode, TestPlacementPlan } from "./types.js";
import { isDeepStrictEqual } from "util";

/** Keep conflicting copies visible to integrity checks; do not overwrite by id. */
export function allTestPlacements(graph: QualityEvidenceGraph, plan?: TestPlacementPlan): TestPlacementNode[] {
  const placements = graph.nodes.filter((node): node is TestPlacementNode => node.kind === "test_placement");
  for (const placement of plan?.placements ?? []) {
    if (!placements.some(node => isDeepStrictEqual(node, placement))) placements.push(placement);
  }
  return placements;
}

export function hasUsableOracle(test: TestNode, manualScripted = test.layer === "manual-scripted"): boolean {
  if (test.testType === "resilience") return !manualScripted;
  const type = test.oracleType;
  return type !== undefined && type !== "missing" && (!manualScripted || type !== "implicit") &&
    (test.oracleRefs?.length ?? 0) > 0 && (test.expectedResults?.length ?? 0) > 0;
}

/** Retirement qualification is checked separately by DQ-14; historical tests are not current oracle claims. */
export function isRetiredManualTest(test: TestNode, plan?: TestPlacementPlan): boolean {
  return test.deleted === true && !plan?.manual_case_inventory?.current_subject_ids.includes(test.id) &&
    (plan?.placement_changes?.some(change => change.subject_id === test.id &&
      ["manual-scripted", "manual-exploratory"].includes(change.from_layer) && change.to_layer === "automated") ?? false);
}

/** Risk coverage also covers the changed code attached to that risk obligation. */
export function declaredCoverage(test: TestNode, obligation: TestObligation): readonly string[] | undefined {
  return obligation.riskIds.length ? test.coveredRiskIds : test.testType === "resilience" ? undefined : test.coveredChangedCodeIds;
}

export function requiredCoverage(obligation: TestObligation): readonly string[] {
  return obligation.riskIds.length ? obligation.riskIds : obligation.changedCodeIds;
}

export function consistentSelectedCoverage(tests: readonly TestNode[], obligation: TestObligation, legacyNative: boolean): boolean {
  const required = requiredCoverage(obligation);
  if (required.length === 0) return true;
  const undeclared = (test: TestNode): boolean => test.coveredRiskIds === undefined &&
    test.testType !== "resilience" && test.coveredChangedCodeIds === undefined;
  if (legacyNative && tests.length > 0 && tests.every(undeclared)) return true;
  const explicit = tests.filter(test => !undeclared(test));
  if (explicit.some(test => !declaredCoverage(test, obligation)?.some(id => required.includes(id)))) return false;
  const covered = new Set(explicit.flatMap(test => [...(declaredCoverage(test, obligation) ?? [])]));
  return required.every(id => covered.has(id));
}
