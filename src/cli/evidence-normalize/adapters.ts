import type { ResilienceEvidenceStatus } from "../../types.js";
import { CliError } from "../errors.js";
import { type JsonObject, type NormalizeAdapter } from "./model.js";
import { isObject, normalizeStatus, rawValue } from "./values.js";


export function adapterFields(adapter: NormalizeAdapter, raw: JsonObject): {
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
    const toxicObject = isObject(toxic) ? toxic : undefined;
    const toxicType = toxicObject?.type;
    const mappedFaultType = rawValue(raw, "faultModel") ?? (
      toxicType === "timeout" ? "dependency_timeout" :
      toxicType === "latency" ? "network_latency" :
      toxicType === undefined ? undefined : "custom"
    );
    const faultStartedAt = rawValue(raw, "faultStartedAt");
    const faultEndedAt = rawValue(raw, "faultEndedAt");
    const proxyName = rawValue(raw, "proxyName", "proxy");
    const actualTargetIds = rawValue(raw, "targetIds") ?? (typeof proxyName === "string" ? [proxyName] : undefined);
    const explicitDuration = rawValue(raw, "appliedDurationMs", "durationMs");
    const measuredDuration = typeof faultStartedAt === "string" && typeof faultEndedAt === "string"
      ? Date.parse(faultEndedAt) - Date.parse(faultStartedAt)
      : undefined;
    const appliedDurationMs = explicitDuration ?? (Number.isFinite(measuredDuration) ? measuredDuration : undefined);
    const fault = toxicObject !== undefined && mappedFaultType !== undefined && faultStartedAt !== undefined && faultEndedAt !== undefined && actualTargetIds !== undefined && appliedDurationMs !== undefined
      ? { type: mappedFaultType, parameters: toxicObject, faultStartedAt, faultEndedAt, actualTargetIds, appliedDurationMs }
      : undefined;
    if (toxicObject !== undefined && fault === undefined) {
      throw new CliError(
        "Toxiproxy input requires measured fault timestamps, targets, and duration",
      );
    }
    return {
      experimentId: rawValue(raw, "runId", "experimentId", "name") as string | undefined,
      attempt: rawValue(raw, "attempt") as number | undefined,
      targetRevision: rawValue(raw, "commit", "headSha", "revision") as string | undefined,
      startedAt: rawValue(raw, "startedAt") as string | undefined,
      endedAt: rawValue(raw, "endedAt") as string | undefined,
      status: normalizeStatus(rawValue(raw, "status", "passed")),
      adapterVersion: rawValue(raw, "adapterVersion") as string | undefined,
      fault,
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
