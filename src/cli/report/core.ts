import { join } from "path";
import { getExitCode } from "../../gate.js";
import type {
  DisqualificationCode,
  StableId,
} from "../../types.js";
import { getDqExplanation } from "../dq-explain.js";
import { CliError } from "../errors.js";
import {
  evaluateFixture,
  readExpectedVerdict,
  type EvaluatedFixture,
  type ExpectedGateVerdict,
} from "../fixture-io.js";
import {
  compareEvaluatedFixture,
  type FixtureValidationComparison,
} from "../validation.js";
import { selectChangedTargets } from "./change-selection.js";
import {
  applyBaseline,
  createReportDiff,
  readBaseline,
} from "./baseline-diff.js";
import type {
  CiReport,
  CreateCiReportOptions,
  ReportError,
  DqSummaryItem,
  ReportExpectedComparison,
  ReportTargetResult,
  ReportSummary,
} from "./model.js";
import { collectReportTargets, relativeTarget, safeStat } from "./targets.js";
async function readExpectedIfPresent(target: string): Promise<ExpectedGateVerdict | undefined> {
  const expectedPath = join(target, "expected-gate-verdict.json");
  if (!(await safeStat(expectedPath))?.isFile()) {
    return undefined;
  }

  return readExpectedVerdict(target);
}

function toReportExpectedComparison(
  expected: ExpectedGateVerdict,
  comparison: FixtureValidationComparison
): ReportExpectedComparison {
  return {
    fixture: expected.fixture,
    expectedVerdict: expected.expectedVerdict,
    expectedExitCode: expected.expectedExitCode,
    contractRef: expected.contractRef,
    validationPassed: comparison.passed,
    verdictMatch: comparison.verdictMatch,
    exitCodeMatch: comparison.exitCodeMatch,
    dqMatch: comparison.dqMatch,
    expectedDqCodes: comparison.expectedDqCodes,
    actualDqCodes: comparison.actualDqCodes,
    unexpectedDqCodes: comparison.unexpectedDqCodes,
    missingDqCodes: comparison.missingDqCodes,
  };
}

async function evaluateReportTarget(target: string): Promise<ReportTargetResult> {
  try {
    const evaluated = await evaluateFixture(target, { quiet: true });
    const expected = await readExpectedIfPresent(evaluated.fixtureDir);
    const expectedComparison = expected
      ? toReportExpectedComparison(expected, compareEvaluatedFixture(expected, evaluated))
      : undefined;
    const exitCode = getExitCode(evaluated.gateResult.verdict, evaluated.policy);
    const status = exitCode === 0 && (expectedComparison?.validationPassed ?? true)
      ? "passed"
      : "gate_failed";

    return gateTargetResult(evaluated, status, exitCode, expectedComparison);
  } catch (error) {
    return {
      target,
      status: "cli_error",
      exitCode: 1,
      reasons: [],
      disqualifications: [],
      blockers: [],
      residualRisks: [],
      requiredHumanReview: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function gateTargetResult(
  evaluated: EvaluatedFixture,
  status: "passed" | "gate_failed",
  exitCode: number,
  expected: ReportExpectedComparison | undefined
): ReportTargetResult {
  const { gateResult } = evaluated;
  return {
    target: evaluated.fixtureDir,
    status,
    exitCode,
    verdict: gateResult.verdict,
    reasons: gateResult.reasons,
    disqualifications: gateResult.disqualifications,
    blockers: gateResult.blockers,
    residualRisks: gateResult.residualRisks,
    requiredHumanReview: gateResult.requiredHumanReview,
    expected,
  };
}

function countByDq(targets: readonly ReportTargetResult[]): DqSummaryItem[] {
  const counts = new Map<DisqualificationCode, number>();
  for (const target of targets) {
    for (const disqualification of target.disqualifications) {
      counts.set(disqualification.code, (counts.get(disqualification.code) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => ({
      code,
      count,
      remediation: getDqExplanation(code).remediation,
    }));
}

function buildSummary(targets: readonly ReportTargetResult[], reportErrorCount = 0): ReportSummary {
  return {
    totalTargets: targets.length,
    passed: targets.filter((target) => target.status === "passed").length,
    baselineAccepted: targets.filter((target) => target.status === "baseline_accepted").length,
    gateFailed: targets.filter((target) => target.status === "gate_failed").length,
    cliErrors: targets.filter((target) => target.status === "cli_error").length + reportErrorCount,
    dqCounts: countByDq(targets),
    blockerCount: targets.reduce((count, target) => count + target.blockers.length, 0),
    residualRiskCount: targets.reduce((count, target) => count + target.residualRisks.length, 0),
    humanReviewCount: targets.reduce((count, target) => count + target.requiredHumanReview.length, 0),
  };
}

export async function createCiReport(
  rawTargets: readonly string[],
  options: CreateCiReportOptions = {}
): Promise<CiReport> {
  const collectedTargets = await collectReportTargets(rawTargets);
  const selected = await selectChangedTargets(collectedTargets, options.changedOnly);
  const errors: ReportError[] = selected.selection.status === "detection_failed"
    ? [{ code: "CHANGE_DETECTION_FAILED", message: selected.selection.error ?? "change detection failed" }]
    : [];
  const baseline = await readBaseline(options.baselinePath);
  const results: ReportTargetResult[] = [];
  for (const target of selected.targets) {
    results.push(applyBaseline(await evaluateReportTarget(target), baseline));
  }

  const report: CiReport = {
    reportVersion: "qeg-ci-report-v2",
    generatedAt: new Date().toISOString(),
    selection: selected.selection,
    errors,
    summary: buildSummary(results, errors.length),
    targets: results,
  };
  const diff = await createReportDiff(report, options.diffPath);
  return diff ? { ...report, diff } : report;
}

