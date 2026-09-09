---
intent_id: INT-QEG-REMEDIATION-STATUS-20260910
owner: quality-evidence-graph
status: in_progress
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# QEG改修台帳

現行改修の状態は本台帳を正本とする。v0.3.1のrelease acceptanceは配布物の過去受入証跡として保持する。以前のTASK-01〜10完了表記は、build-graph/place-testsと出力契約まで完成していたことを意味しない。今回の要求→仕様→実装→受入で、機能ごとに完成を証明する。

| 改修 | 要求 | 仕様 | 状態 | 実装・受入証拠 |
|---|---|---|---|---|
| R01 必須証跡 | FIX-01〜04 | remediation-2026-09-10.md 入力契約 | local_pass / CI待ち | input-contract型/schema、gate/dq/input-contract、raw-ingest、空init・必須14種個別欠落試験 |
| R02 参照整合 | FIX-05〜07 | 同 テスト配置とGate | local_pass / CI待ち | graph-integrity、placement-coverage、waivers、別変更配置・参照矛盾・未実行/mock/fail試験 |
| R03 出力検証 | FIX-08〜10 | 同 出力・検証 | local_pass / CI待ち | record、validation/output、output-files/integrity、全negative recordとhash改ざん試験 |
| R04 生成機能 | FIX-11〜15 | 同 raw artifactからの生成 | local_pass / CI待ち | adapters、graph、placement、pipeline、14 raw artifactのAPI/CLI/packed consumer E2E |
| R05 正本同期 | FIX-16〜17 | 同 受入・互換性 | local_pass / CI待ち | 要求・仕様・README・台帳・履歴の境界を訂正、Birdseye同期済み |
| R06 保守性 | FIX-18〜20 | 同 保守性・互換性 | local_pass / CI待ち | 以下の12件対応表。診断保持と責務分割、既存CLI/fixture/Action回帰 |

実装順は入力契約とDQ→出力検証→producer adapter→graph→placement→record統合→診断/分割→全体受入。完了時は同一revisionの証拠を記載する。fixture・隔離consumer・実環境を別scopeとして扱う。

## 読み取りと前提

- 対象HEAD: 99ed54bf3113d877fb177ec1be54a298f517a2f7。開始時tracked差分なし、未追跡.runtime/あり。
- README、agent HUB、要求、Guardrails、公開型、schema、CLI、判定module、producer README/schemaを確認。
- Birdseye generation 00014の要求・CLI・Blueprint nodeから2hopを参照。record/fixture-io/ingest-contract等の未収載sourceは直接読取し、今回indexへ追加する。
- baseline build/runtime/Actionは調査時成功。今回の改修受入では改めて変更後の証拠を得る。
- package 0.4.0（未公開）へ移行、wire契約0.2を維持。release/tag/publishは要求外。

## 検証範囲と結果

- ローカルNode 24: build/typecheck、49 runtime/Action試験、既存53 fixture（Reliability / Resilience 22件）、全52診断recordの出力schema、packed tarballの隔離install・公開型・raw pipelineが成功。追加producer境界6試験も再確認済み。schema/enum、全tracked JSON、Birdseye、pack dry-run、git diff --checkが成功。
- 実行ログとhash、対象source indexの指紋は [local-validation.json](../evidence/remediation-2026-09-10/local-validation.json) と同ディレクトリのログに保存。実行前後で既存の期待verdict/DQ/blockerは変更していない。
- 3 producer E2Eはproducer schemaに従うfixtureを使用。実producer実行や実環境testの受入を主張しない。固定schemaのcommit/hash/licenseは `../spec/producer-schema-provenance.json` に記録。
- Action lifecycleは隔離consumerへの配置→正常観測→schema破損→復旧→新規hash証拠までgo。実cluster・実fault injection・Lakda real acceptance・外部release approvalは未評価。
- 実装commit: `5bd5ba8`。作業ブランチ: `agent/qeg-remediation-20260910`。ローカルのsource index指紋と保存ログで対象を特定できる。
- CI: 未実施。リモートへのpush待ちであり、Linux Node 20/24とWindows Node 24の結果を確認するまで総合受入は確定しない。release/tag/publishも未実施。

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

2026-09-10のcode-to-gate 1.6.0再走査はraw/effective/suppressedすべて0件（run `ctg-202609091947-local`）。当時と解析器versionが異なるため、件数差だけを解消証拠にせず、上表の変更と回帰試験を対応根拠とする。

## 互換性・運用

旧consumerはinputContractへmode・必須集合・評価scopeを明示する。空initをgoとして使っていた運用はexit 2へ変わる。initはインストール済みruntimeを同梱し、未公開tagや旧Actionを参照しない。producer schemaは別licenseを含むため、同梱NOTICEを配布物に保持する。waiverでDQを消さない、mock非算入、IPO承認/保管/職務分掌は維持する。
