import type {
  CiReport
} from "../model.js";
import { appendReliabilityTarget, isFailureTarget } from "./shared.js";


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
  for (const target of report.targets) if (target.evaluationScope) {
    const scope = target.evaluationScope;
    lines.push(`- scope: ${scope.kind} / ${scope.target}`, `- not evaluated: ${scope.notEvaluated.join(", ") || "none declared"}`, "");
  }
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
