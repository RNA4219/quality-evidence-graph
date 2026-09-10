import type { AcceptanceCriteriaNode, ExecutionStatus, LegacyExecutionEvidenceNode, LegacyTestNode, Priority, RequirementNode, RiskNode } from "../types.js";
import { base, evidenceRef, list, object, required, rows, stableId, strings, text, trace, type RawObject } from "./common.js";
import { decision } from "./decisions.js";
import { emptyResult, type AdapterContext, type AdapterResult } from "./contracts.js";

export function manualScopedId(projectId: string, featureId: string, kind: string, local: string): string {
  if (/^(rand|ctg|hate|qeg|mbb):/.test(local)) return local;
  return stableId("mbb", kind, JSON.stringify([projectId, featureId, local]));
}
function manualId(context: AdapterContext, kind: string, local: string): string {
  return manualScopedId(context.ref.executionContext!.projectId, String(context.raw.feature_id), kind, local);
}
function manualBase(context: AdapterContext, kind: Parameters<typeof base>[1], local: string, title: string, raw: RawObject) {
  return { ...base(context.ref, kind, local, title, raw), id: manualId(context, kind, local) };
}
function identity(context: AdapterContext, caseId: string) {
  return { producer: "manual-bb-test-harness", projectId: context.ref.executionContext!.projectId,
    featureId: text(context.raw.feature_id, "feature_id"), caseId };
}
function priority(value: unknown): Priority {
  if (value === "P0" || value === "P1" || value === "P2" || value === "P3") return value;
  throw new Error(`Invalid manual priority ${String(value)}`);
}
function scale(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 5) throw new Error(`${label} must be in 1..5`);
  return value / 5;
}
function relation(result: AdapterResult, context: AdapterContext, from: string, to: string, kind: "satisfies" | "touches" | "risks" | "requires_test" | "evidenced_by"): void {
  result.edges.push({ id: stableId("mbb", "edge", JSON.stringify([from, kind, to])), from, to, kind, traceability: trace(context.ref, `${from}/${to}`) });
}
function normalizeFeature(context: AdapterContext, result: AdapterResult): void {
  const { raw, ref } = context;
  required(raw, ["feature_id", "title", "acceptance_criteria", "source_refs"]);
  const local = text(raw.feature_id, "feature_id");
  const node: RequirementNode = { ...manualBase(context, "requirement", local, text(raw.title, "feature title"), raw), kind: "requirement", acceptanceCriteriaIds: [] };
  const acceptanceIds: string[] = [];
  for (const [index, value] of list(raw.acceptance_criteria, "acceptance_criteria").entries()) {
    const item = typeof value === "string" ? { text: value } : object(value, "acceptance criterion");
    const title = text(item.text ?? item.description ?? item.title, "acceptance criterion text");
    const localAc = `${local}/${String(item.id ?? `AC-${index + 1}`)}`;
    const ac: AcceptanceCriteriaNode = { ...manualBase(context, "acceptance_criteria", localAc, title, raw), kind: "acceptance_criteria",
      requirementIds: [node.id], oracleRefs: [evidenceRef(ref, `/acceptance_criteria/${index}`)] };
    result.nodes.push(ac); acceptanceIds.push(ac.id); relation(result, context, node.id, ac.id, "satisfies");
  }
  result.nodes.push({ ...node, acceptanceCriteriaIds: acceptanceIds });
  for (const path of strings(raw.changed_areas)) {
    const changed = context.knownChanges.get(path.replaceAll("\\", "/").replace(/^\.\//, ""));
    if (changed) relation(result, context, node.id, changed, "touches");
  }
}
function normalizeRisks(context: AdapterContext, result: AdapterResult): void {
  for (const item of rows(context.raw.risks, "risks")) {
    required(item, ["id", "scenario", "impact", "likelihood", "priority"]);
    const rank = priority(item.priority);
    const node: RiskNode = { ...manualBase(context, "risk", text(item.id, "risk id"), text(item.scenario, "risk scenario"), item), kind: "risk", priority: rank,
      severity: rank === "P0" ? "critical" : rank === "P1" ? "high" : rank === "P2" ? "medium" : "low",
      likelihood: scale(item.likelihood, "likelihood"), businessImpact: scale(item.impact, "impact"), complianceCriticality: 0, evidenceGap: 1, novelty: 0.5 };
    result.nodes.push(node);
    relation(result, context, manualId(context, "requirement", text(context.raw.feature_id, "feature_id")), node.id, "risks");
    for (const id of strings(item.trace_to)) if (/^(TC|CHARTER|mbb:test)/.test(id)) relation(result, context, node.id, manualId(context, "test", id), "requires_test");
  }
}
function oracleType(value: unknown): LegacyTestNode["oracleType"] {
  return value === "specified" || value === "derived" || value === "implicit" || value === "human" ? value : "missing";
}
function riskReferences(context: AdapterContext, values: readonly string[]): string[] {
  return values.filter(id => /^(RISK|R-\d|ctg:|rand:risk|mbb:risk)/.test(id)).map(id => manualId(context, "risk", id));
}
function normalizeCases(context: AdapterContext, result: AdapterResult): void {
  const { raw, ref } = context;
  required(raw, ["manual_cases"]);
  const cases = rows(raw.manual_cases, "manual_cases").map(item => ({ item, exploratory: false }));
  cases.push(...rows(raw.exploratory_charters ?? [], "exploratory_charters").map(item => ({ item, exploratory: true })));
  for (const { item, exploratory } of cases) {
    required(item, exploratory ? ["id", "title", "scope", "questions", "trace_to"] : ["tc_id", "title", "expected_results", "oracle", "trace_to"]);
    const local = text(exploratory ? item.id : item.tc_id, "case id");
    const oracle = object(item.oracle ?? {}, "oracle");
    const expected = strings(item.expected_results);
    const node: LegacyTestNode = { ...manualBase(context, "test", local, text(item.title ?? item.mission, "case title"), item), kind: "test",
      executionIdentity: identity(context, local),
      layer: exploratory ? "manual-exploratory" : "manual-scripted", existing: true, testExecutionMode: "real", oracleType: oracleType(oracle.type),
      oracleRefs: strings(oracle.refs).map(id => evidenceRef(ref, `${local}/oracle/${id}`)), expectedResults: expected,
      coverageDimensions: strings(item.techniques), coveredRiskIds: riskReferences(context, strings(item.trace_to)),
      coveredRequirementIds: [manualId(context, "requirement", text(raw.feature_id, "feature_id"))] };
    result.nodes.push(node);
    relation(result, context, node.coveredRequirementIds![0], node.id, "requires_test");
    for (const riskId of node.coveredRiskIds ?? []) relation(result, context, riskId, node.id, "requires_test");
    if (!exploratory && (expected.length === 0 || node.oracleRefs?.length === 0)) result.unsupportedClaims.push({
      id: manualId(context, "oracle-gap", local), claim: `Scripted case ${local} has no expected result or oracle`, nodeIds: [node.id], gateRelevant: true,
    });
  }
}
function normalizeExecution(context: AdapterContext, result: AdapterResult): void {
  const { raw, ref } = context;
  required(raw, ["run_id", "build_id", "timestamp", "result"]);
  if (Boolean(raw.tc_id) === Boolean(raw.charter_id)) throw new Error("Execution requires exactly one of tc_id or charter_id");
  const caseId = text(raw.tc_id ?? raw.charter_id, "executed case id");
  const local = `${text(raw.run_id, "run_id")}/${caseId}`;
  const timestamp = text(raw.timestamp, "execution timestamp");
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("Execution timestamp is invalid");
  if (!["pass", "fail", "skip", "blocked", "unknown"].includes(String(raw.result))) throw new Error("Execution result is invalid");
  const testId = manualId(context, "test", caseId);
  const ingest = ref.executionContext!;
  if (raw.env !== undefined && raw.env !== ingest.environmentId) throw new Error("Execution environment disagrees with descriptor");
  if (!ref.contentHash || !ref.revision) throw new Error("Execution raw requires hash and revision");
  const node: LegacyExecutionEvidenceNode = { ...manualBase(context, "execution_evidence", local, `${caseId}: ${String(raw.result)}`, raw), kind: "execution_evidence",
    execution: { executionVersion: "qeg-execution/v1", testId, identity: identity(context, caseId), producerVersion: ingest.producerVersion,
      runId: text(raw.run_id, "run_id"), target: { projectId: ingest.projectId, environmentId: ingest.environmentId, buildId: text(raw.build_id, "build_id"), revision: ref.revision },
      completedAt: timestamp, status: (raw.result === "skip" ? "skipped" : raw.result) as ExecutionStatus, executionMode: "real",
      rawArtifactRef: { id: ref.id, path: ref.path, contentHash: ref.contentHash, revision: ref.revision } },
    ...(raw.result === "pass" || raw.result === "fail" ? { passed: raw.result === "pass" } : {}),
    evidenceRefs: [{ ...evidenceRef(ref, "/", "test_result"), capturedAt: timestamp }] };
  result.nodes.push(node);
  relation(result, context, testId, node.id, "evidenced_by");
}
export function normalizeManualBb(context: AdapterContext): AdapterResult {
  const { raw, ref } = context;
  if (ref.contractVersion !== "manual-bb/v1") throw new Error("manual-bb requires manual-bb/v1 manifest contract");
  if (!ref.executionContext) throw new Error("manual-bb requires explicit executionContext");
  for (const key of ["projectId", "environmentId", "producerVersion"] as const) text(ref.executionContext[key], key);
  text(raw.feature_id, "feature_id");
  const result = emptyResult();
  switch (ref.kind) {
    case "feature_spec": normalizeFeature(context, result); break;
    case "risk_register": normalizeRisks(context, result); break;
    case "manual_case_set": normalizeCases(context, result); break;
    case "execution_evidence": normalizeExecution(context, result); break;
    case "gate_decision":
      required(raw, ["build_id", "status", "profile", "reasons", "evidence_summary"]);
      if (!context.executionPolicy || raw.build_id !== context.executionPolicy.target.buildId ||
        ref.executionContext.projectId !== context.executionPolicy.target.projectId || ref.executionContext.environmentId !== context.executionPolicy.target.environmentId) {
        result.parserFailures.push({ path: ref.path, reason: "EAC-01 gate_decision target differs from executionPolicy", code: "DQ-12", sourceRefs: trace(ref, "/build_id").sourceRefs });
      }
      result.nodes.push(decision(ref, `${ref.executionContext.projectId}/${String(raw.feature_id)}/gate`, raw.status, context.profile, raw)); break;
    default: throw new Error(`Unsupported manual-bb artifact ${ref.kind}`);
  }
  return result;
}
