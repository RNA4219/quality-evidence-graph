import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { evaluateGate, publishFiles, readPublishedOutputs, verifyEvidenceArtifacts } from "@quality-harness/quality-evidence-graph";

for (const [name, verdict] of [["positive-release-go", "go"], ["negative-manual-result-fail", "no_go"]]) {
  const baseDir = join(process.argv[2], "fixtures", name);
  const input = JSON.parse(await readFile(join(baseDir, "gate-input.json"), "utf8"));
  const evidenceVerification = await verifyEvidenceArtifacts(input, { baseDir });
  const verified = { ...input, evidenceVerification };
  const first = evaluateGate(verified);
  assert.equal(first.verdict, verdict);
  assert.deepEqual(evaluateGate(verified), first);
}

const directory = await mkdtemp(join(process.cwd(), "publication-"));
const files = new Map([["sample.json", "{}\n"]]);
let checkedLease = false;
await publishFiles(directory, files, { onBoundary: async point => {
  if (point === "prepared") {
    await assert.rejects(readPublishedOutputs(directory), /busy|lease/);
    checkedLease = true;
  }
} });
assert.ok(checkedLease);
assert.deepEqual((await readPublishedOutputs(directory)).files, files);
