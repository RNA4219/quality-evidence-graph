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
5. `docs/spec/implementation-gate-2026-06-03.md` - 現在の実装 Gate 証跡
6. `docs/project/runbook.md` / `docs/project/evaluation.md` - 実行手順と受入条件

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
- CLI contract は `validate <fixture-dir>`、`gate <fixture-dir>`、`record <fixture-dir>`、`report <fixture-dir-or-parent> [...]`、`baseline audit`、`doctor`、`explain <DQ>`、`schema-check`、`enum-check`、`evidence verify`、`policy lint`、`repro-bundle`、`check`、`snapshot`、`init`。
- `go` は exit code `0`。`conditional_go`、`no_go`、`disqualified` は exit code `2`。
- `gate-input.json` 欠落・invalid は CLI failure として exit code `1`。
- `report` は複数 target を最後まで評価し、CLI failure / DQ / blocker / human review を累積レポートとして出す。
- DQ は最優先で、waiver では DQ を消せない。
- `output-record.json` は own-output validation の証跡として扱う。

## Current Implementation

- controlled governance profile 実装済み。
- DQ-01 から DQ-17 まで実装済み。
- fixture regression は fixtures/manifest.json を正本として保持。
- Test Placement Plan は `placement_changes[]` により manual→automated の引退、replacement 証跡、policy、revert 条件を監査可能に記録できる。
- test node は `testExecutionMode=real|mock` を持ち、mock test は graph に残しても Gate 証跡の件数・強度・green 回数・risk coverage には算入しない。
- `code-to-gate` findings は 0 を維持する方針。
- Gate evaluator、CLI、types は facade + internal modules に分割済み。

## Validation Commands

```sh
npm run typecheck
npm run build
npm run schema-check
npm run enum-check
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

## 0.2.0 release contract

QEG 0.2.0 uses one runtime schema/evidence preflight. Broken JSON or a missing decision envelope is exit 1; parseable required-component violations are DQ-01/exit 2. Required evidence is checked against real files, SHA-256, and revision. Optional-only failures remain warnings.

changed-only returns no_relevant_changes/exit 0 only after successful detection; detection failure is exit 1. QEG_CHANGED_FILES is authoritative. fixtures/manifest.json is the fixture source of truth. The v0.2.0 external Action enforces after artifact upload by default; set enforce: "false" only for diagnostic-only use.
