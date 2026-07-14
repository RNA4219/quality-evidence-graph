import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const generation = "00009";
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const hash = (value) => "sha256:" + createHash("sha256").update(String(value).replace(/\r\n/g, "\n")).digest("hex");
const indexPath = resolve(root, "docs/birdseye/index.json");
const index = JSON.parse(await readFile(indexPath, "utf-8"));

const additions = {
  "schemas/gate-input.schema.json": { role: "top-level-runtime-schema", caps: "docs/birdseye/caps/schemas.gate-input.schema.json.json" },
  "fixtures/manifest.json": { role: "fixture-manifest", caps: "docs/birdseye/caps/fixtures.manifest.json.json" },
  "src/validation.ts": { role: "public-validation-api", caps: "docs/birdseye/caps/src.validation.ts.json" },
  "src/validation/schema.ts": { role: "runtime-schema-validation", caps: "docs/birdseye/caps/src.validation.schema.ts.json" },
  "src/validation/evidence.ts": { role: "runtime-evidence-validation", caps: "docs/birdseye/caps/src.validation.evidence.ts.json" },
  "src/types/primitives.ts": { role: "primitive-types", caps: "docs/birdseye/caps/src.types.primitives.ts.json" },
  "src/types/graph.ts": { role: "graph-types", caps: "docs/birdseye/caps/src.types.graph.ts.json" },
  "src/types/gate.ts": { role: "gate-types", caps: "docs/birdseye/caps/src.types.gate.ts.json" },
  "src/gate/test-evidence.ts": { role: "test-evidence-accounting", caps: "docs/birdseye/caps/src.gate.test-evidence.ts.json" },
  "src/gate/dq/placement-change.ts": { role: "placement-change-dq", caps: "docs/birdseye/caps/src.gate.dq.placement-change.ts.json" },
  "src/gate/evaluate.ts": { role: "gate-evaluator", caps: "docs/birdseye/caps/src.gate.evaluate.ts.json" },
  "tests/runtime.test.mjs": { role: "runtime-contract-tests", caps: "docs/birdseye/caps/tests.runtime.test.mjs.json" },
  "src/cli/report/change-selection.ts": { role: "changed-target-selection", caps: "docs/birdseye/caps/src.cli.report.change-selection.ts.json" },
};
for (const name of ["model", "targets", "baseline-diff", "core", "formatter", "command"]) {
  const path = "src/cli/report/" + name + ".ts";
  additions[path] = { role: "report-" + name, caps: "docs/birdseye/caps/src.cli.report." + name + ".ts.json" };
}

index.generated_at = generation;
for (const [path, node] of Object.entries(additions)) {
  index.nodes[path] = { ...node, mtime: generation };
  const capsule = {
    id: path,
    role: node.role,
    generation,
    public_api: [],
    summary: "QEG 0.2.0 fail-closed contract component.",
    deps_out: [],
    deps_in: [],
    risks: ["型、schema、fixture、CLI契約を同時に更新する"],
    tests: ["npm test"],
  };
  await writeFile(resolve(root, node.caps), json(capsule));
}
for (const [sourcePath, node] of Object.entries(index.nodes)) {
  node.mtime = generation;
  const sourceHash = hash(await readFile(resolve(root, sourcePath), "utf-8"));
  node.contentHash = sourceHash;
  const capsulePath = resolve(root, node.caps);
  const capsule = JSON.parse(await readFile(capsulePath, "utf-8"));
  capsule.generation = generation;
  capsule.contentHash = sourceHash;
  await writeFile(capsulePath, json(capsule));
}
const newEdges = [
  ["docs/requirements.md", "src/types/graph.ts"],
  ["docs/requirements.md", "src/types/gate.ts"],
  ["docs/requirements.md", "src/gate/test-evidence.ts"],
  ["src/types/graph.ts", "schemas/qeg.bundle.schema.json"],
  ["src/types/gate.ts", "schemas/gate-verdict.schema.json"],
  ["src/gate/evaluate.ts", "src/gate/test-evidence.ts"],
  ["src/gate/dq/placement-change.ts", "src/gate/test-evidence.ts"],
  ["tests/runtime.test.mjs", "src/gate/test-evidence.ts"],
];
for (const edge of newEdges) {
  if (!index.edges.some((existing) => existing[0] === edge[0] && existing[1] === edge[1])) {
    index.edges.push(edge);
  }
}
await writeFile(indexPath, json(index));
console.log("Birdseye regenerated at generation " + generation);
