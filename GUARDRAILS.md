---
intent_id: INT-QEG-GUARDRAILS-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-06-02
next_review_due: 2026-07-02
---

# Guardrails

## Scope

- QEG は必須 3 接続先を adapter で正規化する。
- upstream artifact の意味、名称、schema を QEG 側で勝手に再定義しない。
- workflow-cookbook は adapter ではなく、Birdseye / Capsule / Task Seed / acceptance 運用の補助として扱う。

## Contract Safety

- `docs/requirements.md`、`src/types.ts`、`schemas/*.json` の契約を同時に確認する。
- Gate verdict / DQ / profile を変更する場合、requirements、types、schema、README、BLUEPRINT の同期を必須にする。
- `ipo_controlled` profile に関わる変更は、waiver governance、evidence retention、approval evidence への影響を notes に残す。

## Birdseye Intake

- まず `README.md` の LLM-BOOTSTRAP を読む。
- 次に `docs/birdseye/index.json` を読み、対象 node ±2 hop を取得する。
- 対応する `docs/birdseye/caps/*.json` だけを読む。
- Birdseye が stale の場合は、暫定読みに留めて再生成を要求する。

## Must Not

- `node_modules/`、`dist/`、`coverage/`、`.npm-cache/` を文脈取得目的で直読みしない。
- `docs/requirements.md` を Git 管理外にしない。
- Gate 関連 sourceRefs 空を成功扱いしない。
- `conditional_go` を `ipo_controlled` profile で CI success として扱わない。
