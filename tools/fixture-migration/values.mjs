import { createHash } from "crypto";

export const hash = (content) => `sha256:${createHash("sha256").update(content).digest("hex")}`;

export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export const sourceRef = (name, suffix) => ({ id: `qeg:sr-${name}-${suffix}`, path: "gate-input.json" });


export function version(value) {
  if (Array.isArray(value)) return value.map(version);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) result[key] = key === "qegVersion" ? "0.2" : version(child);
  return result;
}

export function traceability(node, name) {
  const existing = node.traceability ?? {};
  return {
    sourceRefs: existing.sourceRefs ?? node.sourceRefs ?? [sourceRef(name, String(node.id ?? "node").replace(/[^A-Za-z0-9-]/g, "-"))],
    assumptions: existing.assumptions ?? [],
    confidence: existing.confidence ?? "high",
  };
}

export function normalizeNode(node, name, artifactIds) {
  const kind = node.kind === "claim" ? "requirement" : node.kind;
  return {
    ...node,
    kind,
    title: node.title ?? node.label ?? String(node.id),
    traceability: traceability(node, name),
    sourceArtifactIds: node.sourceArtifactIds ?? artifactIds,
    ...(node.severity === "major" ? { severity: "high" } : node.severity === "minor" ? { severity: "low" } : {}),
    ...(kind === "requirement" && !node.acceptanceCriteriaIds ? { acceptanceCriteriaIds: [] } : {}),
  };
}

export function normalizeEdge(edge, name) {
  return { ...edge, traceability: edge.traceability ?? { sourceRefs: [sourceRef(name, String(edge.id))], assumptions: [], confidence: "high" } };
}

export function approval(value, input, name) {
  return {
    id: value.id ?? `qeg:approval-${name}`,
    approver: value.approver ?? value.approvedBy ?? "release-approver",
    roleOrAuthority: value.roleOrAuthority ?? "release-approver",
    approvedDecision: value.approvedDecision ?? "go",
    approvedAt: value.approvedAt ?? input.metadata.createdAt,
    policyId: value.policyId ?? input.policy.policyId,
    policyHash: value.policyHash ?? input.policy.policyHash,
    sourceRefs: value.sourceRefs ?? [sourceRef(name, "approval")],
    evidencePackageHash: value.evidencePackageHash ?? input.evidencePackage.evidencePackageHash,
  };
}

export function evidenceRef(value, name, index) {
  return {
    id: value.id ?? value.evidenceId ?? `qeg:evidence-${name}-${index}`,
    path: value.path ?? "gate-input.json",
    evidenceKind: value.evidenceKind ?? "human_review",
    ...(value.capturedAt ? { capturedAt: value.capturedAt } : {}),
  };
}
