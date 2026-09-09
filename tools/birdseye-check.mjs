import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf-8"));
const hash = (value) => "sha256:" + createHash("sha256").update(String(value).replace(/\r\n/g, "\n")).digest("hex");
const index = await readJson("docs/birdseye/index.json");

assert.match(index.generated_at, /^\d{5}$/, "generated_at must be a five-digit generation");
assert.ok(index.nodes && typeof index.nodes === "object", "nodes are required");

const requiredNodes = [
  "README.md", "README_JA.md", "README_EN.md",
  ".github/workflows/ci.yml", "qeg-report-action/action.yml",
  "src/cli/report.ts", "src/cli/report/model.ts", "src/cli/report/targets.ts",
  "src/cli/report/baseline-diff.ts", "src/cli/report/core.ts",
  "src/cli/report/formatter.ts", "src/cli/report/command.ts",
  "schemas/gate-input.schema.json", "fixtures/manifest.json",
  "src/record.ts", "src/cli/fixture-io.ts", "src/graph.ts", "src/placement.ts", "src/types/ingest.ts",
  "src/adapters/producer-schemas.json", "src/cli/raw-ingest.ts", "src/gate/dq/graph-integrity.ts",
  "docs/project/remediation-2026-09-10.md", "docs/spec/remediation-2026-09-10.md", "docs/spec/producer-adapters.md",
  "tests/remediation-gate.test.mjs", "tests/producer-pipeline.test.mjs",
];

for (const path of requiredNodes) assert.ok(index.nodes[path], "Birdseye node missing: " + path);
for (const [path, node] of Object.entries(index.nodes)) {
  await access(resolve(root, path));
  const sourceHash = hash(await readFile(resolve(root, path), "utf-8"));
  assert.equal(node.mtime, index.generated_at, "stale node generation: " + path);
  assert.equal(node.contentHash, sourceHash, "stale node content hash: " + path);
  assert.ok(node.caps, "capsule path missing: " + path);
  const capsule = await readJson(node.caps);
  assert.equal(capsule.id, path, "capsule ID mismatch: " + path);
  assert.equal(capsule.generation, index.generated_at, "stale capsule: " + node.caps);
  assert.equal(capsule.contentHash, sourceHash, "stale capsule content hash: " + node.caps);
}
// The index cannot contain its own content hash; it is the single structural root.
const resolved = path => path === "docs/birdseye/index.json" || Boolean(index.nodes[path]);
for (const [from, to] of index.edges) assert.ok(resolved(from) && resolved(to), `Unresolved edge: ${from} -> ${to}`);
console.log("Birdseye generation " + index.generated_at + ": " + Object.keys(index.nodes).length + " source hashes verified");
