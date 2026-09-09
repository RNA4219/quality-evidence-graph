import type { ResilienceEvidenceStatus } from "../../types.js";
import { CliError } from "../errors.js";
import { type JsonObject } from "./model.js";


export function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}


export function jsonEqual(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}


export function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}


export function canonicalJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonObject)
      .sort(([left], [right]) => lexicalCompare(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}


export function conflict(label: string, raw: unknown, context: unknown): never {
  void raw;
  void context;
  throw new CliError(`Raw input conflicts with context for ${label}`);
}


export function choose<T>(label: string, raw: T | undefined, context: T | undefined, required = true): T | undefined {
  if (raw !== undefined && context !== undefined && !jsonEqual(raw, context)) conflict(label, raw, context);
  const value = raw ?? context;
  if (required && value === undefined) throw new CliError(`Normalization requires ${label} in raw input or context`);
  return value;
}


export function rawValue(raw: JsonObject, ...keys: readonly string[]): unknown {
  for (const key of keys) if (raw[key] !== undefined) return raw[key];
  return undefined;
}


export function normalizeStatus(value: unknown): ResilienceEvidenceStatus | undefined {
  if (typeof value === "boolean") return value ? "pass" : "fail";
  if (typeof value !== "string") return undefined;
  const map: Readonly<Record<string, ResilienceEvidenceStatus>> = {
    pass: "pass", success: "pass", passed: "pass", failure: "fail", failed: "fail", fail: "fail",
    cancelled: "aborted", canceled: "aborted", aborted: "aborted", error: "error", timeout: "timeout", skipped: "skipped",
  };
  return map[value.toLowerCase()];
}


export function asObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) throw new CliError(`${label} must be a JSON object`);
  return value;
}


export function parseJson(bytes: Buffer | string, label: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString());
  } catch {
    throw new CliError(`Cannot read ${label}: invalid JSON`);
  }
  return asObject(parsed, label);
}
