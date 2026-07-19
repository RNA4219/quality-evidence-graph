import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { CliError } from "./errors.js";
import { evaluateGate } from "../gate.js";
import { validateIngestContract } from "./ingest-contract.js";
import { validateGateInput, type GateInputValidationReport } from "../validation/schema.js";
import { verifyEvidenceArtifacts, type EvidenceVerificationReport } from "../validation/evidence.js";
import type {
  Disqualification,
  EvidencePackage,
  GatePolicy,
  GateResult,
  OptionalEvidence,
  ParserFailure,
  QegGateInput,
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
  expectedBlockers?: { id: string; message: string }[];
  expectedBlockerMode?: "exact" | "includes";
  expectedResidualRisks: string[];
  expectedHumanReview: string[];
  expectedExitCode: number;
  contractRef: string;
  expectedDisqualificationMode?: "exact" | "includes";
}

export type FixtureInput = QegGateInput;
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
  schemaValidation: GateInputValidationReport;
  evidenceVerification?: EvidenceVerificationReport;
}
export interface FixtureIoOptions { readonly quiet?: boolean; }

class SchemaGateInputError extends Error {
  constructor(readonly raw: Record<string, unknown>, readonly report: GateInputValidationReport) {
    super("gate-input.json failed runtime schema validation");
  }
}

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf-8"));
}
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function withParserFailures(input: FixtureInput, parserFailures: readonly ParserFailure[]): FixtureInput {
  if (parserFailures.length === 0) return input;
  return { ...input, graph: { ...input.graph, completeness: { ...input.graph.completeness, parserFailures: [...input.graph.completeness.parserFailures, ...parserFailures] } } };
}
function emitDeprecationWarnings(warnings: readonly string[]): void {
  for (const warning of warnings.slice(0, 5)) console.warn(`Warning: ${warning}`);
  if (warnings.length > 5) console.warn(`Warning: ${warnings.length - 5} additional prefixless IDs accepted during deprecation period`);
}

export async function readExpectedVerdict(fixtureDir: string): Promise<ExpectedGateVerdict> {
  try {
    return await readJsonFile(join(fixtureDir, "expected-gate-verdict.json")) as ExpectedGateVerdict;
  } catch (error) {
    throw new CliError(`Error reading expected verdict: ${error}`, error instanceof Error ? error : undefined);
  }
}

async function loadFixtureInput(fixtureDir: string, options: FixtureIoOptions = {}):
Promise<{ input: FixtureInput; schema: GateInputValidationReport }> {
  const inputPath = join(fixtureDir, "gate-input.json");
  let raw: unknown;
  try {
    raw = await readJsonFile(inputPath);
  } catch (error) {
    throw new CliError(`gate-input.json not found or invalid\nInput file: ${inputPath}\nError: ${error}`, error instanceof Error ? error : undefined);
  }
  if (!isObject(raw) || !isObject(raw.metadata) || !isObject(raw.graph) || !isObject(raw.policy)) {
    throw new CliError(`gate-input.json envelope is invalid\nInput file: ${inputPath}`);
  }
  const schema = await validateGateInput(raw);
  if (!schema.valid || !schema.input) throw new SchemaGateInputError(raw, schema);
  if (!options.quiet) {
    for (const warning of schema.warnings) console.warn("Warning: optional artifact " + warning.path + " " + warning.message);
  }
  const ingest = validateIngestContract(raw);
  if (!options.quiet) emitDeprecationWarnings(ingest.warnings);
  return { input: withParserFailures(schema.input, ingest.parserFailures), schema };
}
export async function readFixtureInput(fixtureDir: string, options: FixtureIoOptions = {}): Promise<FixtureInput> {
  return (await loadFixtureInput(fixtureDir, options)).input;
}


function fallbackMetadata(raw: Record<string, unknown>): QegMetadata {
  const source = isObject(raw.metadata) ? raw.metadata : {};
  return {
    qegVersion: "0.2",
    runId: typeof source.runId === "string" ? source.runId : "qeg:invalid-input",
    createdAt: typeof source.createdAt === "string" ? source.createdAt : "1970-01-01T00:00:00.000Z",
    profile: source.profile === "lean" || source.profile === "standard" || source.profile === "strict" || source.profile === "ipo_controlled" ? source.profile : "strict",
    inputArtifacts: [],
  };
}
function fallbackPolicy(raw: Record<string, unknown>, metadata: QegMetadata): GatePolicy {
  const source = isObject(raw.policy) ? raw.policy : {};
  return {
    policyId: typeof source.policyId === "string" ? source.policyId : "qeg:invalid-policy",
    policyHash: typeof source.policyHash === "string" ? source.policyHash : "sha256:invalid",
    profile: metadata.profile,
    effectiveDate: typeof source.effectiveDate === "string" ? source.effectiveDate : "1970-01-01T00:00:00.000Z",
    approver: typeof source.approver === "string" ? source.approver : "qeg-runtime-validator",
    sourceRefs: [{ id: "qeg:schema-validation", path: "schemas/gate-input.schema.json" }],
    dqScope: ["DQ-01", "DQ-02", "DQ-03", "DQ-04", "DQ-05", "DQ-06", "DQ-07", "DQ-08", "DQ-09", "DQ-10", "DQ-11", "DQ-12", "DQ-13", "DQ-14", "DQ-15", "DQ-16", "DQ-17", "DQ-18", "DQ-19", "DQ-20", "DQ-21"],
    exitCodePolicy: { go: 0, conditional_go: 2, no_go: 2, disqualified: 2 },
  };
}
function schemaInvalidEvaluation(fixtureDir: string, error: SchemaGateInputError): EvaluatedFixture {
  const metadata = fallbackMetadata(error.raw);
  const policy = fallbackPolicy(error.raw, metadata);
  const graph: QualityEvidenceGraph = { metadata, nodes: [], edges: [], completeness: { score: 1, partial: false, parserFailures: [], unsupportedClaims: [] } };
  const preview = error.report.issues.slice(0, 5).map((issue) => `${issue.path} ${issue.message}`).join("; ");
  const dq: Disqualification = { code: "DQ-01", message: `Gate input schema invalid: ${preview}`, nodeIds: [], sourceRefs: [{ id: "qeg:schema-validation", path: "schemas/gate-input.schema.json" }] };
  return {
    fixtureDir, metadata, graph, policy, waivers: [], evidencePackage: undefined, placementPlan: undefined, optionalEvidence: undefined,
    gateResult: evaluateGate({ metadata, graph, policy, waivers: [], preflightDisqualifications: [dq] }),
    schemaValidation: error.report,
  };
}
function evidenceDq(report: EvidenceVerificationReport): Disqualification[] {
  const failures = report.items.filter((item) => item.severity === "fail" && item.code !== "REVISION_MISMATCH");
  if (failures.length === 0) return [];
  return [{
    code: "DQ-06",
    message: failures.map((item) => `${item.artifactId}: ${item.message}`).join("; "),
    nodeIds: [...new Set(failures.map((item) => item.artifactId))],
    sourceRefs: [{ id: "qeg:evidence-verification", path: "src/validation/evidence.ts" }],
  }];
}

export async function evaluateFixture(rawFixtureDir: string, options: FixtureIoOptions = {}): Promise<EvaluatedFixture> {
  const fixtureDir = resolve(rawFixtureDir);
  let input: FixtureInput;
  let schemaValidation: GateInputValidationReport;
  try {
    const loaded = await loadFixtureInput(fixtureDir, options);
    input = loaded.input;
    schemaValidation = loaded.schema;
  } catch (error) {
    if (error instanceof SchemaGateInputError) return schemaInvalidEvaluation(fixtureDir, error);
    throw error;
  }
  const waivers = [...(input.waivers ?? [])];
  const evidenceVerification = await verifyEvidenceArtifacts(input, { baseDir: fixtureDir });
  if (!options.quiet) console.error("Using gate-input.json (runtime schema and evidence preflight complete)");
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
      evidenceVerification,
      preflightDisqualifications: evidenceDq(evidenceVerification),
    }),
    schemaValidation,
    evidenceVerification,
  };
}
