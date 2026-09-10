---
intent_id: INT-QEG-EVAL-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# Evaluation

## Acceptance Criteria

[証跡の共通受入基準](../spec/evidence-acceptance-standard.md) EAC-01〜12を適用する。通常実行の資格判定は[実装契約](../spec/execution-qualification.md)に従い、[実装・受入状況](evidence-acceptance-status.md)を受入単位ごとに記録する。基準の制定、コードへの実装、試験成功、受入完了を別の状態として記録する。

- `docs/requirements.md` を要求正本とし、`README.md`、`docs/project/blueprint.md`、`docs/project/tasks.codex.md`、仕様書、fixture契約、完了記録が現在状態について矛盾しないこと。
- schema、公開TypeScript型、runtime enum、CLI helpが同じdiscriminator、DQ-01〜DQ-21、BLK-REL-01〜04を表すこと。
- legacy graphは明示的inputContractへ移行し、入力mode・必須集合・空graph・参照・実行証跡をfail-closedで評価すること。Reliability / Resilience有効時のpolicy identity、artifact、signal、selection、safetyを維持すること。
- FIX-01〜20について、必須3 producerのraw入力→graph→7層配置→Gate→schema-valid recordを公開API、CLI、packed consumerで検証すること。
- negative入力を含む全recordのsourceRefs、出力schema、hash一覧、改ざん検出が整合すること。配置計画・未実行・mock・失敗を成功実行と混同しないこと。
- resilience evidenceの判定用joinは`testId`とし、`evidenced_by` edge欠落は許可する。edgeが存在して`testId`と矛盾または複数testを指す場合はDQ-18とし、旧passへフォールバックしないこと。
- Gate reason、DQ、blocker、waiver、drill-down、record、report、snapshotがsource-backedかつdeterministicであること。
- `fixtures/manifest.json`をfixture正本とし、legacy、positive、negative、waiver、最新証跡、安全履歴、provenance矛盾をon-disk E2Eで検証すること。
- local全検証と最終commitのGitHub Actions `quality (20)` / `quality (24)` / `portability (windows-24)`が成功すること。
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

## 現行の検証記録

改修ごとの実装箇所、実測結果、CI revision、非評価範囲は `docs/project/remediation-2026-09-10.md` に記録する。チェック数はmanifestと実行結果を正本とし、過去のチェック数を現在の完了証拠にしない。

追加EAC要求は `docs/project/evidence-acceptance-status.md` へ記録する。既知P1不具合のある受入単位はno_goとし、未実施ケースを既存CIの成功で置換しない。前のR01〜R06受入は当時の範囲の履歴として保持する。

## 2026-07-20の検証履歴

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
