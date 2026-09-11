---
intent_id: INT-QEG-GOVERNANCE-FIXES-20260911
owner: quality-evidence-graph
status: implemented
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# R20〜R24 一括改修・受入

PR #13 merge 7960bd29f971f0191fabbfb15d1ffcdf66697ba3の追加レビューで5件を確認した。22入力・52回の有効CLI実行・22 API評価の原本はworkspace artifacts/qeg-postmerge-review4-20260911/へ保持し、454ファイルのhashを検証した。

| ID | 修正 | 対照条件 |
|---|---|---|
| R20 | 選択testとplacementのlayer不一致をDQ-03 | plan/graph、manual human/missing/specified、生成plan |
| R21 | 自動replacement、replaced_by、subject/policy参照をDQ-14 | 自動4層、手動層、逆向きedge、強度低下、手動復帰 |
| R22 | 厳密な日時・nanosecondでwaiverと評価時計を比較 | 不正暦日、timezone欠落、UTC/Asia-Tokyo、1ns期限、閏年、Date互換 |
| R23 | IPO controlRoles全役割を非空白として検証 | 各役割の空白、object欠落、前後空白付き実名 |
| R24 | unknown保管方式をDQ-16 | immutable/append_only/versioned/mutableの対照 |

[共通matrix](../../tests/helpers/governance-matrix.mjs)をsource CLI/API、Action、tarball CLI/API/Action、初期化runtimeへ適用する。固定fixtureで3種類のDQを追加し、以前の全fixture期待値とdocs/evidence原本を保持する。

現在は実装・ローカル検証中。source commitのLinux Node20/24・Windows Node24 CI完了後に受入を固定する。[validation.json](../evidence/governance-fixes-2026-09-11/validation.json)を正本とする。

契約は[整合仕様](../spec/governance-consistency.md)。IPOの不明保管を失格とし、役割の空白と不正waiver日時を受理しない。approval binding、過去producer原本、package0.4.0未公開 / wire0.2は維持する。本番操作・実producer再実行・人間による手動QAは今回の範囲外。
