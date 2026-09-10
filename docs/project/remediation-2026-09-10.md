---
intent_id: INT-QEG-REMEDIATION-STATUS-20260910
owner: quality-evidence-graph
status: completed
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# QEG改修台帳

本台帳はR01〜R06の受入履歴を記録する。20要求の実装・試験・scopeの対応は [受入照合表](acceptance-audit-2026-09-10.md) を参照する。v0.3.1のrelease acceptanceは配布物の過去受入証跡として保持する。以前のTASK-01〜10完了表記は、build-graph/place-testsと出力契約まで完成していたことを意味しない。追加EAC改修の現在の判定は[証跡受入台帳](evidence-acceptance-status.md)を正本とする。

**追加調査後の位置付け:** 本台帳のcompletedはR01〜R06の当時の受入範囲に限る。通常テストの別build・未来実行に判定漏れが見つかり、[共通受入基準](../spec/evidence-acceptance-standard.md)を追加した。EAC-01〜12は別のsource commitと検証証拠で受入を完了しており、詳細と範囲は[証跡受入台帳](evidence-acceptance-status.md)に記録する。本台帳の過去CI成功は追加基準の証拠として流用しない。

| 改修 | 要求 | 仕様 | 状態 | 実装・受入証拠 |
|---|---|---|---|---|
| R01 必須証跡 | FIX-01〜04 | remediation-2026-09-10.md 入力契約 | passed | input-contract型/schema、gate/dq/input-contract、raw-ingest、空init・必須14種個別欠落試験 |
| R02 参照整合 | FIX-05〜07 | 同 テスト配置とGate | passed | graph-integrity、placement-coverage、waivers、別変更配置・参照矛盾・未実行/mock/fail試験 |
| R03 出力検証 | FIX-08〜10 | 同 出力・検証 | passed | record、validation/output、output-files/integrity、全negative recordとhash改ざん試験 |
| R04 生成機能 | FIX-11〜15 | 同 raw artifactからの生成 | passed | adapters、graph、placement、pipeline、14 raw artifactのAPI/CLI/packed consumer E2E |
| R05 正本同期 | FIX-16〜17 | 同 受入・互換性 | passed | 要求・仕様・README・台帳・履歴の境界を訂正、Birdseye同期済み |
| R06 保守性 | FIX-18〜20 | 同 保守性・互換性 | passed | 以下の12件対応表。診断保持と責務分割、既存CLI/fixture/Action回帰 |

実装順は入力契約とDQ→出力検証→producer adapter→graph→placement→record統合→診断/分割→全体受入。追加修正を含む実装commit `216cd2f9b18c6b8922ea027ba4aa7aac2e323e16` のCI成功により、以下の評価範囲で実装受入を完了した。fixture・隔離consumer・実環境を別scopeとして扱う。

## 読み取りと前提

- 対象HEAD: 99ed54bf3113d877fb177ec1be54a298f517a2f7。開始時tracked差分なし、未追跡.runtime/あり。
- README、agent HUB、要求、Guardrails、公開型、schema、CLI、判定module、producer README/schemaを確認。
- Birdseye generation 00014の要求・CLI・Blueprint nodeから2hopを参照。record/fixture-io/ingest-contract等の未収載sourceは直接読取し、今回indexへ追加する。
- baseline build/runtime/Actionは調査時成功。今回の改修受入では改めて変更後の証拠を得る。
- package 0.4.0（未公開）へ移行、wire契約0.2を維持。release/tag/publishは要求外。

## 検証範囲と結果

- 追加修正時点のローカルNode 24: build/typecheck、52 runtime/Action試験、既存53 fixture（Reliability / Resilience 22件）、全52診断recordの出力schema、packed tarballの隔離install・公開型・raw pipelineが成功。remediation境界10試験とproducer境界6試験を含む。schema/enum、700 tracked JSON、Birdseye 202 source、pack dry-run、git diff --checkも成功。
- CI記録追加後の文書・索引検証: 702 tracked JSON、Birdseye 203 source、generator構文、git diff --checkが成功。
- 最新の追加修正と対象source indexの指紋は [audit-validation.json](../evidence/remediation-2026-09-10/audit-validation.json) と同ディレクトリのauditログに保存。最初の改修commitの証跡は [local-validation.json](../evidence/remediation-2026-09-10/local-validation.json) に保持。これらはローカル採取時点の記録であり、当時のCI未実施状態も保持する。後続のCI結果は [ci-validation.json](../evidence/remediation-2026-09-10/ci-validation.json) を参照。実行前後で既存の期待verdict/DQ/blockerは変更していない。
- 3 producer E2Eはproducer schemaに従うfixtureを使用。実producer実行や実環境testの受入を主張しない。固定schemaのcommit/hash/licenseは `../spec/producer-schema-provenance.json` に記録。
- Action lifecycleは隔離consumerへの配置→正常観測→schema破損→復旧→新規hash証拠までgo。実cluster・実fault injection・Lakda real acceptance・外部release approvalは未評価。
- 初期実装commit: `5bd5ba8`、追加修正を含む実装commit: `216cd2f9b18c6b8922ea027ba4aa7aac2e323e16`。作業ブランチ: `agent/qeg-remediation-20260910`。ローカルのsource index指紋と保存ログで対象を特定できる。
- CI: 上記実装commitの [run 34414497596](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34414497596) で `quality (20)`、`quality (24)`、`portability (windows-24)` がすべて成功（2026-09-10 JST）。記録更新後の最終commitも同じ3 jobの成功をマージ条件とし、自己参照を避けて [PR #7のlatest checks](https://github.com/RNA4219/quality-evidence-graph/pull/7/checks) で外部確認する。release/tag/publishは未実施。

追加の受入照合で、実行必須なのにresilience testが専用evaluatorの対象外である場合、変更のobligationがadvisoryである場合、lean/standardで明示必須artifactが不正である場合の見落としを修正した。通常optionalのwarningは維持する。I/Oのstat/read/realpath失敗はIO_ERRORで原因を残し、不正outputのschema検証失敗時には既存7成果物が変わらないことを追加試験で確認した。

## 過去の静的候補12件の対応

v0.3.1の原本はraw 13件（high 1 / medium 12）、accepted-design抑制1件、effective medium 12件。以前の「raw 12件」は誤記。以下はeffective 12件を個別に追跡する。

| 過去ID / rule | 対応した責務 | 修正内容・確認 |
|---|---|---|
| 000 TRY_CATCH_SWALLOW | report/targets | optionalStatでENOENTのみabsence。他I/O errorはpath付き診断 |
| 001 TRY_CATCH_SWALLOW | repro-bundle | optionalTextでmissingと読取失敗を区別。runtime回帰 |
| 002 TRY_CATCH_SWALLOW | snapshot | optionalTextでmissingと読取失敗を区別。全fixture snapshot |
| 003 TRY_CATCH_SWALLOW | migrate-fixtures-v02 | ENOENTだけ許可。その他はpath付きerror、既存fixture契約維持 |
| 004 ENV_DIRECT_ACCESS | report/environment | GITHUB_STEP_SUMMARYをabsolute regular fileとして検証。Action/runtime回帰 |
| 006 LARGE_MODULE | evidence-normalize | model/values/files/options/adapters/validation/publishへ分割、4 adapter回帰 |
| 007 LARGE_MODULE | policy-lint | model/rules/formatへ分割。policy lint回帰 |
| 008 LARGE_MODULE | report formatter | shared/text/githubへ分割。JSON/text/GitHub出力回帰 |
| 009 LARGE_MODULE | reliability qualification | preflight/lifecycleへ分割。22 resilience fixture |
| 010 LARGE_MODULE | reliability utils | bounds/fingerprint/collectionsへ分割。選択・指紋の決定性を維持 |
| 011 LARGE_MODULE | migration script | fixture-migration/values・artifactsへ分割。期待判定を維持 |
| 012 SUPPRESSION_DEBT | .ctg/suppressions.yaml | ownerと再確認条件を明示し、expiryを2026-10-10へ短縮 |

別途highの005 UNSAFE_DELETEはtemp fileの失敗時cleanupというaccepted-design。publish.tsに限定し、exclusive open成功後だけ所有を認め、cleanup失敗も診断する。新しい広域抑制は追加していない。

2026-09-10のcode-to-gate 1.6.0再走査はraw/effective/suppressedすべて0件（最新run `ctg-202609092013-local`）。当時と解析器versionが異なるため、件数差だけを解消証拠にせず、上表の変更と回帰試験を対応根拠とする。

## 互換性・運用

旧consumerはinputContractへmode・必須集合・評価scopeを明示する。空initをgoとして使っていた運用はexit 2へ変わる。initはインストール済みruntimeを同梱し、未公開tagや旧Actionを参照しない。producer schemaは別licenseを含むため、同梱NOTICEを配布物に保持する。waiverでDQを消さない、mock非算入、IPO承認/保管/職務分掌は維持する。
