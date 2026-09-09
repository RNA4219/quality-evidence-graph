import type {
  CiReport
} from "../model.js";
import { appendGateFailure, appendReliabilityTarget, isFailureTarget } from "./shared.js";


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
  for (const target of report.targets) if (target.evaluationScope) {
    const scope = target.evaluationScope;
    lines.push(`Scope: ${scope.kind} / ${scope.target}`, `Not evaluated: ${scope.notEvaluated.join(", ") || "none declared"}`);
  }
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
