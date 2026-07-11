---
intent_id: INT-QEG-SCHEMA-MIGRATION-2026-07-02
owner: quality-evidence-graph
status: superseded
profile: ipo_controlled
last_reviewed_at: 2026-07-02
next_review_due: 2026-08-02
---

# Schema Migration Note 2026-07-02

## Scope

Gate policy 正本の一元化と cross-repo ID namespace 契約を導入する。

## Compatibility

- `qegVersion` は当時 `0.1`。この方針は0.2.0で終了し、現在の正本は `0.2` とする。
- `stableId` schema は `<producer>:<local-id>` を標準化しつつ、prefix なし ID を互換期間中は許容する。
- CLI ingest validation は prefix なし ID を warning 付きで受理する。
- 未予約 prefix は validation error として拒否する。
- 外部 artifact の `gate_policy` / `gatePolicy` 直接持ち込みは DQ または validation error とする。
- `gatePolicyProposal` / `gatePolicyProposals[]` は任意 field として追加し、verdict へ直接影響させない。

## Future Breaking Change

互換期間終了時に prefix なし ID の schema 許容を外す。その時点では fixture と adapter output をすべて `<producer>:<local-id>` に移行済みにし、breaking schema version を上げる。
