import { isDeepStrictEqual } from "node:util";
import type { Disqualification, EvidenceRef, GateBlocker, ManualEvidenceItem, SourceRef, StableId } from "../types.js";
import type { DQDetectorInput } from "./context.js";
import { inputSource } from "../input-contract.js";

export interface ManualEvidenceAssessment {
  readonly disqualifications: Disqualification[];
  readonly blockers: GateBlocker[];
  readonly humanReview: StableId[];
  readonly reviewedRiskIds: ReadonlySet<StableId>;
}

const nonblank = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
function references(value: unknown): value is EvidenceRef[] {
  return Array.isArray(value) && value.length > 0 && value.every(ref =>
    ref && nonblank(ref.id) && nonblank(ref.path) && nonblank(ref.evidenceKind));
}

/** One assessment feeds eligibility, blockers and review; a manual pass never supplies execution accounting. */
export function assessManualEvidence(input: DQDetectorInput): ManualEvidenceAssessment {
  const disqualifications: Disqualification[] = [], blockers: GateBlocker[] = [], humanReview: StableId[] = [];
  const reviewedRiskIds = new Set<StableId>();
  const result = { disqualifications, blockers, humanReview, reviewedRiskIds };
  if (!input.evidencePackage) return result;
  const items = input.evidencePackage.manualEvidence;
  const add = (index: number, id: unknown, message: string): void => {
    disqualifications.push({ code: "DQ-08", message, nodeIds: nonblank(id) ? [id] : [],
      sourceRefs: [inputSource(`/evidencePackage/manualEvidence/${index}`, message)] });
  };
  if (!Array.isArray(items)) { add(0, undefined, "Manual evidence must be an array"); return result; }
  const nodes = new Map(input.graph.nodes.map(node => [node.id, node]));
  const grouped = new Map<string, ManualEvidenceItem[]>();
  for (const item of items) if (item && nonblank(item.executedCaseId)) {
    const group = grouped.get(item.executedCaseId) ?? [];
    if (!group.some(previous => isDeepStrictEqual(previous, item))) group.push(item);
    grouped.set(item.executedCaseId, group);
  }
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    const id = item?.executedCaseId;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!item || !nonblank(id) || !nonblank(item.expectedResult) ||
      !references(item.oracleRefs) || !references(item.evidenceRefs) ||
      !Array.isArray(item.traceTo) || item.traceTo.length === 0 || !item.traceTo.every(nonblank)) {
      // Preserve the established incomplete-evidence diagnostic; the final source pass attaches the subject.
      disqualifications.push({ code: "DQ-08", message: `Manual evidence "${id ?? "unknown"}" incomplete`, nodeIds: nonblank(id) ? [id] : [], sourceRefs: [] }); continue;
    }
    if (!["pass", "fail", "blocked", "skipped"].includes(item.result) ||
      (item.reviewerNote !== undefined && typeof item.reviewerNote !== "string")) {
      add(index, id, `Manual evidence "${id}" has an invalid result or reviewer note`); continue;
    }
    if ((grouped.get(id)?.length ?? 0) > 1) {
      add(index, id, `Manual evidence "${id}" has conflicting current records`); continue;
    }
    if (item.traceTo.some((target: string) => !["requirement", "risk", "acceptance_criteria"].includes(nodes.get(target)?.kind ?? ""))) {
      add(index, id, `Manual evidence "${id}" has unresolved requirement, risk or acceptance references`); continue;
    }
    const test = nodes.get(id);
    const hasNote = nonblank(item.reviewerNote);
    // Legacy source-backed risk-review notes are not test executions. Preserve their explicit review contract.
    const riskReview = !test && item.result === "pass" && hasNote &&
      item.traceTo.every((target: string) => nodes.get(target)?.kind === "risk") &&
      [...item.oracleRefs, ...item.evidenceRefs].every(ref => ref.evidenceKind === "human_review");
    if (!riskReview && (test?.kind !== "test" || test.deleted || test.testExecutionMode !== "real" ||
      !["manual-scripted", "manual-exploratory"].includes(test.layer))) {
      add(index, id, `Manual evidence "${id}" does not reference a current real manual test`); continue;
    }
    const selection = input.executionAccounting?.selections.find(selected => selected.testId === id);
    if (selection?.selectedStatus !== undefined && selection.selectedStatus !== item.result) {
      add(index, id, `Manual evidence "${id}" disagrees with the selected execution result`); continue;
    }
    const riskIds = [...new Set([
      ...item.traceTo.filter((target: string) => nodes.get(target)?.kind === "risk"),
      ...(test?.kind === "test" ? test.coveredRiskIds ?? [] : []),
    ])];
    const refs: SourceRef[] = [...item.evidenceRefs, ...item.oracleRefs].map(({ evidenceKind: _kind, capturedAt: _time, ...ref }) => ref);
    if (item.result === "fail" && selection?.selectedStatus !== "fail") {
      blockers.push({ id: `qeg:manual-failed-${id}`, message: `Reported manual execution "${id}" failed`, testId: id, riskIds, sourceRefs: refs });
    }
    if (item.result === "blocked" || item.result === "skipped") humanReview.push(id);
    if (item.result === "pass" && hasNote && (riskReview || !input.policy.inputContract?.requireExecutedTests || selection?.selectedStatus === "pass")) {
      for (const target of item.traceTo) if (nodes.get(target)?.kind === "risk") reviewedRiskIds.add(target);
    }
  }
  return result;
}
