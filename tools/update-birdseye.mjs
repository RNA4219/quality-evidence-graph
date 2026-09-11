import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { posix, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const generation = "00024";
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const hash = (value) => "sha256:" + createHash("sha256").update(String(value).replace(/\r\n/g, "\n")).digest("hex");
const indexPath = resolve(root, "docs/birdseye/index.json");
const index = JSON.parse(await readFile(indexPath, "utf-8"));

const additions = {
  "docs/release/acceptance-2026-07-20.md": {
    role: "superseded-v0.3.0-release-acceptance",
    caps: "docs/birdseye/caps/docs.release.acceptance-2026-07-20.md.json",
    summary: "v0.3.0 repository completionとnpm公開を含む過去判定。npm公開は完了せず、現行配布契約はGitHub-only v0.3.1へ移管済み。",
    depsOut: ["docs/release/acceptance-2026-07-20-v0.3.1.md"],
    risks: ["supersededなnpm公開承認を現行判定と誤認する"],
    tests: ["npm run birdseye-check"],
  },
  "docs/release-notes/2026-07-20-v0.3.0.md": {
    role: "superseded-v0.3.0-release-notes",
    caps: "docs/birdseye/caps/docs.release-notes.2026-07-20-v0.3.0.md.json",
    summary: "npm package未公開のv0.3.0履歴。GitHub-only Action配布はv0.3.1へ移管済み。",
    depsOut: ["docs/release-notes/2026-07-20-v0.3.1.md"],
    risks: ["v0.3.0のnpm利用例を現行手順として実行する"],
    tests: ["npm run birdseye-check"],
  },
  "schemas/action-lifecycle-evidence.schema.json": {
    role: "action-release-lifecycle-evidence-schema",
    caps: "docs/birdseye/caps/schemas.action-lifecycle-evidence.schema.json.json",
    summary: "変更、リスク、テスト、隔離デプロイ、観測、障害、復旧、新しい証拠をstrictに検証するv0.3.1 release evidence schema。",
    depsOut: ["tools/action-lifecycle-acceptance.mjs"],
    tests: ["npm run schema-check", "npm run test:release-lifecycle"],
  },
  "tools/action-lifecycle-acceptance.mjs": {
    role: "action-release-lifecycle-acceptance-harness",
    caps: "docs/birdseye/caps/tools.action-lifecycle-acceptance.mjs.json",
    summary: "tag同梱bundleを隔離配置し、steady state、schema破損、復旧、hash付き新規証拠生成までを実行するharness。",
    depsOut: ["qeg-report-action/action.yml", "schemas/action-lifecycle-evidence.schema.json"],
    risks: ["fixture成功を実cluster resilienceへ昇格する、復旧後に古い証拠を再利用する"],
    tests: ["npm run test:release-lifecycle"],
  },
  "qeg-report-action/THIRD_PARTY_NOTICES.md": {
    role: "action-bundle-third-party-notices",
    caps: "docs/birdseye/caps/qeg-report-action.THIRD_PARTY_NOTICES.md.json",
    summary: "Action bundleへ含まれるruntime dependencyと同梱license原文の索引。",
    depsOut: ["qeg-report-action/dist/cli.mjs"],
    tests: ["npm run test:package"],
  },
  "docs/spec/code-to-gate-v0.3.1-2026-07-20/analysis-report.md": {
    role: "v0.3.1-static-analysis-evidence",
    caps: "docs/birdseye/caps/docs.spec.code-to-gate-v0.3.1-2026-07-20.analysis-report.md.json",
    summary: "v0.3.1のraw静的候補13件（high 1 / medium 12）、accepted-design 1件、effective medium 12件の履歴。",
    depsOut: ["docs/spec/code-to-gate-v0.3.1-2026-07-20/release-readiness.json"],
    tests: ["code-to-gate readiness", "npm test"],
  },
  "docs/spec/code-to-gate-v0.3.1-2026-07-20/release-readiness.json": {
    role: "v0.3.1-static-readiness-evidence",
    caps: "docs/birdseye/caps/docs.spec.code-to-gate-v0.3.1-2026-07-20.release-readiness.json.json",
    summary: "ci-release-readiness policyのfailed conditions 0とpassedを記録するmachine-readable証拠。",
    depsOut: ["docs/release/acceptance-2026-07-20-v0.3.1.md"],
    tests: ["code-to-gate schema validate", "npm run json-check"],
  },
  "docs/project/tasks.codex.md": {
    role: "superseded-implementation-task-ledger",
    caps: "docs/birdseye/caps/docs.project.tasks.codex.md.json",
    summary: "TASK-01〜TASK-10の過去台帳。生成機能が当時未充足だった完了表記を訂正し、現行状態は改修台帳へ移管。",
    depsOut: ["docs/requirements.md", "docs/project/remediation-2026-09-10.md"],
    depsIn: ["docs/agent/HUB.codex.md"],
    risks: ["superseded台帳の過去no_goを現在状態と誤認する"],
    tests: ["npm run birdseye-check", "git diff --check"],
  },
  "docs/project/evaluation.md": {
    role: "current-acceptance-criteria",
    caps: "docs/birdseye/caps/docs.project.evaluation.md.json",
    summary: "DQ-01〜DQ-21、provenance矛盾、53 fixture、package、隔離consumer、Linux Node 20 / 24とWindows Node 24 CIを含む現行受入条件。",
    depsOut: ["docs/project/runbook.md", "docs/release/acceptance-2026-07-20-v0.3.1.md", "fixtures/manifest.json"],
    depsIn: ["docs/agent/HUB.codex.md"],
    risks: ["acceptanceが古いとrepository completionを誤判定する"],
    tests: ["npm test", "npm run birdseye-check", "npm pack --dry-run --cache ./.npm-cache"],
  },
  "docs/ipo-controlled-profile.md": {
    role: "ipo-profile",
    caps: "docs/birdseye/caps/docs.ipo-controlled-profile.md.json",
    summary: "ipo_controlledのDQ-01〜DQ-21、waiver、approval evidence、retention、exit codeと、repository実装完成・外部release approval分離の契約。",
    depsOut: ["docs/requirements.md", "docs/spec/gate-policy.md", "docs/release/acceptance-2026-07-20-v0.3.1.md"],
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
    depsOut: ["docs/project/evaluation.md", "docs/release/acceptance-2026-07-20-v0.3.1.md"],
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
  "docs/release/acceptance-2026-07-20-v0.3.1.md": {
    role: "v0.3.1-github-only-release-acceptance",
    caps: "docs/birdseye/caps/docs.release.acceptance-2026-07-20-v0.3.1.md.json",
    summary: "QEG v0.3.1のGitHub-only配布、Action bundle、隔離schema障害・復旧、CI証跡の過去受入。現行改修の完了証拠には転用しない。",
    depsOut: [
      "docs/requirements.md",
      "docs/project/evaluation.md",
      "docs/spec/reliability-hardening.md",
      "docs/spec/reliability-hardening-checklist.md",
      "fixtures/manifest.json",
    ],
    depsIn: ["README.md", "docs/agent/HUB.codex.md", "docs/project/blueprint.md"],
    risks: ["未完了CIをgoと誤認する、隔離consumer smokeを実環境acceptanceへ昇格する、package versionとqegVersionを混同する"],
    tests: ["npm run test:fixtures", "npm run test:package", "npm run birdseye-check", "git diff --check"],
  },
  "docs/release-notes/2026-07-20-v0.3.1.md": {
    role: "v0.3.1-release-notes",
    caps: "docs/birdseye/caps/docs.release-notes.2026-07-20-v0.3.1.md.json",
    summary: "QEG 0.3.1のGitHub-only Action bundle、release lifecycle evidence、互換境界を記録するrelease notes。",
    depsOut: ["CHANGELOG.md", "docs/release/acceptance-2026-07-20-v0.3.1.md", "qeg-report-action/action.yml"],
    depsIn: ["README.md", "docs/project/runbook.md"],
    risks: ["package versionとqegVersionの混同、tag・GitHub Release・bundle sourceの不一致"],
    tests: ["npm run test:package", "npm run test:runtime", "npm run birdseye-check"],
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

// Runtime additions must not silently disappear from context coverage.
async function sourceFiles(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.isFile() && /\.(ts|json|mjs)$/.test(path)) files.push(path);
  }
  return files;
}
const currentPaths = [
  "docs/release-notes/2026-09-12-v0.4.1.md", "tests/action-contract.test.mjs",
  "docs/project/manual-governance-fixes-2026-09-11.md", "docs/spec/manual-evidence-and-review.md", "docs/evidence/manual-governance-fixes-2026-09-11/validation.json",
  "tests/manual-governance-regression.test.mjs", "tests/helpers/manual-governance-matrix.mjs",
  "docs/project/governance-fixes-2026-09-11.md", "docs/spec/governance-consistency.md", "docs/evidence/governance-fixes-2026-09-11/validation.json",
  "tests/governance-regression.test.mjs", "tests/helpers/governance-matrix.mjs",
  "docs/project/gate-contract-fixes-2026-09-11.md", "docs/spec/gate-contract-consistency.md", "docs/evidence/gate-contract-fixes-2026-09-11/validation.json",
  "tests/gate-contract-regression.test.mjs", "tests/helpers/gate-contract-matrix.mjs",
  "docs/project/cli-boundary-fixes-2026-09-11.md", "docs/evidence/cli-boundary-fixes-2026-09-11/validation.json",
  "src/cli/path-key.ts", "src/cli/report/baseline-contract.ts", "src/cli/distribution.ts", "src/cli/enum-contracts.json",
  "schemas/report-baseline.schema.json", "qeg-report-action/runtime-metadata.json", "tests/cli-boundary-regression.test.mjs", "tests/helpers/cli-boundary-matrix.mjs",
  "docs/project/followup-fixes-2026-09-11.md", "docs/evidence/followup-fixes-2026-09-11/validation.json", "tests/followup-regression.test.mjs",
  "docs/project/review-fixes-2026-09-11.md", "docs/evidence/review-fixes-2026-09-11/validation.json",
  "tests/transaction-regression.test.mjs", "tests/helpers/command-transaction-child.mjs",
  "docs/spec/output-publication-and-migration.md", "docs/evidence/eac-completion-2026-09-10/validation.json",
  "tests/output-publication.test.mjs", "tests/consumer-migration.test.mjs", "tests/producer-replay.test.mjs", "tests/helpers/publication-child.mjs",
  "tools/build-action.mjs", "tools/interop/live-producers.mjs", "tools/interop/provenance.mjs", "tools/interop/producer-lock.json", "tools/interop/producer-bridge.py",
  ...await sourceFiles("src"), ...await sourceFiles("schemas"),
  "docs/project/remediation-2026-09-10.md", "docs/spec/remediation-2026-09-10.md",
  "docs/spec/producer-adapters.md", "docs/spec/producer-schema-provenance.json",
  "docs/evidence/remediation-2026-09-10/local-validation.json",
  "docs/evidence/remediation-2026-09-10/audit-validation.json", "docs/project/acceptance-audit-2026-09-10.md",
  "docs/evidence/remediation-2026-09-10/ci-validation.json",
  "docs/spec/evidence-acceptance-standard.md", "docs/project/evidence-acceptance-status.md",
  "docs/evidence/evidence-acceptance-2026-09-10/baseline-observations.json",
  "docs/evidence/evidence-acceptance-2026-09-10/validation.json", "docs/evidence/evidence-acceptance-2026-09-10/execution-results.json",
  "docs/spec/execution-qualification.md", "tests/execution-qualification.test.mjs", "tests/helpers/execution-fixture.mjs", "tools/migrate-execution-fixtures.mjs",
  "examples/raw-producer-contract/README.md", "examples/raw-producer-contract/ingest-manifest.json",
  "tests/remediation-gate.test.mjs", "tests/producer-pipeline.test.mjs", "tests/helpers/raw-producer-fixture.mjs",
  "tools/snapshot-producer-contracts.mjs", "tools/migrate-input-contracts.mjs", "tools/migrate-retired-case-fixtures.mjs",
  "tools/migrate-fixtures-v02.mjs", "tools/fixture-migration/values.mjs", "tools/fixture-migration/artifacts.mjs",
  "tools/update-birdseye.mjs", "tools/birdseye-check.mjs",
];
for (const path of currentPaths) {
  const old = additions[path] ?? index.nodes[path];
  additions[path] = { ...old, role: old?.role ?? posix.basename(path).replace(/\.(ts|mjs|json|md)$/, ""),
    caps: old?.caps ?? `docs/birdseye/caps/${path.replaceAll("/", ".")}.json` };
}
Object.assign(additions["docs/project/remediation-2026-09-10.md"], {
  summary: "R01〜R06 / FIX-01〜20の現行実装・受入台帳。fixture、隔離consumer、CI、実環境未評価を分離。",
  depsOut: ["docs/requirements.md", "docs/spec/remediation-2026-09-10.md", "docs/spec/producer-adapters.md", "docs/evidence/remediation-2026-09-10/local-validation.json", "docs/evidence/remediation-2026-09-10/ci-validation.json", "docs/project/acceptance-audit-2026-09-10.md", "tests/remediation-gate.test.mjs", "tests/producer-pipeline.test.mjs"],
});
Object.assign(additions["docs/spec/remediation-2026-09-10.md"], {
  summary: "明示入力、参照整合、raw生成、7層配置、出力schema/hash、診断、互換性の0.4.0仕様。",
  depsOut: ["src/input-contract.ts", "src/graph.ts", "src/placement.ts", "src/record.ts", "src/cli/pipeline.ts", "src/gate/dq/graph-integrity.ts"],
});
Object.assign(additions["docs/project/acceptance-audit-2026-09-10.md"], {
  summary: "FIX-01〜20の実装・直接検証・scopeの照合。実行必須、I/O診断、出力保護の追加修正と3 jobのCI成功を記録。",
  depsOut: ["docs/requirements.md", "docs/evidence/remediation-2026-09-10/audit-validation.json", "docs/evidence/remediation-2026-09-10/ci-validation.json", "src/gate/dq/placement-coverage.ts", "src/gate/dq/graph-integrity.ts", "src/validation/evidence.ts", "tests/remediation-gate.test.mjs"],
});
Object.assign(additions["docs/evidence/remediation-2026-09-10/ci-validation.json"], {
  summary: "実装commit 216cd2fのLinux Node 20 / 24とWindows Node 24 CI成功をrun・job URL付きで保存。最終記録commitはPR checksで外部確認する。",
  depsOut: ["docs/evidence/remediation-2026-09-10/audit-validation.json"],
});
Object.assign(additions["docs/spec/producer-adapters.md"], {
  summary: "3 producerの14 artifactについてraw形式、写像、固定schema、revision/hash/licenseの境界を定義。",
  depsOut: ["src/adapters/producer-schemas.json", "docs/spec/producer-schema-provenance.json", "src/adapters/rand.ts", "src/adapters/code-to-gate.ts", "src/adapters/manual-bb.ts"],
});
Object.assign(additions["docs/spec/evidence-acceptance-standard.md"], {
  role: "defined-evidence-acceptance-standard",
  summary: "EAC-01〜12の対象・時計・最新実行・出力復旧・実接続・移行基準と25群の受入ケース。状態は受入単位ごとに台帳で管理。",
  depsOut: ["docs/requirements.md", "docs/project/evidence-acceptance-status.md", "src/adapters/manual-bb.ts", "src/gate/dq/placement-coverage.ts", "src/cli/output-files.ts", "docs/spec/reliability-extension.md"],
  risks: ["基準策定を実装完了や全ケース実行済みと誤認する"],
  tests: ["npm run birdseye-check", "文書のEAC/TC対応・リンク確認"],
});
Object.assign(additions["docs/project/evidence-acceptance-status.md"], {
  role: "evidence-acceptance-ledger",
  summary: "EAC-01〜12とCLI境界の実装・受入台帳。R8〜R13の共通matrixとsource CIを対応付け、旧受入と実producer原本を履歴として保持。",
  depsOut: ["docs/spec/evidence-acceptance-standard.md", "docs/spec/output-publication-and-migration.md", "docs/project/review-fixes-2026-09-11.md", "docs/evidence/review-fixes-2026-09-11/validation.json", "docs/evidence/eac-completion-2026-09-10/validation.json", "docs/spec/execution-qualification.md", "tests/execution-qualification.test.mjs", "docs/project/remediation-2026-09-10.md", "docs/evidence/evidence-acceptance-2026-09-10/validation.json"],
  tests: ["npm run birdseye-check", "npm run json-check"],
});
Object.assign(additions["docs/project/review-fixes-2026-09-11.md"], {
  summary: "R1〜R4の再現、全command排他、入力rollback、preview整合、manifest bindingの修正と追加受入。",
  depsOut: ["docs/evidence/review-fixes-2026-09-11/validation.json", "tests/transaction-regression.test.mjs", "src/output-transaction.ts", "src/output-publication.ts", "src/consumer-migration.ts", "src/graph.ts"],
});
additions["docs/project/evidence-acceptance-status.md"].depsOut.push("docs/project/followup-fixes-2026-09-11.md", "docs/evidence/followup-fixes-2026-09-11/validation.json");
additions["docs/project/evidence-acceptance-status.md"].depsOut.push("docs/project/cli-boundary-fixes-2026-09-11.md", "docs/evidence/cli-boundary-fixes-2026-09-11/validation.json");
Object.assign(additions["docs/project/cli-boundary-fixes-2026-09-11.md"], {
  summary: "R8〜R13のpath/discovery/baseline/diff/配布診断を共通matrixで修正・検証し、source CIへ結び付ける受入単位。",
  depsOut: ["docs/evidence/cli-boundary-fixes-2026-09-11/validation.json", "tests/cli-boundary-regression.test.mjs", "tests/helpers/cli-boundary-matrix.mjs", "src/cli/report/change-selection.ts", "src/cli/report/targets.ts", "src/cli/report/baseline-contract.ts", "src/cli/report/baseline-diff.ts", "src/cli/distribution.ts", "schemas/report-baseline.schema.json", "docs/spec/operational-cli-extensions.md"],
});
Object.assign(additions["docs/project/followup-fixes-2026-09-11.md"], {
  summary: "R5〜R7の差分検査・native編集保護・診断bundle保存を一括修正し、操作順の組合せと実行証拠で受入を管理。",
  depsOut: ["docs/evidence/followup-fixes-2026-09-11/validation.json", "tests/followup-regression.test.mjs", "src/output-publication.ts", "src/cli/report/change-selection.ts", "src/cli/repro-bundle.ts", "docs/spec/operational-cli-extensions.md"],
});
Object.assign(additions["docs/evidence/evidence-acceptance-2026-09-10/baseline-observations.json"], {
  role: "pre-standard-observation-evidence",
  summary: "4054df7での正常対照・別build・未来実行・fail後passの4観測。基準制定前の合成fixture証跡であり新基準の合格記録ではない。",
  depsOut: ["tests/helpers/raw-producer-fixture.mjs", "src/adapters/manual-bb.ts", "src/gate/dq/placement-coverage.ts"],
  tests: ["npm run json-check"],
});
for (const path of ["README.md", "docs/agent/HUB.codex.md", "docs/requirements.md", "docs/spec/index.md", "docs/project/evaluation.md", "docs/project/blueprint.md", "docs/project/remediation-2026-09-10.md"]) {
  const previous = additions[path] ?? index.nodes[path];
  additions[path] = { ...previous, depsOut: [...new Set([...(previous.depsOut ?? []), "docs/spec/evidence-acceptance-standard.md", "docs/project/evidence-acceptance-status.md"])] };
}
additions["docs/project/remediation-2026-09-10.md"].summary = "R01〜R06の過去受入範囲と追加EAC要求の未完了状態を区別する台帳。fixture・隔離consumer・CIの証拠を保持。";
additions["docs/project/evidence-acceptance-status.md"].depsOut.push("docs/project/gate-contract-fixes-2026-09-11.md", "docs/evidence/gate-contract-fixes-2026-09-11/validation.json");
Object.assign(additions["docs/project/gate-contract-fixes-2026-09-11.md"], {
  summary: "R14〜R19の配置coverage・手動oracle・raw status・waiver・snapshotをまとめて修正し、共通matrixとsource CIで受入を管理。",
  depsOut: ["docs/spec/gate-contract-consistency.md", "docs/evidence/gate-contract-fixes-2026-09-11/validation.json", "tests/gate-contract-regression.test.mjs", "tests/helpers/gate-contract-matrix.mjs", "src/placement-contract.ts", "src/cli/snapshot.ts", "src/cli/evidence-normalize/values.ts", "schemas/waiver.schema.json"],
});
Object.assign(additions["docs/spec/gate-contract-consistency.md"], {
  depsOut: ["docs/requirements.md", "src/placement-contract.ts", "src/gate/dq/placement-coverage.ts", "src/gate/dq/placement-change.ts", "src/gate/verdict/human-review.ts", "src/gate/waivers.ts", "src/cli/evidence-normalize/values.ts", "src/cli/snapshot.ts", "schemas/waiver.schema.json", "tests/helpers/gate-contract-matrix.mjs"],
});
for (const path of ["README.md", "docs/agent/HUB.codex.md", "docs/project/blueprint.md", "docs/requirements.md", "docs/spec/index.md"]) {
  const previous = additions[path] ?? index.nodes[path];
  additions[path] = { ...previous, depsOut: [...new Set([...(previous.depsOut ?? []), "docs/spec/gate-contract-consistency.md", "docs/project/gate-contract-fixes-2026-09-11.md"])] };
}
Object.assign(additions["docs/project/governance-fixes-2026-09-11.md"], {
  summary: "R20〜R24の配置実体・引退・厳密な時刻・IPO役割・保管方式を共通matrixで検証する受入台帳。",
  depsOut: ["docs/spec/governance-consistency.md", "docs/evidence/governance-fixes-2026-09-11/validation.json", "tests/governance-regression.test.mjs", "tests/helpers/governance-matrix.mjs"],
});
Object.assign(additions["docs/spec/governance-consistency.md"], {
  depsOut: ["docs/requirements.md", "src/gate/dq/graph-integrity.ts", "src/gate/dq/placement-change.ts", "src/gate/dq/ipo.ts", "src/gate/waivers.ts", "src/timestamps.ts", "src/validation/schema.ts", "schemas/shared-defs.schema.json", "tests/helpers/governance-matrix.mjs"],
});
for (const path of ["README.md", "docs/agent/HUB.codex.md", "docs/project/blueprint.md", "docs/requirements.md", "docs/spec/index.md", "docs/project/evidence-acceptance-status.md"]) {
  const previous = additions[path] ?? index.nodes[path];
  additions[path] = { ...previous, depsOut: [...new Set([...(previous.depsOut ?? []), "docs/spec/governance-consistency.md", "docs/project/governance-fixes-2026-09-11.md"])] };
}
for (const path of ["README.md", "docs/agent/HUB.codex.md", "docs/project/blueprint.md", "docs/spec/index.md", "docs/project/evidence-acceptance-status.md", "docs/project/manual-governance-fixes-2026-09-11.md"]) {
  const previous = additions[path] ?? index.nodes[path];
  additions[path] = { ...previous, depsOut: [...new Set([...(previous.depsOut ?? []), "docs/spec/manual-evidence-and-review.md", "docs/evidence/manual-governance-fixes-2026-09-11/validation.json"])] };
}
additions["docs/spec/manual-evidence-and-review.md"].depsOut = ["src/gate/manual-evidence.ts", "src/gate/package-review.ts", "src/gate/dq/placement-change.ts", "src/gate/dq/helpers.ts", "tests/helpers/manual-governance-matrix.mjs"];
for (const path of ["README.md", "README_JA.md", "README_EN.md", "docs/project/runbook.md"]) {
  const previous = additions[path] ?? index.nodes[path];
  additions[path] = { ...previous, depsOut: [...new Set([...(previous.depsOut ?? []), "docs/release-notes/2026-09-12-v0.4.1.md"])] };
}
additions["docs/release-notes/2026-09-12-v0.4.1.md"].depsOut = ["src/version.ts", "tests/package-smoke.mjs", "tools/action-lifecycle-acceptance.mjs"];
const knownPaths = new Set([...Object.keys(index.nodes), ...Object.keys(additions)]);
for (const path of currentPaths.filter(p => /\.(ts|mjs)$/.test(p))) {
  const code = await readFile(resolve(root, path), "utf8");
  const deps = [...code.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g)]
    .map(m => posix.normalize(posix.join(posix.dirname(path), m[1])).replace(/\.js$/, ".ts"))
    .filter(p => knownPaths.has(p));
  additions[path].depsOut = [...new Set([...(additions[path].depsOut ?? []), ...deps])].sort();
}
for (const path of ["README.md", "docs/agent/HUB.codex.md", "docs/project/evaluation.md", "docs/project/blueprint.md"]) {
  additions[path] = { ...(additions[path] ?? index.nodes[path]),
    depsOut: [...new Set([...(additions[path]?.depsOut ?? []), "docs/project/remediation-2026-09-10.md"])] };
}
index.generated_at = generation;
for (const [path, node] of Object.entries(additions)) {
  index.nodes[path] = { ...node, mtime: generation };
  const capsule = {
    id: path,
    role: node.role,
    generation,
    public_api: [],
    summary: node.summary ?? `QEG ${node.role} の契約・実装。関連sourceと受入試験を参照。`,
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
  ["README.md", "docs/release/acceptance-2026-07-20-v0.3.1.md"],
  ["docs/agent/HUB.codex.md", "docs/release/acceptance-2026-07-20-v0.3.1.md"],
  ["docs/project/blueprint.md", "docs/release/acceptance-2026-07-20-v0.3.1.md"],
  ["docs/project/evaluation.md", "docs/release/acceptance-2026-07-20-v0.3.1.md"],
  ["docs/release/acceptance-2026-07-20-v0.3.1.md", "docs/requirements.md"],
  ["docs/release/acceptance-2026-07-20-v0.3.1.md", "docs/spec/reliability-hardening.md"],
  ["README.md", "docs/release-notes/2026-07-20-v0.3.1.md"],
  ["docs/project/runbook.md", "docs/release-notes/2026-07-20-v0.3.1.md"],
  ["docs/release-notes/2026-07-20-v0.3.1.md", "docs/release/acceptance-2026-07-20-v0.3.1.md"],
  ["docs/release-notes/2026-07-20-v0.3.1.md", "qeg-report-action/action.yml"],
  ["docs/release/acceptance-2026-07-20-v0.3.1.md", "fixtures/manifest.json"],
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
  ["docs/release/acceptance-2026-07-20.md", "docs/release/acceptance-2026-07-20-v0.3.1.md"],
  ["docs/release-notes/2026-07-20-v0.3.0.md", "docs/release-notes/2026-07-20-v0.3.1.md"],
  ["docs/release/acceptance-2026-07-20-v0.3.1.md", "tools/action-lifecycle-acceptance.mjs"],
  ["docs/release/acceptance-2026-07-20-v0.3.1.md", "schemas/action-lifecycle-evidence.schema.json"],
  ["docs/release/acceptance-2026-07-20-v0.3.1.md", "docs/spec/code-to-gate-v0.3.1-2026-07-20/release-readiness.json"],
  ["docs/release-notes/2026-07-20-v0.3.1.md", "tools/action-lifecycle-acceptance.mjs"],
  ["tools/action-lifecycle-acceptance.mjs", "schemas/action-lifecycle-evidence.schema.json"],
  ["tools/action-lifecycle-acceptance.mjs", "qeg-report-action/action.yml"],
  ["tests/package-smoke.mjs", "qeg-report-action/THIRD_PARTY_NOTICES.md"],
];
for (const edge of newEdges) {
  if (!index.edges.some((existing) => existing[0] === edge[0] && existing[1] === edge[1])) {
    index.edges.push(edge);
  }
}
for (const [path, node] of Object.entries(additions)) {
  for (const target of node.depsOut ?? []) if (knownPaths.has(target) && !index.edges.some(e => e[0] === path && e[1] === target)) index.edges.push([path, target]);
}
for (const [path, node] of Object.entries(index.nodes)) {
  const capsulePath = resolve(root, node.caps);
  const capsule = JSON.parse(await readFile(capsulePath, "utf8"));
  capsule.deps_out = [...new Set(index.edges.filter(e => e[0] === path).map(e => e[1]))].sort();
  capsule.deps_in = [...new Set(index.edges.filter(e => e[1] === path).map(e => e[0]))].sort();
  await writeFile(capsulePath, json(capsule));
}
await writeFile(indexPath, json(index));
console.log("Birdseye regenerated at generation " + generation);
