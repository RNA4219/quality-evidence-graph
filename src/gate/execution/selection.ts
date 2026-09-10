import type { ExecutionSelection, LegacyExecutionEvidenceNode } from "../../types.js";
import { compareId, executionTime, same } from "./contracts.js";

export interface SelectionResult { selection: ExecutionSelection; error?: string; }
function decision(node: LegacyExecutionEvidenceNode) {
  const { rawArtifactRef, ...meaning } = node.execution!;
  return { ...meaning, rawArtifactRef: { contentHash: rawArtifactRef.contentHash, revision: rawArtifactRef.revision } };
}
/** Candidates have already passed identity, target, clock and file qualification. */
export function selectLatest(testId: string, candidates: readonly LegacyExecutionEvidenceNode[], evaluatedAt: number, maxAge: number,
  excluded: { evidenceId: string; reason: string }[] = []): SelectionResult {
  const empty = (reason: string): SelectionResult => ({ selection: { testId, reason, consecutivePasses: 0, excluded }, error: reason });
  const byRun = new Map<string, LegacyExecutionEvidenceNode>();
  for (const node of [...candidates].sort(compareId)) {
    const run = node.execution!;
    const previous = byRun.get(run.runId);
    if (previous) {
      if (!same(decision(previous), decision(node))) return empty("EAC-03 conflicting execution identity");
      excluded.push({ evidenceId: node.id, reason: "duplicate" });
    } else byRun.set(run.runId, node);
  }
  const ordered = [...byRun.values()].sort((a, b) => executionTime(b.execution!.completedAt) - executionTime(a.execution!.completedAt));
  const latest = ordered[0];
  if (!latest) return empty("EAC-06 no current execution");
  const time = executionTime(latest.execution!.completedAt);
  if (ordered[1] && time === executionTime(ordered[1].execution!.completedAt)) return empty("EAC-03 ambiguous latest completion time");
  if (evaluatedAt - time > maxAge) return empty("EAC-02 latest execution is stale");
  let consecutivePasses = 0;
  for (let i = 0; i < ordered.length; i++) {
    const current = ordered[i]!;
    const detail = current.execution!;
    const t = executionTime(detail.completedAt);
    if (i > 0) excluded.push({ evidenceId: current.id, reason: evaluatedAt - t > maxAge ? "superseded_stale" : "superseded" });
    if (consecutivePasses === i && detail.status === "pass" && evaluatedAt - t <= maxAge &&
      !(ordered[i + 1] && t === executionTime(ordered[i + 1]!.execution!.completedAt))) consecutivePasses++;
  }
  return { selection: { testId, selectedEvidenceId: latest.id, selectedRunId: latest.execution!.runId,
    selectedStatus: latest.execution!.status, reason: "latest_qualified_execution", consecutivePasses,
    excluded: excluded.sort((a, b) => a.evidenceId.localeCompare(b.evidenceId, "en")) } };
}
