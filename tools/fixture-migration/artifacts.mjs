import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { hash, json } from "./values.mjs";

export async function artifactFiles(dir, name) {
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

export function artifact(old, fallbackId, path, contentHash, kind = "test_model") {
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

export function outputRefs(old = {}, name, hashes) {
  return {
    qegBundle: artifact(old.qegBundle, `qeg:bundle-${name}`, "artifacts/qeg-bundle.json", hashes["qeg-bundle"], "quality_evidence_record"),
    testPlacementPlan: artifact(old.testPlacementPlan, `qeg:placement-${name}`, "artifacts/test-placement-plan.json", hashes["test-placement-plan"]),
    gateVerdict: artifact(old.gateVerdict, `qeg:verdict-${name}`, "artifacts/gate-verdict.json", hashes["gate-verdict"], "gate_decision"),
    qualityEvidenceRecord: artifact(old.qualityEvidenceRecord, `qeg:record-${name}`, "artifacts/quality-evidence-record.json", hashes["quality-evidence-record"], "quality_evidence_record"),
  };
}
