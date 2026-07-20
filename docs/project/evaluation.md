---
intent_id: INT-QEG-EVAL-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-07-20
next_review_due: 2026-10-20
---

# Evaluation

## Acceptance Criteria

- `docs/requirements.md` を要求正本とし、`README.md`、`docs/project/blueprint.md`、`docs/project/tasks.codex.md`、仕様書、fixture契約、完了記録が現在状態について矛盾しないこと。
- schema、公開TypeScript型、runtime enum、CLI helpが同じdiscriminator、DQ-01〜DQ-21、BLK-REL-01〜04を表すこと。
- legacy graphを受理しつつ、Reliability / Resilience有効時のpolicy identity、artifact、signal、selection、safetyをfail-closedで評価すること。
- resilience evidenceの判定用joinは`testId`とし、`evidenced_by` edge欠落は許可する。edgeが存在して`testId`と矛盾または複数testを指す場合はDQ-18とし、旧passへフォールバックしないこと。
- Gate reason、DQ、blocker、waiver、drill-down、record、report、snapshotがsource-backedかつdeterministicであること。
- `fixtures/manifest.json`をfixture正本とし、legacy、positive、negative、waiver、最新証跡、安全履歴、provenance矛盾をon-disk E2Eで検証すること。
- local全検証と最終commitのGitHub Actions `quality (20)` / `quality (24)`が成功すること。
- cleanな隔離consumer repoでpacked packageをinstallし、init、go、disqualified、changed-only、baseline / diff、失敗時artifact契約を確認すること。
- repository実装完了と、実cluster / 実fault injection / Lakda real acceptance / publish approvalを混同しないこと。

## Required Local Gates

```sh
npm ci
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
git diff --check
```

加えて、`explain`、`doctor`、`check`、`evidence verify`、`policy lint`、`report`のtext / JSON、`baseline audit`、`report --diff`、`snapshot`、`repro-bundle`をpositive fixtureで検証する。

## Verification Checklist

- [x] public type contract、build、35 runtime / Action contractが成功した
- [x] schema / enum drift、全tracked JSON parseが成功した
- [x] 53 fixture（Reliability / Resilience 22件）のverdict、exit code、record、report、snapshot回帰が成功した
- [x] package smokeとpackage dry-runが成功し、正本文書がtarballへ含まれた
- [x] operational CLI群がpositive fixtureで成功した（doctor / policyの非blocking warningを含む）
- [x] `negative-resilience-evidenced-by-conflict`がDQ-18 / exit 2を返した
- [x] Birdseye generation `00012`が95 sourceを参照した
- [x] 隔離consumer acceptanceが成功した
- [x] code-bearing commitとevidence-record docs-only commitのNode 20 / 24 CIがSUCCESSになった
- [x] `docs/release/acceptance-2026-07-20.md`に上記証跡と非評価範囲を記録した

過去の準備Gateや実装Gateは履歴として保持し、現行判定には総合完了記録を使用する。最終seal commitのCIは総合完了記録の自己参照を避け、PR latest checkとして外部確認する。
