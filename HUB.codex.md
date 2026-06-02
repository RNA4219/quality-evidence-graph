---
intent_id: INT-QEG-HUB-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-06-02
next_review_due: 2026-07-02
---

# HUB.codex.md

`quality-evidence-graph` の仕様、運用、検収、Birdseye を束ねる Codex 用ハブ。

## 1. 読み順

1. `README.md`
2. `docs/birdseye/index.json`
3. 必要な `docs/birdseye/caps/*.json`
4. `BLUEPRINT.md`
5. `docs/requirements.md`
6. `RUNBOOK.md`
7. `EVALUATION.md`
8. `GUARDRAILS.md`
9. `TASK.codex.md`
10. `fixtures/README.md`
11. `docs/control-mapping.md`
12. `docs/ipo-controlled-profile.md`

## 2. 入力ファイル分類

| File | Role | Priority |
|---|---|---|
| `README.md` | repo overview / bootstrap | high |
| `BLUEPRINT.md` | problem, scope, I/O contract | high |
| `docs/requirements.md` | requirements source of truth | high |
| `RUNBOOK.md` | execution / validation / release operation | high |
| `EVALUATION.md` | acceptance criteria / release checks | high |
| `GUARDRAILS.md` | repo operating constraints | high |
| `TASK.codex.md` | implementation task ledger | high |
| `fixtures/README.md` | fixture contract / expected verdict | high |
| `docs/control-mapping.md` | IPO control mapping | high |
| `docs/ipo-controlled-profile.md` | IPO profile contract | high |
| `docs/implementation-prep-gate-2026-06-02.md` | implementation preparation gate record | high |
| `schemas/*.schema.json` | JSON Schema contracts | high |
| `src/types.ts` | TypeScript contract source | high |
| `docs/birdseye/index.json` | lightweight topology | high |
| `docs/birdseye/caps/*.json` | point-read context capsules | medium |

## 3. 自動タスク分割フロー

1. `docs/birdseye/index.json` から変更対象の node を特定する。
2. 変更対象±2 hop の capsule を読む。
3. `docs/requirements.md` の該当要求 ID と `EVALUATION.md` の検収条件へ紐づける。
4. 実装タスクは `TASK.codex.md` の形式で Objective / Scope / Requirements / Commands / Acceptance を記録する。
5. 完了時は `RUNBOOK.md` の確認手順と `EVALUATION.md` の acceptance criteria に従って証跡を残す。
6. 実装準備 Gate は `docs/implementation-prep-gate-2026-06-02.md` を起点に、release Gate と分離して判定する。

## 4. Birdseye 鮮度

- `docs/birdseye/index.json.generated_at` は 5 桁ゼロ埋め世代番号として扱う。
- 関連ファイルを変更したら index と capsule を同時更新する。
- capsule 欠落、世代不整合、対象 node 欠落がある場合は Birdseye を stale とみなし、暫定読みに留める。

## 5. 出力契約

- `plan`: 読んだ node ID、hop、未読箇所、前提を明記する。
- `patch`: 変更対象ファイルを明示し、requirements / schema / types の整合を崩さない。
- `tests`: `npm run typecheck`、schema parse、必要なら `npm pack --dry-run` を含める。
- `notes`: IPO controlled profile、waiver、evidence retention への影響を記録する。
