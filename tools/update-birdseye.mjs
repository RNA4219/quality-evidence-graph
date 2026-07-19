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
  "src/types/evidence.ts": { role: "evidence-types", caps: "docs/birdseye/caps/src.types.evidence.ts.json" },
  "src/gate/test-evidence.ts": { role: "test-evidence-accounting", caps: "docs/birdseye/caps/src.gate.test-evidence.ts.json" },
  "src/gate/dq/placement-change.ts": { role: "placement-change-dq", caps: "docs/birdseye/caps/src.gate.dq.placement-change.ts.json" },
  "src/gate/evaluate.ts": { role: "gate-evaluator", caps: "docs/birdseye/caps/src.gate.evaluate.ts.json" },
  "src/gate/reliability.ts": { role: "reliability-evaluator", caps: "docs/birdseye/caps/src.gate.reliability.ts.json" },
  "src/cli/evidence-normalize.ts": { role: "resilience-evidence-normalize", caps: "docs/birdseye/caps/src.cli.evidence-normalize.ts.json" },
  "schemas/reliability.schema.json": { role: "reliability-schema", caps: "docs/birdseye/caps/schemas.reliability.schema.json.json" },
  "schemas/resilience-normalize-context.schema.json": { role: "resilience-normalize-context-schema", caps: "docs/birdseye/caps/schemas.resilience-normalize-context.schema.json.json" },
  "docs/spec/reliability-extension.md": {
    role: "reliability-resilience-spec",
    caps: "docs/birdseye/caps/docs.spec.reliability-extension.md.json",
    summary: "外部 producer の resilience evidence を QEG が検証、会計、Gate 判定するための discriminator、policy、DQ / blocker、report、fixture contract。",
    depsOut: [
      "schemas/qeg.bundle.schema.json",
      "schemas/gate-policy.schema.json",
      "schemas/shared-defs.schema.json",
      "schemas/reliability.schema.json",
      "schemas/resilience-normalize-context.schema.json",
      "docs/spec/operational-cli-extensions.md",
      "src/types/graph.ts",
      "src/types/gate.ts",
      "src/validation/evidence.ts",
      "src/gate/evaluate.ts",
      "src/gate/reliability.ts",
      "src/cli/evidence-normalize.ts",
    ],
    depsIn: ["docs/requirements.md", "docs/spec/index.md"],
    risks: ["実験 runner 化、mock の誤計上、revision / signal / safety の検証漏れ"],
    tests: ["npm run birdseye-check", "npm run schema-check", "npm run enum-check"],
  },
  "docs/spec/reliability-extension-review-2026-07-19.md": {
    role: "reliability-resilience-spec-review",
    caps: "docs/birdseye/caps/docs.spec.reliability-extension-review-2026-07-19.md.json",
    summary: "Reliability / Resilience 拡張仕様の解消済み finding、決定済み contract、残リスク、仕様 / 実装 / release Gate split。",
    depsOut: ["docs/spec/reliability-extension.md"],
    depsIn: ["docs/spec/index.md"],
    risks: ["仕様 review Go を implementation completion または release approval と誤認しない"],
    tests: ["npm run birdseye-check", "git diff --check"],
  },
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
    summary: node.summary ?? "QEG 0.2.0 fail-closed contract component.",
    deps_out: node.depsOut ?? [],
    deps_in: node.depsIn ?? [],
    risks: node.risks ?? ["型、schema、fixture、CLI契約を同時に更新する"],
    tests: node.tests ?? ["npm test"],
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
  ["docs/requirements.md", "docs/spec/reliability-extension.md"],
  ["docs/spec/index.md", "docs/spec/reliability-extension.md"],
  ["docs/spec/index.md", "docs/spec/reliability-extension-review-2026-07-19.md"],
  ["docs/spec/reliability-extension-review-2026-07-19.md", "docs/spec/reliability-extension.md"],
  ["docs/spec/reliability-extension.md", "schemas/qeg.bundle.schema.json"],
  ["docs/spec/reliability-extension.md", "schemas/gate-policy.schema.json"],
  ["docs/spec/reliability-extension.md", "schemas/shared-defs.schema.json"],
  ["docs/spec/reliability-extension.md", "schemas/reliability.schema.json"],
  ["docs/spec/reliability-extension.md", "schemas/resilience-normalize-context.schema.json"],
  ["docs/spec/reliability-extension.md", "docs/spec/operational-cli-extensions.md"],
  ["docs/spec/reliability-extension.md", "src/types/graph.ts"],
  ["docs/spec/reliability-extension.md", "src/types/gate.ts"],
  ["docs/spec/reliability-extension.md", "src/validation/evidence.ts"],
  ["docs/spec/reliability-extension.md", "src/gate/evaluate.ts"],
  ["docs/spec/reliability-extension.md", "src/gate/reliability.ts"],
  ["docs/spec/reliability-extension.md", "src/cli/evidence-normalize.ts"],
  ["src/types/graph.ts", "schemas/qeg.bundle.schema.json"],
  ["src/types/gate.ts", "schemas/gate-verdict.schema.json"],
  ["src/gate/evaluate.ts", "src/gate/test-evidence.ts"],
  ["src/gate/evaluate.ts", "src/gate/reliability.ts"],
  ["src/gate/reliability.ts", "src/validation/evidence.ts"],
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
