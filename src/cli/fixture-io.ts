import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { CliError } from "./errors.js";
import { evaluateGate } from "../gate.js";
import { validateIngestContract } from "./ingest-contract.js";
import type {
  Disqualification,
  EvidencePackage,
  GatePolicy,
  GateResult,
  OptionalEvidence,
  ParserFailure,
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
  optionalEvidence?: OptionalEvidence;
}

export interface EvaluatedFixture {
  fixtureDir: string;
  metadata: QegMetadata;
  graph: QualityEvidenceGraph;
  policy: GatePolicy;
  waivers: Waiver[];
  evidencePackage: EvidencePackage | undefined;
  placementPlan: TestPlacementPlan | undefined;
  optionalEvidence: OptionalEvidence | undefined;
  gateResult: GateResult;
}

export interface FixtureIoOptions {
  readonly quiet?: boolean;
}

async function readJsonFile<T>(path: string): Promise<T> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as T;
}

function withParserFailures(input: FixtureInput, parserFailures: readonly ParserFailure[]): FixtureInput {
  if (parserFailures.length === 0) return input;

  return {
    ...input,
    graph: {
      ...input.graph,
      completeness: {
        ...input.graph.completeness,
        parserFailures: [...input.graph.completeness.parserFailures, ...parserFailures],
      },
    },
  };
}

function emitDeprecationWarnings(warnings: readonly string[]): void {
  if (warnings.length === 0) return;

  const preview = warnings.slice(0, 5);
  for (const warning of preview) {
    console.warn(`Warning: ${warning}`);
  }
  if (warnings.length > preview.length) {
    console.warn(`Warning: ${warnings.length - preview.length} additional prefixless IDs accepted during deprecation period`);
  }
}

export async function readExpectedVerdict(fixtureDir: string): Promise<ExpectedGateVerdict> {
  const expectedPath = join(fixtureDir, "expected-gate-verdict.json");
  try {
    return await readJsonFile<ExpectedGateVerdict>(expectedPath);
  } catch (error) {
    throw new CliError(`Error reading expected verdict: ${error}`, error instanceof Error ? error : undefined);
  }
}

export async function readFixtureInput(fixtureDir: string, options: FixtureIoOptions = {}): Promise<FixtureInput> {
  const inputPath = join(fixtureDir, "gate-input.json");
  try {
    const rawInput = await readJsonFile<FixtureInput>(inputPath);
    const ingestValidation = validateIngestContract(rawInput);
    if (!options.quiet) {
      emitDeprecationWarnings(ingestValidation.warnings);
    }
    return withParserFailures(rawInput, ingestValidation.parserFailures);
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(
      `gate-input.json not found or invalid - IPO controlled requires real input artifacts\nInput file: ${inputPath}\nError: ${error}`,
      error instanceof Error ? error : undefined
    );
  }
}

export async function evaluateFixture(
  rawFixtureDir: string,
  options: FixtureIoOptions = {}
): Promise<EvaluatedFixture> {
  const fixtureDir = resolve(rawFixtureDir);
  const input = await readFixtureInput(fixtureDir, options);
  const waivers = [...(input.waivers ?? [])];

  if (!options.quiet) {
    console.log("Using gate-input.json (real input artifacts)");
  }

  return {
    fixtureDir,
    metadata: input.metadata,
    graph: input.graph,
    policy: input.policy,
    waivers,
    evidencePackage: input.evidencePackage,
    placementPlan: input.placementPlan,
    optionalEvidence: input.optionalEvidence,
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
