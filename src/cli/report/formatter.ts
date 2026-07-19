import type { SourceRef } from "../../types.js";
import { getDqExplanation } from "../dq-explain.js";
import type {
  CiReport,
  ReportExpectedComparison,
  ReportTargetResult,
} from "./model.js";
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

function rateLabel(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}

function appendReliabilityTarget(lines: string[], target: ReportTargetResult): void {
  const reliability = target.reliability;
  lines.push(`- ${target.target}`);
  lines.push(`  enabled: ${reliability.enabled}`);
  if (!reliability.enabled) return;
  lines.push(`  risk coverage: ${reliability.qualifiedRiskCount}/${reliability.requiredRiskCount} (${rateLabel(reliability.riskCoverageRate)})`);
  lines.push(`  executions required/qualified/passing: ${reliability.requiredExecutionCount}/${reliability.qualifiedExecutionCount}/${reliability.passingExecutionCount}`);
  lines.push(`  execution pass rate: ${reliability.passingExecutionCount}/${reliability.qualifiedExecutionCount} (${rateLabel(reliability.resiliencePassRate)})`);
  lines.push(`  recovery seconds p50/p95/sample: ${reliability.recoverySecondsP50 ?? "n/a"}/${reliability.recoverySecondsP95 ?? "n/a"}/${reliability.recoverySampleCount}`);
  lines.push(`  duplicate side effects/data inconsistencies: ${reliability.duplicateSideEffectsCount}/${reliability.dataInconsistenciesCount}`);
  const ages = Object.entries(reliability.evidenceAgeHours).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  lines.push(`  evidence age hours: ${ages.length === 0 ? "none" : ages.map(([id, age]) => `${id}=${age}`).join(", ")}`);
  lines.push(`  excluded mock tests: ${reliability.excludedMockTests.length === 0 ? "none" : reliability.excludedMockTests.map((item) => item.testId).join(", ")}`);
  lines.push(`  DQ counts: ${Object.entries(reliability.dqCountByRule).map(([code, count]) => `${code}=${count}`).join(", ")}`);
  for (const item of reliability.drillDown) {
    lines.push([
      `  selection: risk=${item.riskId}`,
      `test=${item.testId}`,
      `evidence=${item.selectedEvidenceId ?? "none"}`,
      `adapter=${item.adapter ?? "none"}`,
      `experiment=${item.experimentId ?? "none"}`,
      `attempt=${item.attempt ?? "none"}`,
      `revision=${item.targetRevision ?? "none"}`,
      `environment=${item.environmentId ?? "none"}`,
      `reason=${item.selectionReason}`,
      `exclusion=${item.exclusionReason ?? "none"}`,
      `DQs=${item.disqualificationCodes.join(",") || "none"}`,
      `blockers=${item.blockerIds.join(",") || "none"}`,
    ].join(" "));
  }
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

  const reliabilityTargets = report.targets;
  if (reliabilityTargets.length > 0) {
    lines.push("", "Reliability");
    for (const target of reliabilityTargets) appendReliabilityTarget(lines, target);
  }

  if (summary.dqCounts.length > 0) {
    lines.push("", "Disqualification summary");
    for (const item of summary.dqCounts) {
      lines.push(`- ${item.code}: ${item.count}`);
      lines.push(`  remediation: ${item.remediation}`);
    }
  }

  if (report.diff) {
    lines.push(
      "",
      "Diff summary",
      `- previous report: ${report.diff.previousReport}`,
      `- new DQs: ${report.diff.new.length}`,
      `- resolved DQs: ${report.diff.resolved.length}`,
      `- unchanged DQs: ${report.diff.unchanged.length}`
    );
    for (const item of report.diff.new) {
      lines.push(`  new ${item.code}: ${item.target} - ${item.message}`);
    }
    for (const item of report.diff.resolved) {
      lines.push(`  resolved ${item.code}: ${item.target} - ${item.message}`);
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

  const reliabilityTargets = report.targets;
  if (reliabilityTargets.length > 0) {
    lines.push("### Reliability", "");
    for (const target of reliabilityTargets) appendReliabilityTarget(lines, target);
    lines.push("");
  }

  if (summary.dqCounts.length > 0) {
    lines.push("### Disqualifications", "");
    for (const dq of summary.dqCounts) {
      lines.push(`- ${dq.code}: ${dq.count} - ${dq.remediation}`);
    }
    lines.push("");
  }

  if (report.diff) {
    lines.push("### Diff", "");
    lines.push(`- previous report: ${report.diff.previousReport}`);
    lines.push(`- new DQs: ${report.diff.new.length}`);
    lines.push(`- resolved DQs: ${report.diff.resolved.length}`);
    lines.push(`- unchanged DQs: ${report.diff.unchanged.length}`);
    lines.push("");
    for (const item of report.diff.new) {
      lines.push(`- new ${item.code}: ${item.target} - ${item.message}`);
    }
    for (const item of report.diff.resolved) {
      lines.push(`- resolved ${item.code}: ${item.target} - ${item.message}`);
    }
    if (report.diff.new.length > 0 || report.diff.resolved.length > 0) {
      lines.push("");
    }
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

