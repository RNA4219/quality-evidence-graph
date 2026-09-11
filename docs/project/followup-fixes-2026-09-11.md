---
intent_id: INT-QEG-FOLLOWUP-FIXES-20260911
owner: quality-evidence-graph
status: implemented
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# R5〜R7 の一括修正・受入

PR #10のmerge commit `e42359872f51d9d1bb1251325fa67d0040b0a6ed`に対する追加レビューで、3系統・4ケースを再現した。前回の165 runtime tests・53 fixture contracts・main CIは成功していたが、以下の条件は含んでいなかった。

| 指摘 / 要求 | 変更前の実測 | 修正と追加検証 |
|---|---|---|
| R5a / P1 / C-15 | 通常reportは不正JSONでexit 1、changed-onlyは対象0件としてexit 0 | 読取り・schema・世代状態で関連性が不確かな入力を通常評価へ回す。欠落、不正JSON、schema不正、公開中と中断状態を検証 |
| R5b / P1 / C-15 | Gitが削除Dを返しても、差分検査では変更0件になりexit 0 | Dを含め、renameを削除+追加として両pathを採用。NUL区切りで日本語・空白を保持。origin/main・親commit・worktree fallbackを検証 |
| R6 / P1 / EAC-08/10 | 移行→native編集→再移行中断→復旧で、更新前のDQが古い入力のgoへ変わる | journalによるrollbackと出力alias修復を区別し、native入力は古い世代で上書きしない。前世代4種、復旧中断、繰返し、欠落・不正入力、producer再実行を検証 |
| R7 / P2 / C-19 | 同じbasenameの2入力が1ファイルへ上書きされ、manifest hash不一致でもexit 0 | 完全path hashの一意名とsourceTarget、inputErrorsを追加。全bundleを世代公開しhash照合。同名2target、順序を変えた再生成、redaction、書込み失敗、取得失敗を検証 |

試験は[followup-regression](../../tests/followup-regression.test.mjs)。追加21 test nodes（親test/subtestを含む）を既存runtime suiteへ組み込んだ。通常の出力修復でnative入力を戻さない運用変更は[復旧契約](../spec/output-publication-and-migration.md)、差分検査とbundleの変更は[CLI契約](../spec/operational-cli-extensions.md)に定義する。

現時点は実装と追加21件のローカル検証まで完了。全体回帰とLinux Node20/24・Windows Node24 CIを[validation.json](../evidence/followup-fixes-2026-09-11/validation.json)へ固定してから受入を確定する。元のレビューと4ケース実測はworkspaceの`artifacts/qeg-postmerge-review-20260911/`に保持する。

wire 0.2、未公開0.4.0、producer原本と過去のhash付き受入記録は維持する。今回の受入範囲は上記3系統と既存suiteの回帰であり、repository全体の無欠陥、本番deploy、人手QA、電源断やnetwork filesystemの耐久性を主張しない。
