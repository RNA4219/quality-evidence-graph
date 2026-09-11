---
intent_id: INT-QEG-MANUAL-REVIEW-20260911
owner: quality-evidence-graph
status: implemented
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# 手動証拠・復帰・承認フェーズの一貫した判定

R25〜R28、T-13/14、V-08/09、S-04/05、CRTL-04/06、EAC-06/07/11の具体契約。package 0.4.0未公開 / wire 0.2を維持する。受入は[改修台帳](../project/manual-governance-fixes-2026-09-11.md)で管理する。

## 入力から判定までの規則

手動証拠は`assessManualEvidence`で資格、参照、結果、reviewerNoteを一度評価する。その結果をDQ-08、DQ-04のreview根拠、blocker、requiredHumanReviewへ渡す。manualEvidenceのpassを通常実行accountingへ追加せず、requireExecutedTestsの未実行やraw資格不適合を埋めない。

`expectedResult`、`oracleRefs`、`traceTo`、`evidenceRefs`はschema・入力型とも省略可能として読み、semantic検証で不足・空白・空配列をDQ-08にする。不正なJSON型や未知resultはCLIのschema検証でDQ-01、公開APIへ直接渡した手動項目はDQ-08。省略した配列を記録・escaped-defect backlink生成でも必須として読まない。

手動実行のexecutedCaseIdは現役のreal manual testへ解決し、traceToはrequirement/risk/acceptance_criteriaへ解決する。oracle/evidence refsは非空白のid/path/kindを必要とする。同一caseの同内容の複製は1件にまとめ、異なる内容の複数記録は順序によらずDQ-08。現行wireに時系列の識別子がないため、配列の後勝ちで結果を選ばない。

既存のrisk-review記録は、testを参照せず、pass・非空白reviewerNote・riskへのtraceTo・全oracle/evidence refsのhuman_review種別が揃うものとして区別する。これはreview根拠であり、テストの実行証拠やcoverageには算入しない。

| 手動結果 | 最終判定への接続 |
|---|---|
| pass | 独立DQ/blocker/reviewを解除しない。適格な非空白reviewerNoteは対応riskの既存review根拠にできる |
| fail | 手動失敗blocker。対応する通常実行もfailなら既存の実行blockerを使い、同じ失敗を二重計上しない |
| blocked / skipped | requiredHumanReviewにcase IDを残す。追加DQ/blockerがなければconditional_go |
| 採用済み通常実行と異なる結果 | DQ-08。未完了・失敗の手動結果を通常passで隠さない |
| 不足・参照不適合・重複矛盾 | DQ-08。reviewerNoteがあってもDQ-04の根拠にしない |

## 復帰とinventory

current_subject_idsは、重複なく、存在する・未削除・real・manual layerのtestを指す。違反はDQ-14。replacementの不足を免除する復帰には、さらに当該testを選んだ同layerの非blocked配置があり、manual-scriptedなら適格oracleが必要。human oracleの場合は従来のhuman reviewを残す。

replacementが弱い状態でIDだけをcurrent一覧へ戻しても、削除済みtestや未配置testを復帰と扱わない。previous inventoryと正当な引退履歴は保持し、現役判定の変更で過去の実行やproducer原本を書き換えない。

## 承認フェーズ

| phase / 承認状態 | 判定 |
|---|---|
| implementation_preparation | 既存の準備評価を維持。ここでのgoは準備条件の成立で、release承認ではない |
| pre_release_review / 未承認 | package IDをrequiredHumanReviewへ残し、最大conditional_go |
| pre_release_review / 有効なgo承認 | 独立DQ/blocker/reviewが全てなければgo |
| release_decision / 承認なし | 既存のDQ-15 |
| 不正な承認・未来時刻・hash/policy不一致 | DQ-15。schema不正はCLIでDQ-01 |
| go以外の承認文言 | 人間の判断を保存し、package IDをrequiredHumanReviewへ残す。go承認へ自動変換しない |

承認者・役割・判断は非空白で、時刻は実在暦日・timezoneを持ち、評価時計より未来でないことを確認する。承認ID重複はDQ-15。既存のpolicyId/policyHash/evidencePackageHash/sourceRefs検証は独立して適用する。人間の承認をQEGが生成することはない。

DQ > blocker > human review / waiver > goを維持し、未承認review中に手動失敗があればno_go、証拠不備もあればdisqualifiedとする。

## 横断検証表

実装単位ではなく次の契約行を受入単位にする。[共通matrix](../../tests/helpers/manual-governance-matrix.mjs)をCLI/API、Action、tarball CLI/API/Action、初期化runtimeへ適用する。

| 契約行 / matrix | 正常 | 欠落・空白 | 失敗・未完了 | 矛盾 | 状態遷移・出力 |
|---|---|---|---|---|---|
| 手動入力 / shape | 完全な手動入力 | 4項目それぞれ省略・空値、null型 | 未知result | 不明case/trace、空白refs | record/schema-checkまでDQ-08を保持 |
| 手動結果 / results | pass、通常実行との一致 | 必須実行なし | 4状態、通常pass/failとの全8組 | 同一caseの競合、入力順序交換 | fail記録、重複失敗blockerを防止 |
| review根拠 / review | 対応riskの有効note | 省略/空白note、trace省略 | fail/blocked/skipped note | 不備のあるnoteでDQ-04を解除しない | 不足入力のrecord出力 |
| 復帰 / inventory | 引退履歴・現役復帰 | 不明ID・配置なし | 弱いreplacement、mock | deleted/current矛盾、重複ID | 引退→劣化→復帰、human oracle、blocked配置 |
| 承認 / phase | 3phase×承認有無 | 承認者/権限/判断の空白 | 未承認・go以外の判断 | 3hash/ID不一致、未来、重複 | review→承認→release、DQ/blocker優先、record |

既存の期待値と過去の受入JSONは保持する。schema-validであること、verifierが扱うartifactの検証成功、判定結果、recordのschema-validを別々に確認する。合成入力の試験を実producer・本番・人間QAの証拠へ昇格しない。
