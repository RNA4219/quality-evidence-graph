import { getExitCode } from "../gate.js";
import type { Disqualification, DisqualificationCode } from "../types.js";
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

export function validateEvaluatedFixture(
  expected: ExpectedGateVerdict,
  evaluated: EvaluatedFixture
): void {
  const { gateResult, policy } = evaluated;
  const actualExitCode = getExitCode(gateResult.verdict, policy);
  const verdictMatch = gateResult.verdict === expected.expectedVerdict;
  const exitCodeMatch = actualExitCode === expected.expectedExitCode;
  const expectedDqCodes = sortedDqCodes(expected.expectedDisqualifications);
  const actualDqCodes = sortedDqCodes(gateResult.disqualifications);
  const mode = expected.expectedDisqualificationMode ?? "exact";
  const dqMatch = dqCodesMatch(expectedDqCodes, actualDqCodes, mode);

  console.log(`Fixture: ${expected.fixture}`);
  console.log(`Description: ${expected.description}`);
  console.log(`Expected verdict: ${expected.expectedVerdict}`);
  console.log(`Actual verdict: ${gateResult.verdict}`);
  console.log(`Verdict match: ${verdictMatch ? "PASS" : "FAIL"}`);
  console.log(`Expected exit code: ${expected.expectedExitCode}`);
  console.log(`Actual exit code: ${actualExitCode}`);
  console.log(`Exit code match: ${exitCodeMatch ? "PASS" : "FAIL"}`);
  console.log(`Contract ref: ${expected.contractRef}`);
  console.log(`DQ validation mode: ${mode}`);
  console.log(`Expected DQ codes: ${expectedDqCodes.join(", ")}`);
  console.log(`Actual DQ codes: ${actualDqCodes.join(", ")}`);

  if (mode === "exact" && !dqMatch) {
    const unexpected = actualDqCodes.filter((code) => !expectedDqCodes.includes(code));
    const missing = expectedDqCodes.filter((code) => !actualDqCodes.includes(code));
    if (unexpected.length > 0) {
      console.log(`Unexpected DQ codes (present but not expected): ${unexpected.join(", ")}`);
    }
    if (missing.length > 0) {
      console.log(`Missing DQ codes (expected but not present): ${missing.join(", ")}`);
    }
  }

  console.log(`DQ codes match: ${dqMatch ? "PASS" : "FAIL"}`);

  if (!verdictMatch || !exitCodeMatch || !dqMatch) {
    throw new CliError("Validation: FAIL");
  }

  console.log("Validation: PASS");
}
