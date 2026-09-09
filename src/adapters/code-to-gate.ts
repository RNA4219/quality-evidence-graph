import type { ChangedCodeNode, FindingNode, LegacyTestNode, PlacementLayer, RiskNode, Severity } from "../types.js";
import { base, confidence, object, required, rows, stableId, strings, text, trace, type RawObject } from "./common.js";
import { decision } from "./decisions.js";
import { emptyResult, type AdapterContext, type AdapterResult } from "./contracts.js";

const REQUIRED: Readonly<Record<string, readonly string[]>> = {
  normalized_repo_graph: ["files", "modules", "symbols", "relations", "tests", "configs", "entrypoints", "diagnostics", "stats"],
  diff_analysis: ["changed_files", "blast_radius", "diff_findings"], findings: ["completeness", "findings", "unsupported_claims"],
  risk_register: ["completeness", "risks"], test_seeds: ["completeness", "seeds"],
  release_readiness: ["status", "completeness", "summary", "counts", "failedConditions", "recommendedActions", "artifactRefs"],
  audit: ["inputs", "policy", "exit"],
};
const LEVELS: Readonly<Record<string, PlacementLayer>> = { unit: "unit", integration: "integration", component: "integration", contract: "integration", api: "integration",
  system: "system", e2e: "e2e", manual: "manual-scripted", exploratory: "manual-exploratory", security: "system", performance: "system" };
function severity(value: unknown): Severity {
  if (value === "critical" || value === "high" || value === "medium" || value === "low" || value === "info") return value;
  throw new Error(`Unknown severity ${String(value)}`);
}
function changedIds(context: AdapterContext, raw: RawObject): string[] {
  return [...new Set(rows(raw.evidence ?? [], "evidence").flatMap(e => {
    const path = typeof e.path === "string" ? e.path.replaceAll("\\", "/").replace(/^\.\//, "") : "";
    const id = context.knownChanges.get(path); return id ? [id] : [];
  }))];
}
function edge(result: AdapterResult, context: AdapterContext, from: string, to: string, kind: "risks" | "touches" | "requires_test" | "derives_from"): void {
  result.edges.push({ id: stableId("ctg", "edge", `${from}/${kind}/${to}`), from, to, kind, traceability: trace(context.ref, `${from}/${to}`) });
}
function normalizeDiff(context: AdapterContext, result: AdapterResult): void {
  for (const file of rows(context.raw.changed_files, "changed_files")) {
    const path = text(file.path, "changed file path").replaceAll("\\", "/").replace(/^\.\//, "");
    const node: ChangedCodeNode = { ...base(context.ref, "changed_code", path, path, file), kind: "changed_code", path,
      symbols: strings(file.symbols), blastRadius: strings(object(context.raw.blast_radius, "blast_radius").affectedFiles).length,
      hunks: rows(file.hunks ?? [], "hunks").map((h, index) => ({ id: stableId("ctg", "hunk", `${path}/${index}`), path,
        startLine: Number(h.startLine), endLine: Number(h.endLine), revision: context.ref.revision })) };
    result.nodes.push(node);
  }
}
function normalizeFindings(context: AdapterContext, result: AdapterResult): void {
  for (const item of rows(context.raw.findings, "findings")) {
    required(item, ["id", "title", "ruleId", "severity", "confidence", "evidence"]);
    const node: FindingNode = { ...base(context.ref, "finding", text(item.id, "finding id"), text(item.title, "finding title"), item),
      kind: "finding", ruleId: text(item.ruleId, "ruleId"), severity: severity(item.severity), changedCodeIds: changedIds(context, item) };
    result.nodes.push(node);
    for (const changed of node.changedCodeIds) edge(result, context, node.id, changed, "touches");
  }
  for (const claim of rows(context.raw.unsupported_claims, "unsupported_claims")) result.unsupportedClaims.push({
    id: stableId("ctg", "claim", text(claim.id, "claim id")), claim: text(claim.claim, "claim"), nodeIds: [], gateRelevant: true,
  });
}
function normalizeRisks(context: AdapterContext, result: AdapterResult): void {
  for (const item of rows(context.raw.risks, "risks")) {
    required(item, ["id", "title", "severity", "likelihood", "evidence", "sourceFindingIds"]);
    const level = severity(item.severity);
    const chance = typeof item.likelihood === "number" ? item.likelihood : item.likelihood === "high" ? 0.8 : item.likelihood === "low" ? 0.2 : 0.5;
    const node: RiskNode = { ...base(context.ref, "risk", text(item.id, "risk id"), text(item.title, "risk title"), item), kind: "risk",
      priority: level === "critical" ? "P0" : level === "high" ? "P1" : level === "medium" ? "P2" : "P3", severity: level,
      likelihood: chance, businessImpact: level === "critical" ? 1 : level === "high" ? 0.8 : 0.5,
      complianceCriticality: 0, evidenceGap: 1, novelty: 0.5 };
    result.nodes.push(node);
    for (const finding of strings(item.sourceFindingIds)) edge(result, context, node.id, stableId("ctg", "finding", finding), "derives_from");
    for (const change of changedIds(context, item)) edge(result, context, node.id, change, "touches");
  }
}
function normalizeSeeds(context: AdapterContext, result: AdapterResult): void {
  for (const item of rows(context.raw.seeds, "seeds")) {
    required(item, ["id", "title", "sourceRiskIds", "sourceFindingIds", "suggestedLevel", "evidence"]);
    const layer = LEVELS[String(item.suggestedLevel)];
    if (!layer) throw new Error(`Unknown suggestedLevel: ${String(item.suggestedLevel)}`);
    const node: LegacyTestNode = { ...base(context.ref, "test", text(item.id, "seed id"), text(item.title, "seed title"), item), kind: "test",
      layer, existing: false, testExecutionMode: "real", oracleType: "missing", expectedResults: [], oracleRefs: [],
      coveredRiskIds: strings(item.sourceRiskIds).map(id => stableId("ctg", "risk", id)), coveredChangedCodeIds: changedIds(context, item) };
    result.nodes.push(node);
    for (const risk of node.coveredRiskIds ?? []) edge(result, context, risk, node.id, "requires_test");
    for (const finding of strings(item.sourceFindingIds)) edge(result, context, node.id, stableId("ctg", "finding", finding), "derives_from");
  }
}
function normalizeRepo(context: AdapterContext, result: AdapterResult): void {
  const files = rows(context.raw.files, "files");
  for (const item of rows(context.raw.tests, "tests")) {
    const id = text(item.id, "existing test id");
    const file = files.find(f => f.id === item.fileId);
    const path = item.path ?? file?.path;
    const layer = LEVELS[String(item.level ?? item.layer ?? item.kind)] ?? "unit";
    result.nodes.push({ ...base(context.ref, "test", id, String(item.name ?? item.title ?? path ?? id), item), kind: "test", layer,
      existing: true, testExecutionMode: "real", oracleType: "missing", coveredRiskIds: [], coveredChangedCodeIds: [],
      ...(typeof item.command === "string" ? { command: item.command } : {}) });
  }
  for (const diagnostic of rows(context.raw.diagnostics, "diagnostics")) if (diagnostic.severity === "error") result.parserFailures.push({
    path: context.ref.path, reason: String(diagnostic.message), sourceRefs: trace(context.ref, "/diagnostics").sourceRefs,
  });
}
export function normalizeCodeToGate(context: AdapterContext): AdapterResult {
  const { ref, raw } = context;
  const name = ref.kind.replaceAll("_", "-");
  if (ref.contractVersion !== "ctg-artifacts/v1" || raw.artifact !== name || raw.schema !== `${name}@v1`) throw new Error(`Expected ${name}@v1 producer contract`);
  const fields = REQUIRED[ref.kind];
  if (!fields) throw new Error(`Unsupported CTG artifact ${ref.kind}`);
  required(raw, fields);
  const result = emptyResult();
  if (ref.kind === "diff_analysis") normalizeDiff(context, result);
  if (ref.kind === "findings") normalizeFindings(context, result);
  if (ref.kind === "risk_register") normalizeRisks(context, result);
  if (ref.kind === "test_seeds") normalizeSeeds(context, result);
  if (ref.kind === "normalized_repo_graph") normalizeRepo(context, result);
  if (ref.kind === "release_readiness") result.nodes.push(decision(ref, "release-readiness", raw.status, context.profile, raw));
  if (ref.kind === "audit") { rows(raw.inputs, "audit.inputs"); object(raw.policy, "audit.policy"); object(raw.exit, "audit.exit"); }
  if (raw.completeness === "partial" || (ref.kind === "normalized_repo_graph" && object(raw.stats, "stats").partial === true)) result.parserFailures.push({
    path: ref.path, reason: "CTG completeness is partial", sourceRefs: trace(ref, "/completeness").sourceRefs,
  });
  return result;
}
