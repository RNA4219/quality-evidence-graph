import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const generation = "00012";
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const hash = (value) => "sha256:" + createHash("sha256").update(String(value).replace(/\r\n/g, "\n")).digest("hex");
const indexPath = resolve(root, "docs/birdseye/index.json");
const index = JSON.parse(await readFile(indexPath, "utf-8"));

const additions = {
  "docs/project/tasks.codex.md": {
    role: "superseded-implementation-task-ledger",
    caps: "docs/birdseye/caps/docs.project.tasks.codex.md.json",
    summary: "完了済みTASK-01〜TASK-10の実装順、対象、受入条件を保持する履歴台帳。現行判定はrepository completion acceptanceへ移管済み。",
    depsOut: ["docs/requirements.md", "docs/release/acceptance-2026-07-20.md"],
    depsIn: ["docs/agent/HUB.codex.md"],
    risks: ["superseded台帳の過去no_goを現在状態と誤認する"],
    tests: ["npm run birdseye-check", "git diff --check"],
  },
  "docs/project/evaluation.md": {
    role: "current-acceptance-criteria",
    caps: "docs/birdseye/caps/docs.project.evaluation.md.json",
    summary: "DQ-01〜DQ-21、provenance矛盾、53 fixture、package、隔離consumer、Node 20 / 24 CIを含む現行受入条件。",
    depsOut: ["docs/project/runbook.md", "docs/release/acceptance-2026-07-20.md", "fixtures/manifest.json"],
    depsIn: ["docs/agent/HUB.codex.md"],
    risks: ["acceptanceが古いとrepository completionを誤判定する"],
    tests: ["npm test", "npm run birdseye-check", "npm pack --dry-run --cache ./.npm-cache"],
  },
  "docs/ipo-controlled-profile.md": {
    role: "ipo-profile",
    caps: "docs/birdseye/caps/docs.ipo-controlled-profile.md.json",
    summary: "ipo_controlledのDQ-01〜DQ-21、waiver、approval evidence、retention、exit codeと、repository実装完成・外部release approval分離の契約。",
    depsOut: ["docs/requirements.md", "docs/spec/gate-policy.md", "docs/release/acceptance-2026-07-20.md"],
    depsIn: ["docs/agent/HUB.codex.md", "docs/control-mapping.md"],
    risks: ["repository completionを外部IPO統制承認へ自動昇格する"],
    tests: ["npm run schema-check", "npm run enum-check", "npm run birdseye-check"],
  },
  "docs/spec/gate-policy.md": {
    role: "ipo-gate-policy-spec",
    caps: "docs/birdseye/caps/docs.spec.gate-policy.md.json",
    summary: "ipo_controlledのGate policy、基本DQ-01〜DQ-17、reliability DQ-18〜DQ-21、exit code、verdict優先順位、waiver境界を固定する。",
    depsOut: ["docs/spec/index.md", "docs/ipo-controlled-profile.md", "docs/spec/reliability-extension.md"],
    depsIn: ["docs/spec/index.md", "docs/ipo-controlled-profile.md"],
    risks: ["DQ ownership drift、conditional_goをCI successとして扱う、waiverでDQを消す"],
    tests: ["npm run schema-check", "npm run enum-check", "npm run test:fixtures"],
  },
  "docs/spec/acceptance.md": {
    role: "superseded-spec-acceptance",
    caps: "docs/birdseye/caps/docs.spec.acceptance.md.json",
    summary: "2026-06-03時点の仕様書検収履歴。現行のrepository completionはproject evaluationと2026-07-20 acceptanceへ移管済み。",
    depsOut: ["docs/project/evaluation.md", "docs/release/acceptance-2026-07-20.md"],
    depsIn: ["docs/spec/index.md"],
    risks: ["過去no_goを現在状態と誤認する"],
    tests: ["npm run birdseye-check", "git diff --check"],
  },
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
  "src/gate/reliability/contracts.ts": { role: "reliability-stage-contracts", caps: "docs/birdseye/caps/src.gate.reliability.contracts.ts.json" },
  "src/gate/reliability/utils.ts": { role: "reliability-deterministic-utils", caps: "docs/birdseye/caps/src.gate.reliability.utils.ts.json" },
  "src/gate/reliability/indexing.ts": { role: "reliability-indexing-stage", caps: "docs/birdseye/caps/src.gate.reliability.indexing.ts.json" },
  "src/gate/reliability/selection.ts": { role: "reliability-selection-stage", caps: "docs/birdseye/caps/src.gate.reliability.selection.ts.json" },
  "src/gate/reliability/qualification.ts": { role: "reliability-qualification-stage", caps: "docs/birdseye/caps/src.gate.reliability.qualification.ts.json" },
  "src/gate/reliability/signals.ts": { role: "reliability-signal-stage", caps: "docs/birdseye/caps/src.gate.reliability.signals.ts.json" },
  "src/gate/reliability/blockers.ts": { role: "reliability-blocker-stage", caps: "docs/birdseye/caps/src.gate.reliability.blockers.ts.json" },
  "src/gate/reliability/accounting.ts": { role: "reliability-accounting-stage", caps: "docs/birdseye/caps/src.gate.reliability.accounting.ts.json" },
  "src/gate/reliability/evaluator.ts": { role: "reliability-stage-orchestrator", caps: "docs/birdseye/caps/src.gate.reliability.evaluator.ts.json" },
  "src/validation/reliability-semantics.ts": { role: "reliability-semantic-validator", caps: "docs/birdseye/caps/src.validation.reliability-semantics.ts.json" },
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
  "docs/spec/reliability-hardening.md": {
    role: "reliability-resilience-hardening-spec",
    caps: "docs/birdseye/caps/docs.spec.reliability-hardening.md.json",
    summary: "Reliability / Resilience 実装の DQ ownership、evaluator 分割、公開 union 型、negative fixture、normalizer 境界、CI 完了条件。",
    depsOut: [
      "docs/spec/reliability-extension.md",
      "docs/spec/reliability-hardening-checklist.md",
      "src/types/graph.ts",
      "src/gate/reliability.ts",
      "src/validation/schema.ts",
      "src/cli/evidence-normalize.ts",
      "fixtures/manifest.json",
      "tests/runtime.test.mjs",
    ],
    depsIn: ["docs/spec/index.md"],
    risks: ["refactor による判定 drift、legacy 型互換性の破壊、runtime test だけでの negative path 見逃し"],
    tests: ["npm run typecheck", "npm run test:runtime", "npm run test:fixtures", "npm run test:package", "npm run birdseye-check"],
  },
  "docs/spec/reliability-hardening-checklist.md": {
    role: "reliability-resilience-hardening-checklist",
    caps: "docs/birdseye/caps/docs.spec.reliability-hardening-checklist.md.json",
    summary: "Reliability / Resilience hardening の実装、fixture、local validation、Node 20 / 24 CI 証跡チェックリスト。",
    depsOut: ["docs/spec/reliability-extension.md", "docs/spec/reliability-hardening.md", "fixtures/manifest.json"],
    depsIn: ["docs/spec/index.md", "docs/spec/reliability-hardening.md"],
    risks: ["証跡なしの完了扱い、古い commit の CI 成功の流用、fixture を real acceptance と誤認する"],
    tests: ["npm run test:fixtures", "npm run birdseye-check", "git diff --check"],
  },
  "docs/spec/reliability-extension-review-2026-07-19.md": {
    role: "reliability-resilience-spec-review",
    caps: "docs/birdseye/caps/docs.spec.reliability-extension-review-2026-07-19.md.json",
    summary: "Reliability / Resilience 拡張の初期仕様レビュー履歴。現在の修正 contract と残作業は hardening 仕様・チェックリストへ移管済み。",
    depsOut: ["docs/spec/reliability-extension.md", "docs/spec/reliability-hardening.md"],
    depsIn: ["docs/spec/index.md"],
    risks: ["historical review の旧 DQ 分類や未実装記録を現在の正本と誤認しない"],
    tests: ["npm run birdseye-check", "git diff --check"],
  },
  "docs/release/acceptance-2026-07-20.md": {
    role: "repository-completion-acceptance",
    caps: "docs/birdseye/caps/docs.release.acceptance-2026-07-20.md.json",
    summary: "QEG repository completion、evidenced_by provenance closure、隔離consumer smoke、CI証跡、外部実環境とpublishの境界を記録する現行Gate。",
    depsOut: [
      "docs/requirements.md",
      "docs/project/evaluation.md",
      "docs/spec/reliability-hardening.md",
      "docs/spec/reliability-hardening-checklist.md",
      "fixtures/manifest.json",
    ],
    depsIn: ["README.md", "docs/agent/HUB.codex.md", "docs/project/blueprint.md"],
    risks: ["未完了CIをgoと誤認する、隔離consumer smokeを実環境acceptanceへ昇格する、既存v0.2.0 tagを再利用する"],
    tests: ["npm run test:fixtures", "npm run test:package", "npm run birdseye-check", "git diff --check"],
  },
  "tests/runtime.test.mjs": { role: "runtime-contract-tests", caps: "docs/birdseye/caps/tests.runtime.test.mjs.json" },
  "tests/fixture-regression.mjs": { role: "fixture-e2e-harness", caps: "docs/birdseye/caps/tests.fixture-regression.mjs.json" },
  "tests/package-smoke.mjs": { role: "package-and-packed-types-smoke", caps: "docs/birdseye/caps/tests.package-smoke.mjs.json" },
  "tests/type-contract/contract.ts": { role: "public-type-contract", caps: "docs/birdseye/caps/tests.type-contract.contract.ts.json" },
  "tools/json-check.mjs": { role: "tracked-json-parser", caps: "docs/birdseye/caps/tools.json-check.mjs.json" },
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
  ["docs/spec/index.md", "docs/spec/reliability-hardening.md"],
  ["docs/spec/index.md", "docs/spec/reliability-hardening-checklist.md"],
  ["docs/spec/index.md", "docs/spec/reliability-extension-review-2026-07-19.md"],
  ["docs/spec/reliability-hardening.md", "docs/spec/reliability-extension.md"],
  ["docs/spec/reliability-hardening.md", "docs/spec/reliability-hardening-checklist.md"],
  ["docs/spec/reliability-hardening.md", "src/types/graph.ts"],
  ["docs/spec/reliability-hardening.md", "src/gate/reliability.ts"],
  ["docs/spec/reliability-hardening.md", "src/validation/schema.ts"],
  ["docs/spec/reliability-hardening.md", "src/cli/evidence-normalize.ts"],
  ["docs/spec/reliability-hardening.md", "fixtures/manifest.json"],
  ["docs/spec/reliability-hardening.md", "tests/runtime.test.mjs"],
  ["docs/spec/reliability-hardening-checklist.md", "fixtures/manifest.json"],
  ["docs/spec/reliability-extension-review-2026-07-19.md", "docs/spec/reliability-extension.md"],
  ["docs/spec/reliability-extension-review-2026-07-19.md", "docs/spec/reliability-hardening.md"],
  ["README.md", "docs/release/acceptance-2026-07-20.md"],
  ["docs/agent/HUB.codex.md", "docs/release/acceptance-2026-07-20.md"],
  ["docs/project/blueprint.md", "docs/release/acceptance-2026-07-20.md"],
  ["docs/project/evaluation.md", "docs/release/acceptance-2026-07-20.md"],
  ["docs/release/acceptance-2026-07-20.md", "docs/requirements.md"],
  ["docs/release/acceptance-2026-07-20.md", "docs/spec/reliability-hardening.md"],
  ["docs/release/acceptance-2026-07-20.md", "fixtures/manifest.json"],
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
  ["src/gate/reliability.ts", "src/gate/reliability/evaluator.ts"],
  ["src/gate/reliability/evaluator.ts", "src/gate/reliability/indexing.ts"],
  ["src/gate/reliability/evaluator.ts", "src/gate/reliability/selection.ts"],
  ["src/gate/reliability/evaluator.ts", "src/gate/reliability/qualification.ts"],
  ["src/gate/reliability/evaluator.ts", "src/gate/reliability/blockers.ts"],
  ["src/gate/reliability/evaluator.ts", "src/gate/reliability/accounting.ts"],
  ["src/gate/reliability/qualification.ts", "src/gate/reliability/signals.ts"],
  ["src/gate/reliability/qualification.ts", "src/validation/reliability-semantics.ts"],
  ["src/validation/schema.ts", "src/validation/reliability-semantics.ts"],
  ["tests/fixture-regression.mjs", "fixtures/manifest.json"],
  ["tests/type-contract/contract.ts", "src/types/graph.ts"],
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
