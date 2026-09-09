import { readFile, readdir, writeFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { artifact, artifactFiles, outputRefs } from "./fixture-migration/artifacts.mjs";
import { approval, evidenceRef, json, normalizeEdge, normalizeNode, version } from "./fixture-migration/values.mjs";

const root = new URL("../fixtures/", import.meta.url);

const names = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();


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
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error(`Read/migrate ${join(dir, file)}: ${error.message}`, { cause: error });
    }
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
