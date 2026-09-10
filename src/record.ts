import { createHash } from "crypto";
import type { AuditTrail, EvidencePackage, GatePolicy, QualityEvidenceRecord } from "./types.js";
import type { EvaluatedFixture } from "./cli/fixture-io.js";
import { appendEscapedDefectNodes, buildGateEfficacyRecords, buildRecalibrationProposalsForFixture } from "./gate-efficacy.js";
import { executionSummary } from "./gate/execution/format.js";

export function jsonDocument(value: unknown): string { return JSON.stringify(value, null, 2) + "\n"; }
export function contentHash(content: string | Buffer): string { return "sha256:" + createHash("sha256").update(content).digest("hex"); }

function auditTrail(evidencePackage: EvidencePackage | undefined, policy: GatePolicy): AuditTrail | undefined {
  if (!evidencePackage) return undefined;
  return {
    evidencePackageHash: evidencePackage.evidencePackageHash,
    approvalEvidenceSummary: evidencePackage.approvalEvidence.map(a => ({ id: a.id, approver: a.approver, approvedAt: a.approvedAt,
      policyId: a.policyId, policyHash: a.policyHash, evidencePackageHash: a.evidencePackageHash })),
    gatePolicyHash: policy.policyHash, gatePolicyId: policy.policyId,
  };
}

function markdownSummary(evaluated: EvaluatedFixture): string {
  const gate = evaluated.gateResult;
  const scope = gate.evaluationScope;
  const lines = ["# Quality Evidence Record", "", `Gate: **${gate.verdict}**`, "",
    ...(scope ? [`評価範囲: ${scope.kind} / ${scope.target}`, `未評価: ${scope.notEvaluated.join(", ") || "明記なし"}`, ""] : []),
    "## 判定理由", "", ...gate.reasons.map(reason => `- ${reason}`), "", "## テスト配置", ""];
  for (const placement of evaluated.placementPlan?.placements ?? []) lines.push(`- ${placement.obligationId}: ${placement.primaryLayer} / ${placement.disposition}; tests: ${placement.selectedTestIds.join(", ") || "未配置"}`);
  lines.push("", "## 残存リスク・人間の確認", "", ...gate.residualRisks.map(id => `- risk: ${id}`), ...gate.requiredHumanReview.map(id => `- review: ${id}`),
    "", "## 証跡", "", ...evaluated.metadata.inputArtifacts.map(a => `- ${a.adapter}/${a.kind}: ${a.path} (${a.contentHash ?? "hash未指定"})`));
  lines.push(...executionSummary(gate.executionAccounting));
  return lines.join("\n") + "\n";
}

/** 自身のhashを内部へ含めないため、最後のmanifestがrecordも含めて封印する。 */
export function createRecordArtifacts(evaluated: EvaluatedFixture): { record: QualityEvidenceRecord; files: Map<string, string> } {
  const placementPlan = evaluated.placementPlan ?? { metadata: evaluated.metadata, obligations: [], placements: [] };
  const graph = appendEscapedDefectNodes(evaluated.graph, evaluated, placementPlan);
  const files = new Map<string, string>([
    ["qeg.bundle.json", jsonDocument(graph)], ["test-placement-plan.json", jsonDocument(placementPlan)],
    ["gate-verdict.json", jsonDocument(evaluated.gateResult)], ["quality-evidence-record.md", markdownSummary(evaluated)],
  ]);
  const efficacy = buildGateEfficacyRecords(evaluated);
  const proposals = buildRecalibrationProposalsForFixture(evaluated);
  const record: QualityEvidenceRecord = {
    metadata: evaluated.metadata, graph, placementPlan, gate: evaluated.gateResult,
    exports: [...files].map(([path, content]) => ({ kind: path.endsWith(".md") ? "markdown" : "json", path, contentHash: contentHash(content) })),
    auditTrail: auditTrail(evaluated.evidencePackage, evaluated.policy),
    ...(efficacy.length > 0 ? { gateEfficacyRecords: efficacy } : {}), ...(proposals.length > 0 ? { recalibrationProposals: proposals } : {}),
  };
  files.set("quality-evidence-record.json", jsonDocument(record));
  files.set("output-record.json", jsonDocument(record));
  files.set("output-manifest.json", jsonDocument({ manifestVersion: "qeg-output/v1", runId: evaluated.metadata.runId,
    files: [...files].map(([path, content]) => ({ path, contentHash: contentHash(content) })) }));
  return { record, files };
}
