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
- CLI contract は `validate <fixture-dir>`、`gate <fixture-dir>`、`record <fixture-dir>`。
- `go` は exit code `0`。`conditional_go`、`no_go`、`disqualified` は exit code `2`。
- `gate-input.json` 欠落・invalid は CLI failure として exit code `1`。
- DQ は最優先で、waiver では DQ を消せない。
- `output-record.json` は own-output validation の証跡として扱う。

## Current Implementation

- controlled governance profile 実装済み。
- DQ-01 から DQ-17 まで実装済み。
- 28 fixture で negative / positive regression を保持。
- Test Placement Plan は `placement_changes[]` により manual→automated の引退、replacement 証跡、policy、revert 条件を監査可能に記録できる。
- `code-to-gate` findings は 0 を維持する方針。
- Gate evaluator、CLI、types は facade + internal modules に分割済み。

## Validation Commands

```sh
npm run typecheck
npm run build
npm pack --dry-run --cache ./.npm-cache
```

Fixture regression:

```sh
npm run validate -- fixtures/positive-release-go
npm run gate -- fixtures/positive-release-go
npm run record -- fixtures/positive-release-go
```

`code-to-gate`:

```sh
node C:\Users\ryo-n\Codex_dev\code-to-gate\dist\cli.js analyze C:\Users\ryo-n\Codex_dev\quality-evidence-graph --emit all --out C:\tmp\qeg-ctg --cache disabled --parallel 4
```

## Human-Facing Pages

この root README は agent / maintainer 向けの作業入口です。製品の意味、使いどころ、読みやすい導入説明は次を参照してください。

- [README_JA.md](README_JA.md)
- [README_EN.md](README_EN.md)
