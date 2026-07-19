import { createHash } from "crypto";
import { readFile, rename, stat, unlink, writeFile } from "fs/promises";
import { dirname, isAbsolute, relative, resolve } from "path";
import { exit } from "process";
import type { ResilienceAdapter, ResilienceEvidenceStatus, ResilienceExecutionEvidenceNode } from "../types.js";
import { loadSchemaRegistry } from "../validation/schema.js";
import { CliError } from "./errors.js";

type JsonObject = Record<string, unknown>;
type NormalizeAdapter = Extract<ResilienceAdapter, "lakda" | "toxiproxy" | "shell" | "ci">;

interface NormalizeOptions {
  readonly adapter: ResilienceAdapter;
  readonly input: string;
  readonly context: string;
  readonly out: string;
  readonly baseDir: string;
  readonly force: boolean;
}

interface NormalizeContext extends JsonObject {
  readonly node: {
    readonly id: string;
    readonly title: string;
    readonly traceability: ResilienceExecutionEvidenceNode["traceability"];
    readonly sourceArtifactIds: readonly string[];
  };
  readonly testId: string;
  readonly environment: ResilienceExecutionEvidenceNode["environment"];
  readonly environmentId: string;
  readonly adapterVersion: string;
  readonly targetRevision: string;
  readonly experimentId?: string;
  readonly attempt?: number;
  readonly lifecycle?: Partial<Pick<ResilienceExecutionEvidenceNode, "startedAt" | "endedAt" | "status" | "steadyStateConfirmed" | "fault" | "abortRecord" | "recovered" | "recoveryConfirmedAt" | "recoveryDurationMs">>;
  readonly observed?: ResilienceExecutionEvidenceNode["observed"];
  readonly evidenceRefs: ResilienceExecutionEvidenceNode["evidenceRefs"];
  readonly signalManifest: ResilienceExecutionEvidenceNode["signalManifest"];
}

const SUPPORTED_ADAPTERS = new Set<NormalizeAdapter>(["lakda", "toxiproxy", "shell", "ci"]);

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function conflict(label: string, raw: unknown, context: unknown): never {
  throw new CliError(`Raw input conflicts with context for ${label}: ${JSON.stringify(raw)} != ${JSON.stringify(context)}`);
}

function choose<T>(label: string, raw: T | undefined, context: T | undefined, required = true): T | undefined {
  if (raw !== undefined && context !== undefined && !jsonEqual(raw, context)) conflict(label, raw, context);
  const value = raw ?? context;
  if (required && value === undefined) throw new CliError(`Normalization requires ${label} in raw input or context`);
  return value;
}

function rawValue(raw: JsonObject, ...keys: readonly string[]): unknown {
  for (const key of keys) if (raw[key] !== undefined) return raw[key];
  return undefined;
}

function normalizeStatus(value: unknown): ResilienceEvidenceStatus | undefined {
  if (typeof value === "boolean") return value ? "pass" : "fail";
  if (typeof value !== "string") return undefined;
  const map: Readonly<Record<string, ResilienceEvidenceStatus>> = {
    pass: "pass", success: "pass", passed: "pass", failure: "fail", failed: "fail", fail: "fail",
    cancelled: "aborted", canceled: "aborted", aborted: "aborted", error: "error", timeout: "timeout", skipped: "skipped",
  };
  return map[value.toLowerCase()];
}

function asObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) throw new CliError(`${label} must be a JSON object`);
  return value;
}

function containedPath(baseDir: string, rawPath: string, label: string): string {
  const resolved = resolve(baseDir, rawPath);
  const offset = relative(baseDir, resolved);
  if (isAbsolute(rawPath) || isOutsideBase(offset)) {
    throw new CliError(`${label} must be contained within --base-dir`);
  }
  return resolved;
}

/** `relative()` uses the current platform separator; accept both forms for portable input. */
function isOutsideBase(offset: string): boolean {
  return offset === "" || offset === ".." || offset.startsWith("../") || offset.startsWith("..\\") || isAbsolute(offset);
}

async function readJson(path: string, label: string): Promise<JsonObject> {
  try {
    return asObject(JSON.parse(await readFile(path, "utf-8")), label);
  } catch (error) {
    throw new CliError(`Cannot read ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function parseArgs(args: readonly string[]): NormalizeOptions {
  let adapter: ResilienceAdapter | undefined;
  let input: string | undefined;
  let context: string | undefined;
  let out: string | undefined;
  let baseDir = process.cwd();
  let force = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") { force = true; continue; }
    if (arg === "--adapter" || arg === "--input" || arg === "--context" || arg === "--out" || arg === "--base-dir") {
      const value = args[index + 1];
      if (!value) throw new CliError(`Expected value after ${arg}`);
      if (arg === "--adapter") adapter = value as ResilienceAdapter;
      if (arg === "--input") input = value;
      if (arg === "--context") context = value;
      if (arg === "--out") out = value;
      if (arg === "--base-dir") baseDir = value;
      index += 1;
      continue;
    }
    throw new CliError(`Unknown normalize argument: ${arg}`);
  }
  if (!adapter || !input || !context || !out) {
    throw new CliError("Usage: qeg evidence normalize --adapter <kind> --input <raw.json> --context <context.json> --out <evidence.json> [--base-dir <dir>] [--force]");
  }
  return { adapter, input, context, out, baseDir: resolve(baseDir), force };
}

function adapterFields(adapter: NormalizeAdapter, raw: JsonObject): {
  readonly experimentId?: string;
  readonly attempt?: number;
  readonly targetRevision?: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly status?: ResilienceEvidenceStatus;
  readonly adapterVersion?: string;
  readonly fault?: unknown;
  readonly observed?: unknown;
  readonly lifecycle?: JsonObject;
} {
  if (adapter === "lakda") {
    const contract = rawValue(raw, "contractVersion", "schema", "version");
    if (contract !== "HATE/v1") throw new CliError("Lakda normalize accepts only HATE/v1 artifacts");
    return {
      experimentId: rawValue(raw, "runId", "run_id") as string | undefined,
      attempt: rawValue(raw, "attempt") as number | undefined,
      targetRevision: rawValue(raw, "commit", "headSha", "head_sha") as string | undefined,
      startedAt: rawValue(raw, "startedAt", "started_at") as string | undefined,
      endedAt: rawValue(raw, "endedAt", "ended_at") as string | undefined,
      status: normalizeStatus(rawValue(raw, "status", "conclusion", "passed")),
      adapterVersion: rawValue(raw, "adapterVersion") as string | undefined,
      fault: raw.fault,
      observed: raw.observed,
      lifecycle: isObject(raw.lifecycle) ? raw.lifecycle : undefined,
    };
  }
  if (adapter === "toxiproxy") {
    const toxic = Array.isArray(raw.toxics) ? raw.toxics[0] : raw.toxic;
    return {
      experimentId: rawValue(raw, "runId", "experimentId", "name") as string | undefined,
      attempt: rawValue(raw, "attempt") as number | undefined,
      targetRevision: rawValue(raw, "commit", "headSha", "revision") as string | undefined,
      startedAt: rawValue(raw, "startedAt") as string | undefined,
      endedAt: rawValue(raw, "endedAt") as string | undefined,
      status: normalizeStatus(rawValue(raw, "status", "passed")),
      adapterVersion: rawValue(raw, "adapterVersion") as string | undefined,
      fault: toxic === undefined ? undefined : {
        type: rawValue(raw, "faultModel") ?? "custom",
        parameters: toxic,
        faultStartedAt: rawValue(raw, "faultStartedAt", "startedAt"),
        faultEndedAt: rawValue(raw, "faultEndedAt", "endedAt"),
        actualTargetIds: rawValue(raw, "targetIds") ?? [rawValue(raw, "proxyName", "proxy") ?? "toxiproxy"],
        appliedDurationMs: rawValue(raw, "appliedDurationMs", "durationMs") ?? 1,
      },
      observed: raw.observed,
      lifecycle: isObject(raw.lifecycle) ? raw.lifecycle : undefined,
    };
  }
  if (adapter === "shell") {
    if (rawValue(raw, "schema", "contractVersion") !== "qeg-resilience-shell-v1") throw new CliError("Shell normalize requires qeg-resilience-shell-v1 input");
    return {
      experimentId: rawValue(raw, "runId") as string | undefined,
      attempt: rawValue(raw, "attempt") as number | undefined,
      targetRevision: rawValue(raw, "commit", "headSha") as string | undefined,
      startedAt: rawValue(raw, "startedAt") as string | undefined,
      endedAt: rawValue(raw, "endedAt") as string | undefined,
      status: normalizeStatus(rawValue(raw, "status")) ?? (typeof raw.exitCode === "number" ? (raw.exitCode === 0 ? "pass" : "fail") : undefined),
      adapterVersion: rawValue(raw, "adapterVersion") as string | undefined,
      fault: raw.fault,
      observed: raw.observed,
      lifecycle: isObject(raw.lifecycle) ? raw.lifecycle : undefined,
    };
  }
  if (rawValue(raw, "schema", "contractVersion") !== "qeg-resilience-ci-v1") throw new CliError("CI normalize requires qeg-resilience-ci-v1 input");
  return {
    experimentId: rawValue(raw, "providerRunId", "runId") as string | undefined,
    attempt: rawValue(raw, "attempt", "runAttempt") as number | undefined,
    targetRevision: rawValue(raw, "headSha", "commit") as string | undefined,
    startedAt: rawValue(raw, "startedAt") as string | undefined,
    endedAt: rawValue(raw, "endedAt") as string | undefined,
    status: normalizeStatus(rawValue(raw, "conclusion", "status")),
    adapterVersion: rawValue(raw, "adapterVersion") as string | undefined,
    fault: raw.fault,
    observed: raw.observed,
    lifecycle: isObject(raw.lifecycle) ? raw.lifecycle : undefined,
  };
}

async function validateContext(raw: JsonObject): Promise<NormalizeContext> {
  const registry = await loadSchemaRegistry();
  const validator = registry.validators.get("resilience-normalize-context.schema.json");
  if (!validator) throw new CliError("resilience normalization context schema is unavailable");
  if (!validator(raw)) throw new CliError(`Normalization context schema invalid: ${(validator.errors ?? []).map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
  return raw as NormalizeContext;
}

async function validateEvidence(evidence: ResilienceExecutionEvidenceNode): Promise<void> {
  const registry = await loadSchemaRegistry();
  const validator = registry.ajv.getSchema("https://quality-harness.dev/schemas/qeg/reliability.schema.json#/$defs/resilienceExecutionEvidenceNode");
  if (!validator) throw new CliError("resilience evidence schema is unavailable");
  if (!validator(evidence)) throw new CliError(`Normalized evidence schema invalid: ${(validator.errors ?? []).map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
}

export async function normalizeResilienceEvidence(options: NormalizeOptions): Promise<ResilienceExecutionEvidenceNode> {
  if (!SUPPORTED_ADAPTERS.has(options.adapter as NormalizeAdapter)) {
    throw new CliError(`Adapter ${options.adapter} is unsupported for MVP normalization; provide canonical resilience evidence directly`);
  }
  const inputPath = containedPath(options.baseDir, options.input, "--input");
  const contextPath = containedPath(options.baseDir, options.context, "--context");
  const outPath = containedPath(options.baseDir, options.out, "--out");
  const [raw, contextRaw, rawBytes] = await Promise.all([readJson(inputPath, "raw input"), readJson(contextPath, "context"), readFile(inputPath)]);
  const context = await validateContext(contextRaw);
  const fields = adapterFields(options.adapter as NormalizeAdapter, raw);
  const lifecycle = context.lifecycle ?? {};
  const startedAt = choose("startedAt", fields.startedAt ?? fields.lifecycle?.startedAt as string | undefined, lifecycle.startedAt) as string;
  const endedAt = choose("endedAt", fields.endedAt ?? fields.lifecycle?.endedAt as string | undefined, lifecycle.endedAt) as string;
  const status = choose("status", fields.status ?? normalizeStatus(fields.lifecycle?.status), lifecycle.status as ResilienceEvidenceStatus | undefined) as ResilienceEvidenceStatus;
  const targetRevision = choose("targetRevision", fields.targetRevision, context.targetRevision) as string;
  const experimentId = choose("experimentId", fields.experimentId, context.experimentId) as string;
  const attempt = choose("attempt", fields.attempt, context.attempt) as number;
  const adapterVersion = choose("adapterVersion", fields.adapterVersion, context.adapterVersion) as string;
  const observed = choose("observed", fields.observed as ResilienceExecutionEvidenceNode["observed"], context.observed) as ResilienceExecutionEvidenceNode["observed"];
  const fault = choose("fault", fields.fault as ResilienceExecutionEvidenceNode["fault"], lifecycle.fault as ResilienceExecutionEvidenceNode["fault"], false);
  const steadyStateConfirmed = choose("steadyStateConfirmed", fields.lifecycle?.steadyStateConfirmed as boolean | undefined, lifecycle.steadyStateConfirmed, false);
  const recovered = choose("recovered", fields.lifecycle?.recovered as boolean | undefined, lifecycle.recovered, false);
  const recoveryConfirmedAt = choose("recoveryConfirmedAt", fields.lifecycle?.recoveryConfirmedAt as string | undefined, lifecycle.recoveryConfirmedAt, false);
  const recoveryDurationMs = choose("recoveryDurationMs", fields.lifecycle?.recoveryDurationMs as number | undefined, lifecycle.recoveryDurationMs, false);
  const abortRecord = choose("abortRecord", fields.lifecycle?.abortRecord as ResilienceExecutionEvidenceNode["abortRecord"], lifecycle.abortRecord as ResilienceExecutionEvidenceNode["abortRecord"], false);
  const evidence: ResilienceExecutionEvidenceNode = {
    id: context.node.id,
    kind: "execution_evidence",
    title: context.node.title,
    traceability: context.node.traceability,
    sourceArtifactIds: context.node.sourceArtifactIds,
    evidenceRefs: context.evidenceRefs,
    evidenceType: "resilience",
    testId: context.testId,
    adapter: options.adapter,
    adapterVersion,
    normalizationVersion: "qeg-resilience-evidence-v1",
    experimentId,
    attempt,
    rawArtifactRef: {
      id: `${context.node.id}:raw`,
      path: relative(options.baseDir, inputPath).replaceAll("\\", "/"),
      contentHash: sha256(rawBytes),
      revision: targetRevision,
    },
    targetRevision,
    environment: context.environment,
    environmentId: context.environmentId,
    startedAt,
    endedAt,
    status,
    passed: status === "pass",
    ...(steadyStateConfirmed === undefined ? {} : { steadyStateConfirmed }),
    ...(fault === undefined ? {} : { fault }),
    ...(abortRecord === undefined ? {} : { abortRecord }),
    ...(recovered === undefined ? {} : { recovered }),
    ...(recoveryConfirmedAt === undefined ? {} : { recoveryConfirmedAt }),
    ...(recoveryDurationMs === undefined ? {} : { recoveryDurationMs }),
    ...(observed === undefined ? {} : { observed }),
    signalManifest: context.signalManifest,
  };
  await validateEvidence(evidence);
  try { await stat(outPath); if (!options.force) throw new CliError(`Output already exists: ${options.out} (use --force to replace it)`); } catch (error) {
    if (error instanceof CliError) throw error;
  }
  const tempPath = resolve(dirname(outPath), `.${relative(dirname(outPath), outPath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(tempPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
    await rename(tempPath, outPath);
  } catch (error) {
    try { await unlink(tempPath); } catch { /* no incomplete output remains */ }
    throw error;
  }
  return evidence;
}

export async function runEvidenceNormalizeCommand(args: readonly string[]): Promise<void> {
  const evidence = await normalizeResilienceEvidence(parseArgs(args));
  console.log(JSON.stringify(evidence, null, 2));
  exit(0);
}
