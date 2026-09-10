import type { ExecutionAccounting } from "../../types.js";

export function executionSummary(accounting: ExecutionAccounting | undefined): string[] {
  if (!accounting) return [];
  const target = accounting.target;
  return ["", "実行証跡の採用", `- 評価時計: ${accounting.evaluatedAt}`,
    ...(target ? [`- 対象: ${target.projectId} / ${target.buildId} / ${target.environmentId} / ${target.revision}`] : []),
    ...accounting.selections.flatMap(s => [`- ${s.testId}: run=${s.selectedRunId ?? "none"}; evidence=${s.selectedEvidenceId ?? "none"}; status=${s.selectedStatus ?? "none"}; reason=${s.reason}; consecutivePasses=${s.consecutivePasses}`,
      ...s.excluded.map(e => `  - excluded=${e.evidenceId}; reason=${e.reason}`)])];
}
