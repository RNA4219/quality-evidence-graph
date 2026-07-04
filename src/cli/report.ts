import { appendFile, mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import type { Dirent } from "fs";
import { dirname, join, relative, resolve } from "path";
import { exit } from "process";
import { execFile } from "child_process";
import { promisify } from "util";
import { getExitCode } from "../gate.js";
import type {
  Disqualification,
  DisqualificationCode,
  GateBlocker,
  GateVerdict,
  SourceRef,
  StableId,
} from "../types.js";
import { getDqExplanation } from "./dq-explain.js";
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

const execFileAsync = promisify(execFile);

export type ReportTargetStatus = "passed" | "baseline_accepted" | "gate_failed" | "cli_error";
export type ReportFormat = "text" | "json";

export interface ReportOptions {
  readonly format: ReportFormat;
  readonly outPath?: string;
  readonly githubSummary?: boolean;
  readonly baselinePath?: string;
  readonly changedOnly?: boolean;
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
  readonly baselineAccepted: number;
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

interface BaselineEntry {
  readonly target?: string;
  readonly code: DisqualificationCode;
  readonly message?: string;
  readonly nodeIds?: readonly StableId[];
}

interface ReportBaseline {
  readonly entries: readonly BaselineEntry[];
}

interface CreateCiReportOptions {
  readonly baselinePath?: string;
  readonly changedOnly?: boolean;
}

interface GateInputForChangedOnly {
  readonly graph?: {
    readonly nodes?: readonly {
      readonly kind?: string;
      readonly path?: string;
    }[];
  };
  readonly metadata?: {
    readonly inputArtifacts?: readonly { readonly path?: string }[];
  };
}

async function safeStat(path: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

function portable(path: string): string {
  return path.replace(/\\/g, "/");
}

function relativeTarget(target: string): string {
  return portable(relative(process.cwd(), target));
}

async function readBaseline(path: string | undefined): Promise<ReportBaseline | undefined> {
  if (!path) return undefined;
  return readJsonFile<ReportBaseline>(path);
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

function applyBaseline(target: ReportTargetResult, baseline: ReportBaseline | undefined): ReportTargetResult {
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

async function gitChangedFiles(): Promise<string[]> {
  if (process.env.QEG_CHANGED_FILES) {
    return process.env.QEG_CHANGED_FILES
      .split(/[,\r\n]+/)
      .map((file) => file.trim())
      .filter(Boolean)
      .map(portable);
  }

  const attempts = [
    ["diff", "--name-only", "--diff-filter=ACMRTUXB", "origin/main...HEAD"],
    ["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD~1...HEAD"],
    ["diff", "--name-only", "--diff-filter=ACMRTUXB"],
  ];

  for (const args of attempts) {
    try {
      const { stdout } = await execFileAsync("git", args);
      const files = stdout.split(/\r?\n/).map((file) => file.trim()).filter(Boolean).map(portable);
      if (files.length > 0) return files;
    } catch {
      // Try the next diff strategy.
    }
  }
  return [];
}

async function targetMentionsChangedFile(target: string, changedFiles: readonly string[]): Promise<boolean> {
  const relTarget = relativeTarget(target);
  if (changedFiles.some((file) => file === relTarget || file.startsWith(`${relTarget}/`))) {
    return true;
  }

  try {
    const input = await readJsonFile<GateInputForChangedOnly>(join(target, "gate-input.json"));
    const artifactPaths = (input.metadata?.inputArtifacts ?? [])
      .map((artifact) => artifact.path)
      .filter((path): path is string => Boolean(path))
      .map(portable);
    const changedCodePaths = (input.graph?.nodes ?? [])
      .filter((node) => node.kind === "changed_code" && node.path)
      .map((node) => portable(node.path as string));
    return [...artifactPaths, ...changedCodePaths].some((path) => changedFiles.includes(path));
  } catch {
    return false;
  }
}

async function filterChangedTargets(targets: readonly string[], changedOnly: boolean | undefined): Promise<string[]> {
  if (!changedOnly) return [...targets];
  const changedFiles = await gitChangedFiles();
  if (changedFiles.length === 0) return [];

  const filtered: string[] = [];
  for (const target of targets) {
    if (await targetMentionsChangedFile(target, changedFiles)) {
      filtered.push(target);
    }
  }
  return filtered;
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
      remediation: getDqExplanation(code).remediation,
    }));
}

function buildSummary(targets: readonly ReportTargetResult[]): ReportSummary {
  return {
    totalTargets: targets.length,
    passed: targets.filter((target) => target.status === "passed").length,
    baselineAccepted: targets.filter((target) => target.status === "baseline_accepted").length,
    gateFailed: targets.filter((target) => target.status === "gate_failed").length,
    cliErrors: targets.filter((target) => target.status === "cli_error").length,
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
  const targets = await filterChangedTargets(collectedTargets, options.changedOnly);
  const baseline = await readBaseline(options.baselinePath);
  const results: ReportTargetResult[] = [];
  for (const target of targets) {
    results.push(applyBaseline(await evaluateReportTarget(target), baseline));
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

function isFailureTarget(target: ReportTargetResult): boolean {
  return target.status === "gate_failed" || target.status === "cli_error";
}

export function formatCiReportText(report: CiReport): string {
  const { summary } = report;
  const failingTargets = report.targets.filter(isFailureTarget);
  const baselineTargets = report.targets.filter((target) => target.status === "baseline_accepted");
  const lines: string[] = [
    "Quality Evidence Graph CI Report",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${failingTargets.length === 0 ? "PASS" : "FAIL"}`,
    "",
    "Summary",
    `- targets: ${summary.totalTargets}`,
    `- passed: ${summary.passed}`,
    `- baseline accepted: ${summary.baselineAccepted}`,
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

  if (baselineTargets.length > 0) {
    lines.push("", "Baseline accepted targets");
    for (const target of baselineTargets) {
      appendGateFailure(lines, target);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatGithubSummary(report: CiReport): string {
  const { summary } = report;
  const lines = [
    "## QEG CI Report",
    "",
    `- targets: ${summary.totalTargets}`,
    `- passed: ${summary.passed}`,
    `- baseline accepted: ${summary.baselineAccepted}`,
    `- gate failed: ${summary.gateFailed}`,
    `- cli errors: ${summary.cliErrors}`,
    `- blockers: ${summary.blockerCount}`,
    `- residual risks: ${summary.residualRiskCount}`,
    `- required human review: ${summary.humanReviewCount}`,
    "",
  ];

  if (summary.dqCounts.length > 0) {
    lines.push("### Disqualifications", "");
    for (const dq of summary.dqCounts) {
      lines.push(`- ${dq.code}: ${dq.count} - ${dq.remediation}`);
    }
    lines.push("");
  }

  const failedTargets = report.targets.filter(isFailureTarget);
  if (failedTargets.length > 0) {
    lines.push("### Targets", "");
    for (const target of failedTargets) {
      lines.push(`- ${target.target}: ${target.status}${target.verdict ? ` / ${target.verdict}` : ""}`);
      if (target.error) {
        lines.push(`  - ${target.error}`);
      }
      for (const disqualification of target.disqualifications) {
        lines.push(`  - ${disqualification.code}: ${disqualification.message}`);
      }
    }
  }

  const baselineTargets = report.targets.filter((target) => target.status === "baseline_accepted");
  if (baselineTargets.length > 0) {
    lines.push("### Baseline accepted targets", "");
    for (const target of baselineTargets) {
      lines.push(`- ${target.target}: ${target.status}${target.verdict ? ` / ${target.verdict}` : ""}`);
      for (const disqualification of target.disqualifications) {
        lines.push(`  - ${disqualification.code}: ${disqualification.message}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function parseReportArgs(args: readonly string[]): { options: ReportOptions; targets: string[] } {
  const targets: string[] = [];
  let format: ReportFormat = "text";
  let outPath: string | undefined;
  let githubSummary = false;
  let baselinePath: string | undefined;
  let changedOnly = false;

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
    if (arg === "--github-summary") {
      githubSummary = true;
      continue;
    }
    if (arg === "--baseline") {
      const value = args[index + 1];
      if (!value) {
        throw new CliError("Expected baseline path after --baseline");
      }
      baselinePath = value;
      index += 1;
      continue;
    }
    if (arg === "--changed-only") {
      changedOnly = true;
      continue;
    }
    targets.push(arg);
  }

  if (targets.length === 0) {
    throw new CliError(
      "Usage: qeg report [--json|--format text|json] [--out <path>] [--github-summary] [--baseline <path>] [--changed-only] <fixture-dir-or-parent> [...]"
    );
  }

  return { options: { format, outPath, githubSummary, baselinePath, changedOnly }, targets };
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
  const report = await createCiReport(targets, {
    baselinePath: options.baselinePath,
    changedOnly: options.changedOnly,
  });
  const output = formatReport(report, options.format);

  if (options.outPath) {
    const outputPath = resolve(options.outPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf-8");
  }

  if (options.githubSummary) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) {
      throw new CliError("--github-summary requires GITHUB_STEP_SUMMARY to be set");
    }
    await appendFile(summaryPath, formatGithubSummary(report), "utf-8");
  }

  console.log(output.trimEnd());
  exit(reportExitCode(report));
}
