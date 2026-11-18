import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { contentHash as hash, root, runtimeFiles } from "./update-birdseye.mjs";
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf-8"));
const index = await readJson("docs/birdseye/index.json");

assert.match(index.generated_at, /^\d{5}$/, "generated_at must be a five-digit generation");
assert.ok(index.nodes && typeof index.nodes === "object", "nodes are required");

const requiredNodes = [
  "README.md", "README_JA.md", "README_EN.md",
  ".github/workflows/ci.yml", "qeg-report-action/action.yml",
  ...await runtimeFiles(),
  "schemas/gate-input.schema.json", "fixtures/manifest.json",
  "src-rust/record.rs", "src-rust/runtime.rs", "src-rust/graph.rs", "src-rust/graph/placement.rs", "src/types/ingest.ts",
  "src/adapters/producer-schemas.json", "src-rust/graph/ingest.rs", "src-rust/gate/integrity.rs",
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
  const incoming = index.edges.filter(([,to]) => to === path).map(([from]) => from).sort();
  const outgoing = index.edges.filter(([from]) => from === path).map(([,to]) => to).sort();
  assert.deepEqual(capsule.deps_in, incoming, "stale incoming edges: " + path);
  assert.deepEqual(capsule.deps_out, outgoing, "stale outgoing edges: " + path);
  assert.deepEqual(node.depsOut, outgoing, "stale node edges: " + path);
}
// The index cannot contain its own content hash; it is the single structural root.
const resolved = path => path === "docs/birdseye/index.json" || Boolean(index.nodes[path]);
for (const [from, to] of index.edges) assert.ok(resolved(from) && resolved(to), `Unresolved edge: ${from} -> ${to}`);
console.log("Birdseye generation " + index.generated_at + ": " + Object.keys(index.nodes).length + " source hashes verified");
