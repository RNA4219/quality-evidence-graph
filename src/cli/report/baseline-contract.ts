import { readFile } from "fs/promises";
import { resolve } from "path";
import type { Disqualification, DisqualificationCode, StableId } from "../../types.js";
import { loadSchemaRegistry } from "../../validation/schema.js";
import { CliError } from "../errors.js";
import { optionalStat } from "../file-errors.js";
import { pathKey } from "../path-key.js";

export interface BaselineEntry {
  readonly target?: string;
  readonly code: DisqualificationCode;
  readonly message?: string;
  readonly nodeIds?: readonly StableId[];
  readonly owner?: string;
  readonly expiresAt?: string;
}
export interface BaselineFile { readonly entries: readonly BaselineEntry[]; }
export interface BaselineIssue { readonly severity: "warn" | "fail"; readonly message: string; }

export async function readBaselineFile(path: string): Promise<BaselineFile> {
  const raw = JSON.parse(await readFile(path, "utf8"));
  const validate = (await loadSchemaRegistry()).validators.get("report-baseline.schema.json");
  if (!validate || !validate(raw)) throw new CliError(`Invalid baseline structure: ${path}; ${JSON.stringify(validate?.errors ?? [])}`);
  return raw as BaselineFile;
}

export function baselineTargetMatches(entry: BaselineEntry, target: string): boolean {
  return entry.target === undefined || pathKey(entry.target) === pathKey(target);
}

export function baselineDqMatches(entry: BaselineEntry, dq: Disqualification): boolean {
  const expected = entry.nodeIds ? [...entry.nodeIds].sort() : undefined;
  const actual = [...dq.nodeIds].sort();
  return entry.code === dq.code && (entry.message === undefined || entry.message === dq.message) &&
    (!expected || (expected.length === actual.length && expected.every((id, index) => id === actual[index])));
}

/** Eligibility is shared by audit and report; warnings alone do not invalidate an entry. */
export async function baselineEntryIssues(entry: BaselineEntry, now: number): Promise<BaselineIssue[]> {
  const issues: BaselineIssue[] = [];
  if (!entry.owner?.trim()) issues.push({ severity: "fail", message: "baseline entry has no owner" });
  if (entry.expiresAt === undefined) issues.push({ severity: "warn", message: "baseline entry has no expiresAt" });
  else if (!Number.isFinite(Date.parse(entry.expiresAt))) issues.push({ severity: "fail", message: "baseline entry expiresAt is not a valid date" });
  else if (Date.parse(entry.expiresAt) <= now) issues.push({ severity: "fail", message: "baseline entry is expired" });
  if (entry.target !== undefined && !(await optionalStat(resolve(entry.target)))?.isDirectory()) issues.push({ severity: "fail", message: "baseline target does not exist or is not a directory" });
  return issues;
}
