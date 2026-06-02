---
intent_id: INT-QEG-CHECKLISTS-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-06-02
next_review_due: 2026-07-02
---

# Checklists

## Hygiene

- [ ] `npm run typecheck`
- [ ] schema JSON parse
- [ ] `npm pack --dry-run --cache ./.npm-cache`
- [ ] `docs/requirements.md` が package に含まれる
- [ ] Birdseye index / capsule が主要ファイルと一致する

## IPO Controlled

- [ ] `ipo_controlled` profile が requirements / types / schema に存在する
- [ ] DQ-15〜DQ-17 が requirements / types / gate schema に存在する
- [ ] `conditional_go` の exit code policy が profile 依存である
- [ ] waiver governance と evidence immutability が要求に含まれる
- [ ] `docs/control-mapping.md` が変更管理、品質判定、例外承認、証跡保全、リリース承認を扱う
- [ ] `docs/ipo-controlled-profile.md` が Gate policy、waiver、approval evidence、retention を扱う

## Implementation Preparation

- [ ] `TASK.codex.md` が TASK-01〜TASK-10 の順序、対象、受入条件を固定している
- [ ] `fixtures/README.md` が minimal / negative fixture の期待 verdict / DQ を固定している
- [ ] `docs/implementation-prep-gate-2026-06-02.md` が implementation preparation = go と IPO release = no_go を分離している
- [ ] 正本ファイルが Git tracked である
