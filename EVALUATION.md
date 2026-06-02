---
intent_id: INT-QEG-EVAL-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-06-02
next_review_due: 2026-07-02
---

# Evaluation

## Acceptance Criteria

- `docs/requirements.md`、`BLUEPRINT.md`、`README.md`、`RUNBOOK.md`、`GUARDRAILS.md`、`HUB.codex.md` が矛盾しないこと。
- `src/types.ts` の `GateProfile` / `DisqualificationCode` と schema enum が一致すること。
- `docs/requirements.md` が Git 管理対象かつ package 配布対象であること。
- `docs/birdseye/index.json` と `docs/birdseye/caps/*.json` が主要ファイルを指すこと。
- `ipo_controlled` profile、DQ-15〜DQ-17、waiver governance、evidence immutability が要件に明記されていること。
- `conditional_go` の exit code policy が profile 依存として定義されていること。
- `TASK.codex.md` が TASK-01〜TASK-10 の実装順、対象、受入条件を固定していること。
- `fixtures/README.md` が minimal / negative fixture の期待 verdict / DQ を固定していること。
- `docs/control-mapping.md` と `docs/ipo-controlled-profile.md` が IPO 統制実装準備の最小契約を固定していること。
- `docs/implementation-prep-gate-2026-06-02.md` が implementation preparation Go と IPO controlled release No-Go を分離していること。

## Test Outline

- TypeScript:
  - `npm run typecheck`
- JSON:
  - `schemas/*.json` の parse
  - `package.json` の parse
- Release dry-run:
  - `npm pack --dry-run --cache ./.npm-cache`
- Birdseye:
  - `docs/birdseye/index.json` の parse
  - index が主要 docs / schemas / src を参照していること

## Verification Checklist

- [ ] `npm run typecheck` が成功した
- [ ] schema JSON parse が成功した
- [ ] `npm pack --dry-run --cache ./.npm-cache` が成功した
- [ ] tarball contents に `docs/requirements.md` が含まれる
- [ ] Birdseye index と capsule が主要ファイルを指す
- [ ] IPO controlled profile の統制要件が requirements / README / BLUEPRINT に同期している
- [ ] TASK 台帳、fixture 契約、control mapping、IPO profile、実装準備 Gate record が package に含まれる
