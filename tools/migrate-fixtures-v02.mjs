import { createHash } from "crypto";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import { join } from "path";

import { fileURLToPath } from "url";
const root = new URL("../fixtures/", import.meta.url);
const names = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const hash = (content) => `sha256:${createHash("sha256").update(content).digest("hex")}`;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sourceRef = (name, suffix) => ({ id: `qeg:sr-${name}-${suffix}`, path: "gate-input.json" });

function version(value) {
  if (Array.isArray(value)) return value.map(version);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) result[key] = key === "qegVersion" ? "0.2" : version(child);
  return result;
}
function traceability(node, name) {
  const existing = node.traceability ?? {};
  return {
    sourceRefs: existing.sourceRefs ?? node.sourceRefs ?? [sourceRef(name, String(node.id ?? "node").replace(/[^A-Za-z0-9-]/g, "-"))],
    assumptions: existing.assumptions ?? [],
    confidence: existing.confidence ?? "high",
  };
}
function normalizeNode(node, name, artifactIds) {
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
function normalizeEdge(edge, name) {
  return { ...edge, traceability: edge.traceability ?? { sourceRefs: [sourceRef(name, String(edge.id))], assumptions: [], confidence: "high" } };
}
function approval(value, input, name) {
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
function evidenceRef(value, name, index) {
  return {
    id: value.id ?? value.evidenceId ?? `qeg:evidence-${name}-${index}`,
    path: value.path ?? "gate-input.json",
    evidenceKind: value.evidenceKind ?? "human_review",
    ...(value.capturedAt ? { capturedAt: value.capturedAt } : {}),
  };
}
async function artifactFiles(dir, name) {
  const artifactDir = join(dir, "artifacts");
  await mkdir(artifactDir, { recursive: true });
  const specs = {
    input: { fixture: name, role: "input" },
    "qeg-bundle": { fixture: name, role: "qeg-bundle" },
    "test-placement-plan": { fixture: name, role: "test-placement-plan" },
    "gate-verdict": { fixture: name, role: "gate-verdict" },
    "quality-evidence-record": { fixture: name, role: "quality-evidence-record" },
  };
  const hashes = {};
  for (const [key, value] of Object.entries(specs)) {
    const content = json(value);
    await writeFile(join(artifactDir, `${key}.json`), content, "utf-8");
    hashes[key] = hash(content);
  }
  return hashes;
}
function artifact(old, fallbackId, path, contentHash, kind = "test_model") {
  return {
    id: old?.id ?? old?.artifactId ?? fallbackId,
    adapter: old?.adapter ?? "qeg-native",
    kind: old?.kind ?? kind,
    path,
    ...(old?.schemaId ? { schemaId: old.schemaId } : {}),
    contentHash,
    ...(old?.revision ? { revision: old.revision } : {}),
  };
}
function outputRefs(old = {}, name, hashes) {
  return {
    qegBundle: artifact(old.qegBundle, `qeg:bundle-${name}`, "artifacts/qeg-bundle.json", hashes["qeg-bundle"], "quality_evidence_record"),
    testPlacementPlan: artifact(old.testPlacementPlan, `qeg:placement-${name}`, "artifacts/test-placement-plan.json", hashes["test-placement-plan"]),
    gateVerdict: artifact(old.gateVerdict, `qeg:verdict-${name}`, "artifacts/gate-verdict.json", hashes["gate-verdict"], "gate_decision"),
    qualityEvidenceRecord: artifact(old.qualityEvidenceRecord, `qeg:record-${name}`, "artifacts/quality-evidence-record.json", hashes["quality-evidence-record"], "quality_evidence_record"),
  };
}

const manifest = [];
for (const name of names) {
  const dir = join(fileURLToPath(root), name);
  const inputPath = join(dir, "gate-input.json");
  let input = version(JSON.parse(await readFile(inputPath, "utf-8")));
  const hashes = await artifactFiles(dir, name);
  const oldInput = input.metadata.inputArtifacts?.[0];
  const inputArtifact = artifact(oldInput, `qeg:artifact-${name}`, "artifacts/input.json", hashes.input);
  input.metadata = { ...input.metadata, qegVersion: "0.2", inputArtifacts: [inputArtifact] };
  input.graph.metadata = { ...input.graph.metadata, qegVersion: "0.2", inputArtifacts: [inputArtifact] };
  input.graph.nodes = (input.graph.nodes ?? []).map((node) => normalizeNode(node, name, [inputArtifact.id]));
  input.graph.edges = (input.graph.edges ?? []).map((edge) => normalizeEdge(edge, name));
  if (input.placementPlan) input.placementPlan.metadata = { ...input.placementPlan.metadata, qegVersion: "0.2", inputArtifacts: [inputArtifact] };
  if (input.evidencePackage) {
    const oldHash = input.evidencePackage.inputArtifactHashes?.[0];
    const evidenceHash = name === "negative-evidence-hash-mismatch" ? `sha256:${"0".repeat(64)}` : hashes.input;
    input.evidencePackage.inputArtifactHashes = [artifact(oldHash, inputArtifact.id, "artifacts/input.json", evidenceHash)];
    input.evidencePackage.qegOutputs = outputRefs(input.evidencePackage.qegOutputs, name, hashes);
    input.evidencePackage.gatePolicy = input.evidencePackage.gatePolicy ?? input.policy;
    input.evidencePackage.waivers = input.evidencePackage.waivers ?? input.waivers ?? [];
    input.evidencePackage.approvalEvidence = (input.evidencePackage.approvalEvidence ?? []).map((item) => approval(item, input, name));
    input.evidencePackage.manualEvidence = (input.evidencePackage.manualEvidence ?? []).map((item) => ({
      executedCaseId: item.executedCaseId,
      result: item.result ?? item.status ?? "pass",
      expectedResult: typeof item.expectedResult === "string" ? item.expectedResult : "",
      oracleRefs: (item.oracleRefs ?? item.oracle_refs ?? []).map((value, index) => evidenceRef(value, name, `oracle-${index}`)),
      traceTo: item.traceTo ?? item.trace_to ?? [],
      evidenceRefs: (item.evidenceRefs ?? item.evidence_refs ?? []).map((value, index) => evidenceRef(value, name, index)),
      ...(item.reviewerNote ? { reviewerNote: item.reviewerNote } : {}),
    }));
  }
  await writeFile(inputPath, json(input), "utf-8");
  for (const file of ["output-record.json"]) {
    try {
      const path = join(dir, file);
      await writeFile(path, json(version(JSON.parse(await readFile(path, "utf-8")))), "utf-8");
    } catch {}
  }
  const expected = JSON.parse(await readFile(join(dir, "expected-gate-verdict.json"), "utf-8"));
  manifest.push({
    name,
    classification: name.startsWith("positive-") ? "positive" : "negative",
    expected: { verdict: expected.expectedVerdict, exitCode: expected.expectedExitCode, primaryDq: expected.expectedDisqualifications?.[0]?.code ?? null },
    snapshot: true,
  });
}
await writeFile(new URL("manifest.json", root), json({ manifestVersion: "qeg-fixtures-v2", fixtures: manifest }), "utf-8");
console.log(`Migrated ${names.length} fixtures to QEG 0.2`);
