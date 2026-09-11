import { exit } from "process";
import { CliError } from "./errors.js";
import { collectReportTargets, createCiReport } from "./report.js";
import { baselineDqMatches, baselineEntryIssues, baselineTargetMatches, readBaselineFile, type BaselineEntry } from "./report/baseline-contract.js";

type AuditSeverity = "pass" | "warn" | "fail";

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

function entryLabel(entry: BaselineEntry): string {
  return `${entry.target ?? "*"} ${entry.code}${entry.message ? ` ${entry.message}` : ""}`;
}

async function baselineEntryStillApplies(entry: BaselineEntry, targets: readonly string[]): Promise<boolean> {
  for (const target of targets) {
    if (!baselineTargetMatches(entry, target)) continue;
    const report = await createCiReport([target]);
    if (report.targets.some((result) =>
      result.disqualifications.some(dq => baselineDqMatches(entry, dq))
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
  const baseline = await readBaselineFile(baselinePath);
  const targets = rawTargets.length > 0 ? await collectReportTargets(rawTargets) : [];
  const items: BaselineAuditItem[] = [];
  const now = Date.now();

  for (const entry of baseline.entries) {
    for (const issue of await baselineEntryIssues(entry, now)) items.push({ ...issue, entry });
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
