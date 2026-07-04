import { readFile, stat } from "fs/promises";
import { join, relative, resolve } from "path";
import { exit } from "process";
import type { DisqualificationCode, StableId } from "../types.js";
import { CliError } from "./errors.js";
import { collectReportTargets, createCiReport } from "./report.js";

type AuditSeverity = "pass" | "warn" | "fail";

interface BaselineEntry {
  readonly target?: string;
  readonly code: DisqualificationCode;
  readonly message?: string;
  readonly nodeIds?: readonly StableId[];
  readonly owner?: string;
  readonly expiresAt?: string;
}

interface BaselineFile {
  readonly entries: readonly BaselineEntry[];
}

interface BaselineAuditItem {
  readonly severity: AuditSeverity;
  readonly entry: BaselineEntry;
  readonly message: string;
}

interface BaselineAuditReport {
  readonly reportVersion: "qeg-baseline-audit-v1";
  readonly generatedAt: string;
  readonly status: AuditSeverity;
  readonly baselinePath: string;
  readonly items: readonly BaselineAuditItem[];
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory() || (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

function portable(path: string): string {
  return path.replace(/\\/g, "/");
}

function entryLabel(entry: BaselineEntry): string {
  return `${entry.target ?? "*"} ${entry.code}${entry.message ? ` ${entry.message}` : ""}`;
}

function targetMatches(entry: BaselineEntry, target: string): boolean {
  if (!entry.target) return true;
  const rel = portable(relative(process.cwd(), target));
  const entryTarget = portable(entry.target);
  return rel === entryTarget || rel.endsWith(entryTarget);
}

function sameNodeIds(left: readonly StableId[] | undefined, right: readonly StableId[]): boolean {
  if (!left) return true;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index]);
}

async function baselineEntryStillApplies(entry: BaselineEntry, targets: readonly string[]): Promise<boolean> {
  for (const target of targets) {
    if (!targetMatches(entry, target)) continue;
    const report = await createCiReport([target]);
    if (report.targets.some((result) =>
      result.disqualifications.some((dq) =>
        dq.code === entry.code &&
        (!entry.message || dq.message === entry.message) &&
        sameNodeIds(entry.nodeIds, dq.nodeIds)
      )
    )) {
      return true;
    }
  }
  return false;
}

function worst(items: readonly BaselineAuditItem[]): AuditSeverity {
  if (items.some((item) => item.severity === "fail")) return "fail";
  if (items.some((item) => item.severity === "warn")) return "warn";
  return "pass";
}

export async function createBaselineAuditReport(
  baselinePath: string,
  rawTargets: readonly string[]
): Promise<BaselineAuditReport> {
  const baseline = await readJson<BaselineFile>(baselinePath);
  const targets = rawTargets.length > 0 ? await collectReportTargets(rawTargets) : [];
  const items: BaselineAuditItem[] = [];
  const now = Date.now();

  for (const entry of baseline.entries) {
    if (!entry.owner) {
      items.push({ severity: "fail", entry, message: "baseline entry has no owner" });
    }
    if (!entry.expiresAt) {
      items.push({ severity: "warn", entry, message: "baseline entry has no expiresAt" });
    } else if (Number.isNaN(Date.parse(entry.expiresAt))) {
      items.push({ severity: "fail", entry, message: "baseline entry expiresAt is not a valid date" });
    } else if (Date.parse(entry.expiresAt) < now) {
      items.push({ severity: "fail", entry, message: "baseline entry is expired" });
    }
    if (entry.target && !(await exists(resolve(entry.target)))) {
      items.push({ severity: "fail", entry, message: "baseline target does not exist" });
    }
    if (targets.length > 0 && !(await baselineEntryStillApplies(entry, targets))) {
      items.push({ severity: "warn", entry, message: "baseline entry no longer matches a current DQ" });
    }
  }

  return {
    reportVersion: "qeg-baseline-audit-v1",
    generatedAt: new Date().toISOString(),
    status: worst(items),
    baselinePath,
    items,
  };
}

function formatBaselineAuditText(report: BaselineAuditReport): string {
  const lines = [
    "QEG Baseline Audit",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    `Baseline: ${report.baselinePath}`,
    "",
  ];
  if (report.items.length === 0) {
    lines.push("No baseline audit findings.");
    return `${lines.join("\n")}\n`;
  }
  for (const item of report.items) {
    lines.push(`- ${item.severity.toUpperCase()} ${entryLabel(item.entry)}: ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function runBaselineCommand(args: readonly string[]): Promise<void> {
  const [subcommand, baselinePath, ...rest] = args;
  const json = rest.includes("--json");
  const targets = rest.filter((arg) => arg !== "--json");
  if (subcommand !== "audit" || !baselinePath) {
    throw new CliError("Usage: qeg baseline audit <baseline.json> [--json] [fixture-dir-or-parent ...]");
  }
  const report = await createBaselineAuditReport(baselinePath, targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatBaselineAuditText(report).trimEnd());
  exit(report.status === "fail" ? 1 : 0);
}
