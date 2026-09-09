/** Collection ordering and percentile calculations for Gate diagnostics. No business entrypoints. */
import type {
  Disqualification,
  GateBlocker,
  SourceRef
} from "../../types.js";


export function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}


export function nearestRank(values: readonly number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil((percentile / 100) * sorted.length) - 1] ?? null;
}


export function uniqueNodeIds(disqualifications: readonly Disqualification[]): readonly string[] {
  return [...new Set(disqualifications.flatMap((item) => item.nodeIds))].sort(lexicalCompare);
}


export function uniqueSourceRefs(
  ...groups: readonly (readonly SourceRef[])[]
): SourceRef[] {
  const byKey = new Map<string, SourceRef>();
  for (const ref of groups.flat()) {
    byKey.set(ref.id + String.fromCharCode(0) + ref.path, ref);
  }
  return [...byKey.values()].sort(
    (left, right) => lexicalCompare(left.id, right.id) || lexicalCompare(left.path, right.path),
  );
}


export function sortDisqualifications(
  values: readonly Disqualification[],
): Disqualification[] {
  return [...values].sort(
    (left, right) =>
      lexicalCompare(left.code, right.code) ||
      lexicalCompare(left.nodeIds.join(String.fromCharCode(0)), right.nodeIds.join(String.fromCharCode(0))) ||
      lexicalCompare(left.message, right.message),
  );
}


export function sortBlockers(values: readonly GateBlocker[]): GateBlocker[] {
  return [...values].sort(
    (left, right) =>
      lexicalCompare(left.ruleId ?? "", right.ruleId ?? "") ||
      lexicalCompare(left.riskIds.join(String.fromCharCode(0)), right.riskIds.join(String.fromCharCode(0))) ||
      lexicalCompare(left.testId ?? "", right.testId ?? "") ||
      lexicalCompare(left.evidenceId ?? "", right.evidenceId ?? "") ||
      lexicalCompare(left.id, right.id),
  );
}
