---
intent_id: INT-QEG-MANUAL-GOVERNANCE-FIXES-20260911
owner: quality-evidence-graph
status: accepted
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# R25〜R28 包括的改修・受入

main 71199ece186771dc36a54dd3342987002d60ecf1の追加レビューで確認した4件を、[入力から判定までの契約表](../spec/manual-evidence-and-review.md)に沿って修正する。レビュー原本37入力・73 CLI実行・559ファイルはworkspace artifacts/qeg-postmerge-review5-20260911へ保持する。

| ID | 修正対象 | 横断確認 |
|---|---|---|
| R25 | 省略された手動証拠の配列参照例外 | schema/型/runtime、DQ-04とDQ-08、record/backlink |
| R26 | 手動結果の未反映 | 4状態、通常実行との組合せ、重複/競合、reviewerNote、判定優先順位 |
| R27 | current inventoryだけによる誤復帰 | 実体・deleted・real/manual・配置・oracle、劣化と復帰 |
| R28 | 未承認pre_release_reviewのgo | phase/承認、空白/不正/不一致/未来/重複、requiredHumanReviewと記録 |

R25〜R28を受入済み。source commit d845bda8436283c3883a08bbcbf7494ed89abdab の[CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34590905384)は3job全step成功。233 runtime nodes・62 fixtures・CLI/API/Action/tarball/初期化runtimeとlifecycleを検証した。

IPOへの影響: 手動結果や復帰文字列で誤goを出さず、承認前reviewを最大conditional_goにする。waiverはDQと手動失敗を消さず、approval binding・retention・producer原本を保持する。implementation_preparationのgoは準備評価であり、release承認ではない。package 0.4.0未公開 / wire 0.2を維持する。

検証ログはworkspace artifacts/qeg-manual-governance-fixes-20260911へ保持する。実producer・本番実行・人間QA・全依存関係のセキュリティ監査は範囲外。今回の受入で不具合ゼロを宣言しない。
