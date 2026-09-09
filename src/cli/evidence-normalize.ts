import { realpath } from "fs/promises";
import { basename, relative, resolve } from "path";
import { exit } from "process";
import type { ResilienceEvidenceStatus, ResilienceExecutionEvidenceNode } from "../types.js";
import { CliError } from "./errors.js";
import { adapterFields } from "./evidence-normalize/adapters.js";
import { assertOutputParentContained, assertRealContained, containedPath, readBytes, sameFilesystemPath, sha256 } from "./evidence-normalize/files.js";
import { type NormalizeAdapter, type NormalizeContext, type NormalizeOptions, SUPPORTED_ADAPTERS } from "./evidence-normalize/model.js";
import { parseArgs } from "./evidence-normalize/options.js";
import { publishNormalizedEvidence } from "./evidence-normalize/publish.js";
import { validateContext, validateEvidence } from "./evidence-normalize/validation.js";
import { choose, isObject, normalizeStatus, parseJson, rawValue } from "./evidence-normalize/values.js";


export async function normalizeResilienceEvidence(options: NormalizeOptions): Promise<ResilienceExecutionEvidenceNode> {
  if (!SUPPORTED_ADAPTERS.has(options.adapter as NormalizeAdapter)) {
    throw new CliError(`Adapter ${options.adapter} is unsupported for MVP normalization; provide canonical resilience evidence directly`);
  }
  const inputPath = containedPath(options.baseDir, options.input, "--input");
  const contextPath = containedPath(options.baseDir, options.context, "--context");
  const outPath = containedPath(options.baseDir, options.out, "--out");
  let realBaseDir: string;
  try {
    realBaseDir = await realpath(options.baseDir);
  } catch (error) {
    throw new CliError(`Cannot resolve --base-dir: ${error instanceof Error ? error.message : String(error)}`);
  }
  const [realInputPath, realContextPath, realOutputParent] = await Promise.all([
    assertRealContained(realBaseDir, inputPath, "--input"),
    assertRealContained(realBaseDir, contextPath, "--context"),
    assertOutputParentContained(realBaseDir, outPath),
  ]);
  const realOutputPath = resolve(realOutputParent, basename(outPath));
  if (sameFilesystemPath(realOutputPath, realInputPath) || sameFilesystemPath(realOutputPath, realContextPath)) {
    throw new CliError("--out must not overwrite --input or --context");
  }
  const [rawBytes, contextBytes] = await Promise.all([
    readBytes(inputPath, "raw input"),
    readBytes(contextPath, "context"),
  ]);
  const raw = parseJson(rawBytes, "raw input");
  const context = await validateContext(parseJson(contextBytes, "context"));
  const fields = adapterFields(options.adapter as NormalizeAdapter, raw);
  const lifecycle = context.lifecycle ?? {};
  const rawStartedAt = choose("raw startedAt", fields.startedAt, fields.lifecycle?.startedAt as string | undefined, false);
  const rawEndedAt = choose("raw endedAt", fields.endedAt, fields.lifecycle?.endedAt as string | undefined, false);
  const rawStatus = choose("raw status", fields.status, normalizeStatus(fields.lifecycle?.status), false);
  const startedAt = choose("startedAt", rawStartedAt, lifecycle.startedAt) as string;
  const endedAt = choose("endedAt", rawEndedAt, lifecycle.endedAt) as string;
  const status = choose("status", rawStatus, lifecycle.status as ResilienceEvidenceStatus | undefined) as ResilienceEvidenceStatus;
  const targetRevision = choose("targetRevision", fields.targetRevision, context.targetRevision) as string;
  const experimentId = choose("experimentId", fields.experimentId, context.experimentId) as string;
  const attempt = choose("attempt", fields.attempt, context.attempt) as number;
  const adapterVersion = choose("adapterVersion", fields.adapterVersion, context.adapterVersion) as string;
  const observed = choose("observed", fields.observed as ResilienceExecutionEvidenceNode["observed"], context.observed) as ResilienceExecutionEvidenceNode["observed"];
  const rawFault = choose("raw fault", fields.fault as ResilienceExecutionEvidenceNode["fault"], fields.lifecycle?.fault as ResilienceExecutionEvidenceNode["fault"], false);
  const fault = choose("fault", rawFault, lifecycle.fault as ResilienceExecutionEvidenceNode["fault"], false);
  const steadyStateConfirmed = choose("steadyStateConfirmed", fields.lifecycle?.steadyStateConfirmed as boolean | undefined, lifecycle.steadyStateConfirmed, false);
  const recovered = choose("recovered", fields.lifecycle?.recovered as boolean | undefined, lifecycle.recovered, false);
  const recoveryConfirmedAt = choose("recoveryConfirmedAt", fields.lifecycle?.recoveryConfirmedAt as string | undefined, lifecycle.recoveryConfirmedAt, false);
  const recoveryDurationMs = choose("recoveryDurationMs", fields.lifecycle?.recoveryDurationMs as number | undefined, lifecycle.recoveryDurationMs, false);
  const abortRecord = choose("abortRecord", fields.lifecycle?.abortRecord as ResilienceExecutionEvidenceNode["abortRecord"], lifecycle.abortRecord as ResilienceExecutionEvidenceNode["abortRecord"], false);
  const node = choose("node", isObject(raw.node) ? raw.node as unknown as NormalizeContext["node"] : undefined, context.node) as NormalizeContext["node"];
  const testId = choose("testId", rawValue(raw, "testId") as string | undefined, context.testId) as string;
  const environment = choose("environment", rawValue(raw, "environment") as ResilienceExecutionEvidenceNode["environment"] | undefined, context.environment) as ResilienceExecutionEvidenceNode["environment"];
  const environmentId = choose("environmentId", rawValue(raw, "environmentId") as string | undefined, context.environmentId) as string;
  const evidenceRefs = choose("evidenceRefs", Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs as ResilienceExecutionEvidenceNode["evidenceRefs"] : undefined, context.evidenceRefs) as ResilienceExecutionEvidenceNode["evidenceRefs"];
  const signalManifest = choose("signalManifest", isObject(raw.signalManifest) ? raw.signalManifest as unknown as ResilienceExecutionEvidenceNode["signalManifest"] : undefined, context.signalManifest) as NonNullable<ResilienceExecutionEvidenceNode["signalManifest"]>;
  const evidence: ResilienceExecutionEvidenceNode = {
    id: node.id,
    kind: "execution_evidence",
    title: node.title,
    traceability: node.traceability,
    sourceArtifactIds: node.sourceArtifactIds,
    evidenceRefs,
    evidenceType: "resilience",
    testId,
    adapter: options.adapter,
    adapterVersion,
    normalizationVersion: "qeg-resilience-evidence-v1",
    experimentId,
    attempt,
    rawArtifactRef: {
      id: `${node.id}:raw`,
      path: relative(options.baseDir, inputPath).replaceAll("\\", "/"),
      contentHash: sha256(rawBytes),
      revision: targetRevision,
    },
    targetRevision,
    environment,
    environmentId,
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
    signalManifest,
  };
  await validateEvidence(evidence);
  await publishNormalizedEvidence(outPath, `${JSON.stringify(evidence, null, 2)}\n`, options.force);
  return evidence;
}


export async function runEvidenceNormalizeCommand(args: readonly string[]): Promise<void> {
  const evidence = await normalizeResilienceEvidence(parseArgs(args));
  console.log(JSON.stringify(evidence, null, 2));
  exit(0);
}
