# Quality Evidence Graph

`Quality Evidence Graph` は、仕様、実装差分、リスク、テスト配置、実行証跡、Gate 判定を 1 つの証跡グラフとして扱う local-first な品質ゲート基盤です。

人間向けの概要は次を読んでください。

- 日本語: [README_JA.md](README_JA.md)
- English: [README_EN.md](README_EN.md)

<!-- LLM-BOOTSTRAP v1 -->
## Agent Bootstrap

読む順番:

1. `docs/agent/HUB.codex.md` - repo 内ドキュメントの入口とタスク分解ルール
2. `docs/birdseye/index.json` - ノード一覧・隣接関係
3. `docs/birdseye/caps/*.json` - 必要ノードだけ point read
4. `docs/spec/index.md` - controlled governance 実装仕様書群の入口
5. `docs/project/evidence-acceptance-status.md` - 現行EAC改修の状態と受入証拠。R01〜R06の履歴は`docs/project/remediation-2026-09-10.md`
6. `docs/project/runbook.md` / `docs/project/evaluation.md` - 実行手順と受入条件

開発版: 0.4.0（未公開）。過去の配布版: [v0.3.1 release notes](docs/release-notes/2026-07-20-v0.3.1.md)。現行の受入状態は[EAC受入台帳](docs/project/evidence-acceptance-status.md)を参照。

追加調査後の[証跡共通受入基準](docs/spec/evidence-acceptance-standard.md)に沿い、実行対象・時刻・最新runの検証に加え、[世代公開・復旧・実producer接続・consumer移行](docs/spec/output-publication-and-migration.md)を実装しました。`outputs read/recover`で出力を検証・復旧し、`migrate --dry-run/--apply`で明示設定を移行できます。[受入状況](docs/project/evidence-acceptance-status.md)に検証範囲と証拠を集約しています。

2026-09-11の[再レビュー修正](docs/project/review-fixes-2026-09-11.md)では、配置と移行の競合、入力を含む中断復旧、移行previewとCLIの整合、API/CLIの要求mappingを追加検証しています。

フォーカス手順:

- 直近変更ファイル±2hopの node ID を `docs/birdseye/index.json` から取得する。
- 対応する `docs/birdseye/caps/*.json` だけを読む。
- Birdseye の世代や capsule が不整合なら stale とみなし、暫定読みに留める。
- 仕様・型・schema・fixture・Gate 記録の整合を崩す変更は、必ず検証証跡を残す。
<!-- /LLM-BOOTSTRAP -->

## Agent Rules

- 要求正本は `docs/requirements.md`。
- controlled governance の実装仕様正本は `docs/spec/`。
- public TypeScript contract は `src/types.ts` facade から辿る。
- CLI contract は `build-graph <target-dir>`、`place-tests <target-dir>`、`validate <fixture-dir>`、`gate <fixture-dir>`、`record <fixture-dir>`、`outputs read/recover <directory>`、`migrate <directory> [--config <file>] [--dry-run|--apply]`、`report <fixture-dir-or-parent> [...]`、`baseline audit`、`doctor`、`explain <DQ>`、`schema-check`、`enum-check`、`evidence verify`、`evidence normalize --adapter <kind> --input <raw.json> --context <context.json> --out <evidence.json>`、`policy lint`、`repro-bundle`、`check`、`snapshot`、`init`。
- `go` は exit code `0`。`conditional_go`、`no_go`、`disqualified` は exit code `2`。
- `gate-input.json` 欠落・不正JSON・envelope欠落は exit `1`。解釈可能な必須componentのschema違反は DQ-01 / exit `2`。
- `report` は複数 target を最後まで評価し、CLI failure / DQ / blocker / human review を累積レポートとして出す。
- DQ は最優先で、waiver では DQ を消せない。
- `output-record.json` は own-output validation の証跡として扱う。

## Current Implementation

- controlled governance profile 実装済み。
- DQ-01からDQ-21、Reliability / ResilienceのBLK-REL-01〜04、waiver、artifact / signal verificationを実装済み。
- resilience evidenceは`testId`を判定用join keyとし、存在する`evidenced_by` provenanceが矛盾または曖昧ならDQ-18でfail-closedにする。
- fixture regression は fixtures/manifest.json を正本として保持。
- Test Placement Plan は `placement_changes[]` により manual→automated の引退、replacement 証跡、policy、revert 条件を監査可能に記録できる。
- test node は `testExecutionMode=real|mock` を持ち、mock test は graph に残しても Gate 証跡の件数・強度・green 回数・risk coverage には算入しない。
- `code-to-gate` はraw/effective/抑制を区別し、effective high/criticalを0にする。MEDIUM候補は処理結果を台帳へ記録する。
- Gate evaluator、CLI、types は facade + internal modules に分割済み。

0.4.0では明示したinputContract、3 producerのraw adapter、pure `buildGraph` / `placeTests`、全JSONの出力schema検証を追加した。`record`は4 JSONとMarkdown、互換alias、hash manifestを生成する。`init`は証拠未投入ならDQ-01になり、workflowはインストール済み配布物のCLI・schema・licenseを含むlocal Actionを使う。要求第22節、[改修仕様](docs/spec/remediation-2026-09-10.md)、[改修台帳](docs/project/remediation-2026-09-10.md)を参照。

raw入力の例は[examples/raw-producer-contract](examples/raw-producer-contract/README.md)。評価範囲はfixtureとして明示してあり、producerを本番実行した証拠ではない。新しいinputContractを持たない旧native入力は実行時DQ-01になる。

## Validation Commands

```sh
npm run typecheck
npm run test:types
npm run build
npm run test:runtime
npm run schema-check
npm run enum-check
npm run test:fixtures
npm run test:package
npm run birdseye-check
node tools/json-check.mjs
npm pack --dry-run --cache ./.npm-cache
```

Fixture regression:

```sh
npm run validate -- fixtures/positive-release-go
npm run gate -- fixtures/positive-release-go
npm run record -- fixtures/positive-release-go
npm run report -- fixtures/positive-release-go
npm run explain -- DQ-15
npm run doctor -- fixtures/positive-release-go
npm run check -- fixtures/positive-release-go
npm run evidence -- verify fixtures/positive-release-go
npm run policy -- lint fixtures/positive-release-go
npm run snapshot -- fixtures/positive-release-go
```

CI cumulative report:

```sh
npm run report -- --json --out .qeg/qeg-ci-report.json fixtures
```

GitHub Actions integration:

- `.github/workflows/ci.yml` runs install, typecheck, build, JSON parse, package dry-run, and QEG report with `continue-on-error`.
- `qeg-report-action` wraps report generation, Step Summary output, artifact upload, and outputs such as `exit_code`, `gate_failed`, `cli_errors`, `dq_count`, `report_path`, and `summary_markdown_path`.
- The job uploads `.qeg/qeg-ci-report.json` as the `qeg-ci-report` artifact even when the Gate fails.
- The final CI verdict step fails only after all diagnostic steps have finished.
- Manual demo: run the `CI` workflow with `qeg_report_targets=fixtures/negative-approval-missing` to see a red job that still preserves the cumulative QEG report artifact.

`code-to-gate`:

```sh
node C:\Users\ryo-n\Codex_dev\code-to-gate\dist\cli.js analyze C:\Users\ryo-n\Codex_dev\quality-evidence-graph --emit all --out C:\tmp\qeg-ctg --cache disabled --parallel 4
```

## Human-Facing Pages

この root README は agent / maintainer 向けの作業入口です。製品の意味、使いどころ、読みやすい導入説明は次を参照してください。

- [README_JA.md](README_JA.md)
- [README_EN.md](README_EN.md)

## 0.3.1 release contract

この節は過去の配布契約。0.4.0の実装・受入状態は改修台帳を正本とし、tag / release / publishはまだ実行していない。

v0.3.1 is distributed through GitHub Release and a self-contained GitHub Action. The default Action path executes the bundled CLI without npm registry or `npx` access. `npm run test:release-lifecycle` proves change → risk → test → isolated deployment → observation → fault → recovery → new evidence. See [the v0.3.1 acceptance record](docs/release/acceptance-2026-07-20-v0.3.1.md).

QEG 0.3.1 keeps the `qegVersion=0.2` wire contract and adds Reliability / Resilience evidence, DQ-18 through DQ-21, BLK-REL-01 through BLK-REL-04, normalization adapters, and fail-closed `evidenced_by` provenance checks. Broken JSON or a missing decision envelope is exit 1; parseable required-component violations are DQ-01/exit 2. Required evidence is checked against real files, SHA-256, and revision. Optional-only failures remain warnings.

changed-only returns no_relevant_changes/exit 0 only after successful detection; detection failure is exit 1. QEG_CHANGED_FILES is authoritative. fixtures/manifest.json is the fixture source of truth. The v0.3.1 external Action enforces after artifact upload by default; set enforce: "false" only for diagnostic-only use.
