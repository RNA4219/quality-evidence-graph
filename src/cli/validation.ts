import { getExitCode } from "../gate.js";
import type { Disqualification, DisqualificationCode, GateBlocker } from "../types.js";
import { CliError } from "./errors.js";
import type { EvaluatedFixture, ExpectedGateVerdict } from "./fixture-io.js";

function sortedDqCodes(disqualifications: readonly Partial<Disqualification>[]): DisqualificationCode[] {
  return disqualifications
    .map((disqualification) => disqualification.code)
    .filter((code): code is DisqualificationCode => code !== undefined)
    .sort();
}

function dqCodesMatch(
  expectedCodes: readonly DisqualificationCode[],
  actualCodes: readonly DisqualificationCode[],
  mode: "exact" | "includes"
): boolean {
  if (mode === "includes") {
    return expectedCodes.every((code) => actualCodes.includes(code));
  }

  return expectedCodes.length === actualCodes.length &&
    expectedCodes.every((code, index) => code === actualCodes[index]);
}

export interface FixtureValidationComparison {
  readonly actualExitCode: number;
  readonly verdictMatch: boolean;
  readonly exitCodeMatch: boolean;
  readonly expectedDqCodes: readonly DisqualificationCode[];
  readonly actualDqCodes: readonly DisqualificationCode[];
  readonly mode: "exact" | "includes";
  readonly dqMatch: boolean;
  readonly unexpectedDqCodes: readonly DisqualificationCode[];
  readonly missingDqCodes: readonly DisqualificationCode[];
  readonly expectedBlockerIds: readonly string[];
  readonly actualBlockerIds: readonly string[];
  readonly blockerMatch: boolean;
  readonly passed: boolean;
}

function expectedBlockerMatches(
  expected: NonNullable<ExpectedGateVerdict["expectedBlockers"]>[number],
  actual: GateBlocker,
): boolean {
  if (actual.id !== expected.id || actual.message !== expected.message) return false;
  const fields = [
    "ruleId",
    "riskIds",
    "testId",
    "evidenceId",
    "effective",
    "waiverId",
  ] as const;
  return fields.every((field) => {
    const expectedValue = expected[field];
    if (expectedValue === undefined) return true;
    const actualValue = actual[field];
    return Array.isArray(expectedValue)
      ? JSON.stringify(actualValue) === JSON.stringify(expectedValue)
      : actualValue === expectedValue;
  });
}

export function compareEvaluatedFixture(
  expected: ExpectedGateVerdict,
  evaluated: EvaluatedFixture
): FixtureValidationComparison {
  const { gateResult, policy } = evaluated;
  const actualExitCode = getExitCode(gateResult.verdict, policy);
  const verdictMatch = gateResult.verdict === expected.expectedVerdict;
  const exitCodeMatch = actualExitCode === expected.expectedExitCode;
  const expectedDqCodes = sortedDqCodes(expected.expectedDisqualifications);
  const actualDqCodes = sortedDqCodes(gateResult.disqualifications);
  const mode = expected.expectedDisqualificationMode ?? "exact";
  const dqMatch = dqCodesMatch(expectedDqCodes, actualDqCodes, mode);
  const unexpectedDqCodes = mode === "exact"
    ? actualDqCodes.filter((code) => !expectedDqCodes.includes(code))
    : [];
  const missingDqCodes = expectedDqCodes.filter((code) => !actualDqCodes.includes(code));
  const expectedBlockers = expected.expectedBlockers ?? [];
  const expectedBlockerIds = expectedBlockers.map((blocker) => blocker.id).sort();
  const actualBlockerIds = gateResult.blockers.map((blocker: GateBlocker) => blocker.id).sort();
  const blockerMode = expected.expectedBlockerMode ?? (expectedBlockers.length > 0 ? "exact" : undefined);
  const blockerMatch = blockerMode === undefined || (
    (blockerMode === "includes" || (expectedBlockerIds.length === actualBlockerIds.length && expectedBlockerIds.every((id, index) => id === actualBlockerIds[index]))) &&
    expectedBlockers.every((blocker) =>
      gateResult.blockers.some((actual) => expectedBlockerMatches(blocker, actual))
    )
  );

  return {
    actualExitCode,
    verdictMatch,
    exitCodeMatch,
    expectedDqCodes,
    actualDqCodes,
    mode,
    dqMatch,
    unexpectedDqCodes,
    missingDqCodes,
    expectedBlockerIds,
    actualBlockerIds,
    blockerMatch,
    passed: verdictMatch && exitCodeMatch && dqMatch && blockerMatch,
  };
}

export function validateEvaluatedFixture(
  expected: ExpectedGateVerdict,
  evaluated: EvaluatedFixture
): void {
  const { gateResult } = evaluated;
  const comparison = compareEvaluatedFixture(expected, evaluated);

  console.log(`Fixture: ${expected.fixture}`);
  console.log(`Description: ${expected.description}`);
  console.log(`Expected verdict: ${expected.expectedVerdict}`);
  console.log(`Actual verdict: ${gateResult.verdict}`);
  console.log(`Verdict match: ${comparison.verdictMatch ? "PASS" : "FAIL"}`);
  console.log(`Expected exit code: ${expected.expectedExitCode}`);
  console.log(`Actual exit code: ${comparison.actualExitCode}`);
  console.log(`Exit code match: ${comparison.exitCodeMatch ? "PASS" : "FAIL"}`);
  console.log(`Contract ref: ${expected.contractRef}`);
  console.log(`DQ validation mode: ${comparison.mode}`);
  console.log(`Expected DQ codes: ${comparison.expectedDqCodes.join(", ")}`);
  console.log(`Actual DQ codes: ${comparison.actualDqCodes.join(", ")}`);

  if (comparison.mode === "exact" && !comparison.dqMatch) {
    if (comparison.unexpectedDqCodes.length > 0) {
      console.log(`Unexpected DQ codes (present but not expected): ${comparison.unexpectedDqCodes.join(", ")}`);
    }
    if (comparison.missingDqCodes.length > 0) {
      console.log(`Missing DQ codes (expected but not present): ${comparison.missingDqCodes.join(", ")}`);
    }
  }

  console.log(`DQ codes match: ${comparison.dqMatch ? "PASS" : "FAIL"}`);
  console.log(`Expected blocker IDs: ${comparison.expectedBlockerIds.join(", ")}`);
  console.log(`Actual blocker IDs: ${comparison.actualBlockerIds.join(", ")}`);
  console.log(`Blockers match: ${comparison.blockerMatch ? "PASS" : "FAIL"}`);

  if (!comparison.passed) {
    throw new CliError("Validation: FAIL");
  }

  console.log("Validation: PASS");
}
