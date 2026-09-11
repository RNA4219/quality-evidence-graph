import { readFile } from "fs/promises";
import { isAbsolute, relative } from "path";
import type { Disqualification } from "../../types.js";
import type {
  CiReport,
  ReportDiff,
  ReportDiffItem,
  ReportTargetResult,
} from "./model.js";
import { portable } from "./targets.js";
import { CliError } from "../errors.js";
import { pathKey } from "../path-key.js";
import { baselineDqMatches, baselineEntryIssues, baselineTargetMatches, readBaselineFile, type BaselineFile } from "./baseline-contract.js";
export type ReportBaseline = BaselineFile;

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}
export async function readBaseline(path: string | undefined): Promise<ReportBaseline | undefined> {
  if (!path) return undefined;
  const baseline = await readBaselineFile(path);
  const now = Date.now();
  const errors: string[] = [];
  for (const [index, entry] of baseline.entries.entries()) {
    for (const issue of await baselineEntryIssues(entry, now)) if (issue.severity === "fail") errors.push(`entry ${index}: ${issue.message}`);
  }
  if (errors.length) throw new CliError(`Baseline is not eligible: ${errors.join("; ")}`);
  return baseline;
}

function normalizeTargetForDiff(target: string): string {
  if (target === "<repo>" || target.startsWith("<repo>/")) return target;
  const key = pathKey(target);
  const rel = portable(relative(pathKey(process.cwd()), key));
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith("../") ? `<repo>${rel ? "/" + rel : ""}` : key;
}

function diffItemKey(item: ReportDiffItem): string {
  return JSON.stringify({
    target: normalizeTargetForDiff(item.target),
    code: item.code,
    message: item.message,
    nodeIds: [...item.nodeIds].sort(),
  });
}

function reportDiffItems(report: CiReport): ReportDiffItem[] {
  const items: ReportDiffItem[] = [];
  for (const target of report.targets) {
    for (const disqualification of target.disqualifications) {
      items.push({
        target: normalizeTargetForDiff(target.target),
        code: disqualification.code,
        message: disqualification.message,
        nodeIds: disqualification.nodeIds,
      });
    }
  }
  return items.sort((left, right) => diffItemKey(left).localeCompare(diffItemKey(right)));
}

export async function createReportDiff(current: CiReport, previousPath: string | undefined): Promise<ReportDiff | undefined> {
  if (!previousPath) return undefined;
  const previous = await readJsonFile<CiReport>(previousPath);
  const currentItems = reportDiffItems(current);
  const previousItems = reportDiffItems(previous);
  const currentKeys = new Set(currentItems.map(diffItemKey));
  const previousKeys = new Set(previousItems.map(diffItemKey));
  const currentTargets = new Map(current.targets.map(target => [normalizeTargetForDiff(target.target), target]));
  const missing = previousItems.filter(item => !currentKeys.has(diffItemKey(item)));
  const unverified: NonNullable<ReportDiff["unverified"]>[number][] = [];
  const resolved: ReportDiffItem[] = [];
  for (const item of missing) {
    const target = currentTargets.get(item.target);
    if (!target) unverified.push({ ...item, reason: "not_evaluated" });
    else if (target.status === "cli_error" || !target.verdict || target.disqualifications.some(dq => dq.code === "DQ-01")) unverified.push({ ...item, reason: "evaluation_failed" });
    else resolved.push(item);
  }

  return {
    previousReport: previousPath,
    new: currentItems.filter((item) => !previousKeys.has(diffItemKey(item))),
    resolved,
    unchanged: currentItems.filter((item) => previousKeys.has(diffItemKey(item))),
    unverified,
  };
}

function baselineCovers(
  baseline: ReportBaseline | undefined,
  target: string,
  disqualification: Disqualification
): boolean {
  if (!baseline) return false;
  return baseline.entries.some(entry => baselineTargetMatches(entry, target) && baselineDqMatches(entry, disqualification));
}

export function applyBaseline(target: ReportTargetResult, baseline: ReportBaseline | undefined): ReportTargetResult {
  if (!baseline || target.status !== "gate_failed" || target.disqualifications.length === 0) {
    return target;
  }
  const allDisqualificationsCovered = target.disqualifications.every((disqualification) =>
    baselineCovers(baseline, target.target, disqualification)
  );
  const hasOtherFailures = target.blockers.length > 0 ||
    target.residualRisks.length > 0 ||
    target.requiredHumanReview.length > 0 ||
    target.expected?.validationPassed === false;

  if (!allDisqualificationsCovered || hasOtherFailures) {
    return target;
  }

  return {
    ...target,
    status: "baseline_accepted",
    exitCode: 0,
    reasons: [
      ...target.reasons,
      "All current DQs are accepted by baseline; report fails only on new DQs.",
    ],
  };
}

