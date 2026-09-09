import type { SourceRef } from "../../../types.js";
import type {
  ReportExpectedComparison,
  ReportTargetResult
} from "../model.js";

export function sourceRefLabel(sourceRef: SourceRef): string {
  const parts = [sourceRef.id, sourceRef.path];
  if (sourceRef.label) {
    parts.push(sourceRef.label);
  }
  return parts.filter(Boolean).join(" ");
}


export function sourceRefsLabel(sourceRefs: readonly SourceRef[]): string {
  if (sourceRefs.length === 0) return "none";
  return sourceRefs.map(sourceRefLabel).join("; ");
}


export function appendExpectedMismatch(lines: string[], expected: ReportExpectedComparison | undefined): void {
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


export function appendGateFailure(lines: string[], target: ReportTargetResult): void {
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


export function isFailureTarget(target: ReportTargetResult): boolean {
  return target.status === "gate_failed" || target.status === "cli_error";
}


export function rateLabel(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}


export function appendReliabilityTarget(lines: string[], target: ReportTargetResult): void {
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
