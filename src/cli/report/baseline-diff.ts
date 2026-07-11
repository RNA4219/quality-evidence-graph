import { readFile } from "fs/promises";
import type { Disqualification, StableId } from "../../types.js";
import type {
  CiReport,
  ReportDiff,
  ReportDiffItem,
  ReportTargetResult,
} from "./model.js";
import { portable, relativeTarget } from "./targets.js";

interface BaselineEntry {
  readonly target?: string;
  readonly code: import("../../types.js").DisqualificationCode;
  readonly message?: string;
  readonly nodeIds?: readonly StableId[];
}

export interface ReportBaseline {
  readonly entries: readonly BaselineEntry[];
}

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}
export async function readBaseline(path: string | undefined): Promise<ReportBaseline | undefined> {
  if (!path) return undefined;
  return readJsonFile<ReportBaseline>(path);
}

function normalizeTargetForDiff(target: string): string {
  return portable(target).replace(portable(process.cwd()), "<repo>");
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

  return {
    previousReport: previousPath,
    new: currentItems.filter((item) => !previousKeys.has(diffItemKey(item))),
    resolved: previousItems.filter((item) => !currentKeys.has(diffItemKey(item))),
    unchanged: currentItems.filter((item) => previousKeys.has(diffItemKey(item))),
  };
}

function sameNodeIds(left: readonly StableId[] | undefined, right: readonly StableId[]): boolean {
  if (!left) return true;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index]);
}

function baselineCovers(
  baseline: ReportBaseline | undefined,
  target: string,
  disqualification: Disqualification
): boolean {
  if (!baseline) return false;
  const relTarget = relativeTarget(target);
  return baseline.entries.some((entry) => {
    const targetMatches = !entry.target || portable(entry.target) === relTarget || relTarget.endsWith(portable(entry.target));
    const messageMatches = !entry.message || entry.message === disqualification.message;
    return targetMatches &&
      entry.code === disqualification.code &&
      messageMatches &&
      sameNodeIds(entry.nodeIds, disqualification.nodeIds);
  });
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

