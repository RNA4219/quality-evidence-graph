import { mkdir, readdir, stat, writeFile } from "fs/promises";
import type { Dirent } from "fs";
import { dirname, join, resolve } from "path";
import { exit } from "process";
import { getExitCode } from "../gate.js";
import type {
  Disqualification,
  DisqualificationCode,
  GateBlocker,
  GateVerdict,
  SourceRef,
  StableId,
} from "../types.js";
import { CliError } from "./errors.js";
import {
  evaluateFixture,
  readExpectedVerdict,
  type EvaluatedFixture,
  type ExpectedGateVerdict,
} from "./fixture-io.js";
import {
  compareEvaluatedFixture,
  type FixtureValidationComparison,
} from "./validation.js";

export type ReportTargetStatus = "passed" | "gate_failed" | "cli_error";
export type ReportFormat = "text" | "json";

export interface ReportOptions {
  readonly format: ReportFormat;
  readonly outPath?: string;
}

export interface ReportExpectedComparison {
  readonly fixture: string;
  readonly expectedVerdict: GateVerdict;
  readonly expectedExitCode: number;
  readonly contractRef: string;
  readonly validationPassed: boolean;
  readonly verdictMatch: boolean;
  readonly exitCodeMatch: boolean;
  readonly dqMatch: boolean;
  readonly expectedDqCodes: readonly DisqualificationCode[];
  readonly actualDqCodes: readonly DisqualificationCode[];
  readonly unexpectedDqCodes: readonly DisqualificationCode[];
  readonly missingDqCodes: readonly DisqualificationCode[];
}

export interface ReportTargetResult {
  readonly target: string;
  readonly status: ReportTargetStatus;
  readonly exitCode: number;
  readonly verdict?: GateVerdict;
  readonly reasons: readonly string[];
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
  readonly residualRisks: readonly StableId[];
  readonly requiredHumanReview: readonly StableId[];
  readonly expected?: ReportExpectedComparison;
  readonly error?: string;
}

export interface DqSummaryItem {
  readonly code: DisqualificationCode;
  readonly count: number;
  readonly remediation: string;
}

export interface ReportSummary {
  readonly totalTargets: number;
  readonly passed: number;
  readonly gateFailed: number;
  readonly cliErrors: number;
  readonly dqCounts: readonly DqSummaryItem[];
  readonly blockerCount: number;
  readonly residualRiskCount: number;
  readonly humanReviewCount: number;
}

export interface CiReport {
  readonly reportVersion: "qeg-ci-report-v1";
  readonly generatedAt: string;
  readonly summary: ReportSummary;
  readonly targets: readonly ReportTargetResult[];
}

const DQ_REMEDIATION: Record<DisqualificationCode, string> = {
  "DQ-01": "Fix parser/input failures and make required gate artifacts available before QEG runs.",
  "DQ-02": "Add sourceRefs to each gate-relevant blocker so the release decision is auditable.",
  "DQ-03": "Replace gate-relevant unsupported claims with source-backed evidence or mark them non-gate-relevant.",
  "DQ-04": "Add reviewer notes or accepted waivers for P0/P1 oracle gaps, or close the evidence gap.",
  "DQ-05": "Add test placement obligations for changed code, or provide an accepted waiver.",
  "DQ-06": "Regenerate or relink evidence artifacts so recorded content hashes match actual inputs.",
  "DQ-07": "Record an explicit completeness score when using a partial graph.",
  "DQ-08": "Complete manual evidence with expectedResult, oracleRefs, traceTo, and evidenceRefs.",
  "DQ-09": "Redact sensitive values from the evidence package and regenerate the record.",
  "DQ-10": "Remove hidden-oracle access from benchmark-mode runs and regenerate evidence.",
  "DQ-11": "Fix required connector contract violations before treating connector output as successful.",
  "DQ-12": "Regenerate artifacts from the same headRef/revision used by the QEG metadata.",
  "DQ-13": "Add sourceRefs to the evidence package.",
  "DQ-14": "Add source-backed manual oracle or placement-change retirement/revert evidence.",
  "DQ-15": "Provide source-backed waiver, policy hash, and approval evidence that match the evidence package.",
  "DQ-16": "Move release evidence to immutable, append-only, or versioned storage before using it for release judgment.",
  "DQ-17": "Record producer, reviewer, approver, waiverApprover, and releaseOwner control roles.",
};

async function safeStat(path: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function isFixtureLikeDirectory(path: string): Promise<boolean> {
  const input = await safeStat(join(path, "gate-input.json"));
  const expected = await safeStat(join(path, "expected-gate-verdict.json"));
  return Boolean(input?.isFile() || expected?.isFile());
}

async function collectChildFixtures(path: string, children: readonly Dirent[]): Promise<string[]> {
  const fixtures: string[] = [];
  for (const child of children) {
    if (!child.isDirectory()) continue;

    const childPath = join(path, child.name);
    if (await isFixtureLikeDirectory(childPath)) {
      fixtures.push(childPath);
    }
  }
  return fixtures.sort();
}

export async function collectReportTargets(rawTargets: readonly string[]): Promise<string[]> {
  const targets: string[] = [];

  for (const rawTarget of rawTargets) {
    const target = resolve(rawTarget);
    const targetStat = await safeStat(target);

    if (!targetStat?.isDirectory()) {
      targets.push(target);
      continue;
    }

    if (await isFixtureLikeDirectory(target)) {
      targets.push(target);
      continue;
    }

    const childFixtures = await collectChildFixtures(target, await readdir(target, { withFileTypes: true }));
    targets.push(...(childFixtures.length > 0 ? childFixtures : [target]));
  }

  return [...new Set(targets)];
}

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
      remediation: DQ_REMEDIATION[code],
    }));
}

function buildSummary(targets: readonly ReportTargetResult[]): ReportSummary {
  return {
    totalTargets: targets.length,
    passed: targets.filter((target) => target.status === "passed").length,
    gateFailed: targets.filter((target) => target.status === "gate_failed").length,
    cliErrors: targets.filter((target) => target.status === "cli_error").length,
    dqCounts: countByDq(targets),
    blockerCount: targets.reduce((count, target) => count + target.blockers.length, 0),
    residualRiskCount: targets.reduce((count, target) => count + target.residualRisks.length, 0),
    humanReviewCount: targets.reduce((count, target) => count + target.requiredHumanReview.length, 0),
  };
}

export async function createCiReport(rawTargets: readonly string[]): Promise<CiReport> {
  const targets = await collectReportTargets(rawTargets);
  const results: ReportTargetResult[] = [];
  for (const target of targets) {
    results.push(await evaluateReportTarget(target));
  }

  return {
    reportVersion: "qeg-ci-report-v1",
    generatedAt: new Date().toISOString(),
    summary: buildSummary(results),
    targets: results,
  };
}

function sourceRefLabel(sourceRef: SourceRef): string {
  const parts = [sourceRef.id, sourceRef.path];
  if (sourceRef.label) {
    parts.push(sourceRef.label);
  }
  return parts.filter(Boolean).join(" ");
}

function sourceRefsLabel(sourceRefs: readonly SourceRef[]): string {
  if (sourceRefs.length === 0) return "none";
  return sourceRefs.map(sourceRefLabel).join("; ");
}

function appendExpectedMismatch(lines: string[], expected: ReportExpectedComparison | undefined): void {
  if (!expected || expected.validationPassed) return;

  lines.push("  Expected comparison:");
  lines.push(`  - fixture: ${expected.fixture}`);
  lines.push(`  - verdict match: ${expected.verdictMatch ? "PASS" : "FAIL"}`);
  lines.push(`  - exit code match: ${expected.exitCodeMatch ? "PASS" : "FAIL"}`);
  lines.push(`  - DQ match: ${expected.dqMatch ? "PASS" : "FAIL"}`);
  if (expected.unexpectedDqCodes.length > 0) {
    lines.push(`  - unexpected DQ codes: ${expected.unexpectedDqCodes.join(", ")}`);
  }
  if (expected.missingDqCodes.length > 0) {
    lines.push(`  - missing expected DQ codes: ${expected.missingDqCodes.join(", ")}`);
  }
}

function appendGateFailure(lines: string[], target: ReportTargetResult): void {
  lines.push(`- ${target.target}`);
  lines.push(`  status: ${target.status}`);
  if (target.verdict) {
    lines.push(`  verdict: ${target.verdict} (exit ${target.exitCode})`);
  } else {
    lines.push(`  exit: ${target.exitCode}`);
  }
  if (target.error) {
    lines.push(`  error: ${target.error}`);
  }
  for (const reason of target.reasons) {
    lines.push(`  reason: ${reason}`);
  }
  for (const disqualification of target.disqualifications) {
    lines.push(`  DQ ${disqualification.code}: ${disqualification.message}`);
    lines.push(`    nodes: ${disqualification.nodeIds.join(", ") || "none"}`);
    lines.push(`    sourceRefs: ${sourceRefsLabel(disqualification.sourceRefs)}`);
  }
  for (const blocker of target.blockers) {
    lines.push(`  blocker ${blocker.id}: ${blocker.message}`);
    lines.push(`    risks: ${blocker.riskIds.join(", ") || "none"}`);
    lines.push(`    sourceRefs: ${sourceRefsLabel(blocker.sourceRefs)}`);
  }
  if (target.residualRisks.length > 0) {
    lines.push(`  residual risks: ${target.residualRisks.join(", ")}`);
  }
  if (target.requiredHumanReview.length > 0) {
    lines.push(`  required human review: ${target.requiredHumanReview.join(", ")}`);
  }
  appendExpectedMismatch(lines, target.expected);
}

export function formatCiReportText(report: CiReport): string {
  const { summary } = report;
  const failingTargets = report.targets.filter((target) => target.status !== "passed");
  const lines: string[] = [
    "Quality Evidence Graph CI Report",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${failingTargets.length === 0 ? "PASS" : "FAIL"}`,
    "",
    "Summary",
    `- targets: ${summary.totalTargets}`,
    `- passed: ${summary.passed}`,
    `- gate failed: ${summary.gateFailed}`,
    `- cli errors: ${summary.cliErrors}`,
    `- blockers: ${summary.blockerCount}`,
    `- residual risks: ${summary.residualRiskCount}`,
    `- required human review: ${summary.humanReviewCount}`,
  ];

  if (summary.dqCounts.length > 0) {
    lines.push("", "Disqualification summary");
    for (const item of summary.dqCounts) {
      lines.push(`- ${item.code}: ${item.count}`);
      lines.push(`  remediation: ${item.remediation}`);
    }
  }

  if (failingTargets.length > 0) {
    lines.push("", "Target details");
    for (const target of failingTargets) {
      appendGateFailure(lines, target);
    }
  }

  return `${lines.join("\n")}\n`;
}

function parseReportArgs(args: readonly string[]): { options: ReportOptions; targets: string[] } {
  const targets: string[] = [];
  let format: ReportFormat = "text";
  let outPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      format = "json";
      continue;
    }
    if (arg === "--format") {
      const value = args[index + 1];
      if (value !== "text" && value !== "json") {
        throw new CliError("Expected --format text|json");
      }
      format = value;
      index += 1;
      continue;
    }
    if (arg === "--out") {
      const value = args[index + 1];
      if (!value) {
        throw new CliError("Expected output path after --out");
      }
      outPath = value;
      index += 1;
      continue;
    }
    targets.push(arg);
  }

  if (targets.length === 0) {
    throw new CliError("Usage: qeg report [--json|--format text|json] [--out <path>] <fixture-dir-or-parent> [...]");
  }

  return { options: { format, outPath }, targets };
}

function formatReport(report: CiReport, format: ReportFormat): string {
  return format === "json"
    ? `${JSON.stringify(report, null, 2)}\n`
    : formatCiReportText(report);
}

function reportExitCode(report: CiReport): number {
  if (report.summary.cliErrors > 0) return 1;
  if (report.summary.gateFailed > 0) return 2;
  return 0;
}

export async function runReportCommand(args: readonly string[]): Promise<void> {
  const { options, targets } = parseReportArgs(args);
  const report = await createCiReport(targets);
  const output = formatReport(report, options.format);

  if (options.outPath) {
    const outputPath = resolve(options.outPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf-8");
  }

  console.log(output.trimEnd());
  exit(reportExitCode(report));
}
