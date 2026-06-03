/**
 * CLI for IPO controlled profile gate evaluation.
 *
 * Commands:
 * - validate <fixture-dir>: compare actual gate verdict against expected
 * - gate <fixture-dir>: evaluate gate and output verdict with correct exit code
 * - record <fixture-dir>: generate QualityEvidenceRecord
 *
 * IPO controlled fixtures require gate-input.json. Missing or invalid input is
 * a command failure (exit 1), never a synthetic fallback.
 */

import { readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { exit } from "process";
import { evaluateGate, getExitCode } from "./gate.js";
import type {
  AuditTrail,
  Disqualification,
  DisqualificationCode,
  EvidencePackage,
  GatePolicy,
  GateResult,
  QualityEvidenceGraph,
  QualityEvidenceRecord,
  QegMetadata,
  TestPlacementPlan,
  Waiver,
} from "./types.js";

interface ExpectedGateVerdict {
  fixture: string;
  description: string;
  expectedVerdict: "go" | "conditional_go" | "no_go" | "disqualified";
  expectedDisqualifications: Partial<Disqualification>[];
  expectedBlockers: { id: string; message: string }[];
  expectedResidualRisks: string[];
  expectedHumanReview: string[];
  expectedExitCode: number;
  contractRef: string;
  expectedDisqualificationMode?: "exact" | "includes";
}

interface FixtureInput {
  metadata: QegMetadata;
  graph: QualityEvidenceGraph;
  policy: GatePolicy;
  waivers?: Waiver[];
  evidencePackage?: EvidencePackage;
  placementPlan?: TestPlacementPlan;
}

interface EvaluatedFixture {
  metadata: QegMetadata;
  graph: QualityEvidenceGraph;
  policy: GatePolicy;
  waivers: Waiver[];
  evidencePackage: EvidencePackage | undefined;
  placementPlan: TestPlacementPlan | undefined;
  gateResult: GateResult;
}

async function readJsonFile<T>(path: string): Promise<T> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as T;
}

async function readFixtureInput(fixtureDir: string): Promise<FixtureInput> {
  const inputPath = join(fixtureDir, "gate-input.json");
  try {
    return await readJsonFile<FixtureInput>(inputPath);
  } catch (error) {
    console.error("gate-input.json not found or invalid - IPO controlled requires real input artifacts");
    console.error(`Input file: ${inputPath}`);
    console.error(`Error: ${error}`);
    exit(1);
  }
}

async function readExpectedVerdict(fixtureDir: string): Promise<ExpectedGateVerdict> {
  const expectedPath = join(fixtureDir, "expected-gate-verdict.json");
  try {
    return await readJsonFile<ExpectedGateVerdict>(expectedPath);
  } catch (error) {
    console.error(`Error reading expected verdict: ${error}`);
    exit(1);
  }
}

async function evaluateFixture(fixtureDir: string): Promise<EvaluatedFixture> {
  const input = await readFixtureInput(fixtureDir);
  const waivers = [...(input.waivers ?? [])];

  console.log("Using gate-input.json (real input artifacts)");

  const gateResult = evaluateGate({
    metadata: input.metadata,
    graph: input.graph,
    policy: input.policy,
    waivers,
    evidencePackage: input.evidencePackage,
    placementPlan: input.placementPlan,
  });

  return {
    metadata: input.metadata,
    graph: input.graph,
    policy: input.policy,
    waivers,
    evidencePackage: input.evidencePackage,
    placementPlan: input.placementPlan,
    gateResult,
  };
}

function sortedDqCodes(disqualifications: readonly Partial<Disqualification>[]): DisqualificationCode[] {
  return disqualifications
    .map((d) => d.code)
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

  if (expectedCodes.length !== actualCodes.length) {
    return false;
  }

  return expectedCodes.every((code, index) => code === actualCodes[index]);
}

function buildAuditTrail(evidencePackage: EvidencePackage | undefined, policy: GatePolicy): AuditTrail | undefined {
  if (!evidencePackage) {
    return undefined;
  }

  return {
    evidencePackageHash: evidencePackage.evidencePackageHash,
    approvalEvidenceSummary: evidencePackage.approvalEvidence.map((approval) => ({
      id: approval.id,
      approver: approval.approver,
      approvedAt: approval.approvedAt,
      policyId: approval.policyId,
      policyHash: approval.policyHash,
      evidencePackageHash: approval.evidencePackageHash,
    })),
    gatePolicyHash: policy.policyHash,
    gatePolicyId: policy.policyId,
  };
}

async function validateFixture(fixtureDir: string): Promise<void> {
  const expected = await readExpectedVerdict(fixtureDir);
  const evaluated = await evaluateFixture(fixtureDir);
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
    exit(1);
  }

  console.log("Validation: PASS");
}

async function evaluateGateCommand(fixtureDir: string): Promise<void> {
  const { gateResult, policy } = await evaluateFixture(fixtureDir);
  console.log(JSON.stringify(gateResult, null, 2));
  exit(getExitCode(gateResult.verdict, policy));
}

async function recordFixture(fixtureDir: string): Promise<void> {
  const evaluated = await evaluateFixture(fixtureDir);
  const placementPlan = evaluated.placementPlan ?? {
    metadata: evaluated.metadata,
    obligations: [],
    placements: [],
  };

  const record: QualityEvidenceRecord = {
    metadata: evaluated.metadata,
    graph: evaluated.graph,
    placementPlan,
    gate: evaluated.gateResult,
    exports: [
      { kind: "json", path: join(fixtureDir, "output-record.json") },
    ],
    auditTrail: buildAuditTrail(evaluated.evidencePackage, evaluated.policy),
  };

  const recordJson = JSON.stringify(record, null, 2);
  try {
    JSON.parse(recordJson);
    console.log("Own-output validation: PASS (record can be serialized and parsed)");
  } catch (error) {
    console.error(`Own-output validation: FAIL - ${error}`);
    exit(1);
  }

  const outputPath = join(fixtureDir, "output-record.json");
  await writeFile(outputPath, recordJson, "utf-8");
  console.log(`Record written to: ${outputPath}`);

  exit(getExitCode(evaluated.gateResult.verdict, evaluated.policy));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: qeg <command> <fixture-dir>");
    console.error("Commands: validate, gate, record");
    exit(1);
  }

  const command = args[0];
  const fixtureDir = resolve(args[1]);

  switch (command) {
    case "validate":
      await validateFixture(fixtureDir);
      break;
    case "gate":
      await evaluateGateCommand(fixtureDir);
      break;
    case "record":
      await recordFixture(fixtureDir);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      exit(1);
  }
}

main().catch((error) => {
  console.error(`Command failure: ${error}`);
  exit(1);
});
