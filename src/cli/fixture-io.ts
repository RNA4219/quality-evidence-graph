import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { CliError } from "./errors.js";
import { evaluateGate } from "../gate.js";
import type {
  Disqualification,
  EvidencePackage,
  GatePolicy,
  GateResult,
  QualityEvidenceGraph,
  QegMetadata,
  TestPlacementPlan,
  Waiver,
} from "../types.js";

export interface ExpectedGateVerdict {
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

export interface FixtureInput {
  metadata: QegMetadata;
  graph: QualityEvidenceGraph;
  policy: GatePolicy;
  waivers?: Waiver[];
  evidencePackage?: EvidencePackage;
  placementPlan?: TestPlacementPlan;
}

export interface EvaluatedFixture {
  fixtureDir: string;
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

export async function readExpectedVerdict(fixtureDir: string): Promise<ExpectedGateVerdict> {
  const expectedPath = join(fixtureDir, "expected-gate-verdict.json");
  try {
    return await readJsonFile<ExpectedGateVerdict>(expectedPath);
  } catch (error) {
    throw new CliError(`Error reading expected verdict: ${error}`, error instanceof Error ? error : undefined);
  }
}

export async function readFixtureInput(fixtureDir: string): Promise<FixtureInput> {
  const inputPath = join(fixtureDir, "gate-input.json");
  try {
    return await readJsonFile<FixtureInput>(inputPath);
  } catch (error) {
    throw new CliError(
      `gate-input.json not found or invalid - IPO controlled requires real input artifacts\nInput file: ${inputPath}\nError: ${error}`,
      error instanceof Error ? error : undefined
    );
  }
}

export async function evaluateFixture(rawFixtureDir: string): Promise<EvaluatedFixture> {
  const fixtureDir = resolve(rawFixtureDir);
  const input = await readFixtureInput(fixtureDir);
  const waivers = [...(input.waivers ?? [])];

  console.log("Using gate-input.json (real input artifacts)");

  return {
    fixtureDir,
    metadata: input.metadata,
    graph: input.graph,
    policy: input.policy,
    waivers,
    evidencePackage: input.evidencePackage,
    placementPlan: input.placementPlan,
    gateResult: evaluateGate({
      metadata: input.metadata,
      graph: input.graph,
      policy: input.policy,
      waivers,
      evidencePackage: input.evidencePackage,
      placementPlan: input.placementPlan,
    }),
  };
}
