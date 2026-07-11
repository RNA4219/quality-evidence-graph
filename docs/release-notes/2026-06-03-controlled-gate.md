# Release Notes - 2026-06-03 Controlled Gate

## Summary

Quality Evidence Graph の controlled governance profile を、実装 Gate `go` の状態まで整備した。

本リリースでは、DQ-01〜DQ-17 の Gate evaluator、実体 fixture 入力、own-output validation、Quality Evidence Record、code-to-gate finding 0、agent / human README 導線を揃えた。

## Highlights

- Controlled Gate evaluator を実装し、DQ-01〜DQ-17 を検出可能にした。
- 21 fixture を実体 `gate-input.json` ベースで検証し、negative / positive regression を固定した。
- CLI を `validate` / `gate` / `record` の契約に整理し、CLI failure と Gate verdict exit code を分離した。
- `src/gate.ts`、`src/types.ts`、`src/cli.ts` を facade 化し、内部 module へ分割した。
- DQ-15、sourceRefs、CLI error handling、record path をリファクタし、`code-to-gate` findings 0 を維持した。
- root README を agent / maintainer 向け入口にし、人間向け `README_JA.md` と `README_EN.md` を追加した。

## Gate Status

- implementation completion Gate: `go`
- fixture / own-output validation Gate: `go`
- controlled release Gate: `go`
- code-to-gate: critical 0 / high 0 / medium 0 / low 0

## Verification

以下を確認済み。

```sh
npm run typecheck
npm run build
npm pack --dry-run --cache ./.npm-cache
```

追加確認:

- 全 21 fixture の `validate` が実体 `gate-input.json` で PASS。
- 全 21 fixture の `gate` / `record` exit code が expected と一致。
- DQ-01〜DQ-17 actual coverage 欠落なし。
- Birdseye JSON parse PASS。
- `code-to-gate analyze --emit all` findings 0。

## Notes

- `conditional_go`、`no_go`、`disqualified` は exit code `2` のまま。
- DQ は最優先であり、waiver では DQ を消せない。
- `output-record.json` の `exports[].path` は fixture 安定化のため `output-record.json` の相対表記にした。

> 履歴注記: 本文の21 fixtureは2026-06-03時点のsnapshotである。現在のfixture一覧と期待値の正本はfixtures/manifest.jsonを参照すること。
