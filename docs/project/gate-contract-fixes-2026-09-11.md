---
intent_id: INT-QEG-GATE-CONTRACT-FIXES-20260911
owner: quality-evidence-graph
status: accepted
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# R14〜R19 一括改修・受入

PR #12 merge 3c26458fe78af092aaa763bf7c75c1d0e9d90011の再レビューで6件を確認した。原本はworkspaceのartifacts/qeg-postmerge-review3-20260911/（36 CLI実行、5 API比較）に保持し、今回のvalidation.jsonへhashで結ぶ。6件はいずれも前回変更で導入されたものではなく、既存経路の未検証条件だった。

| ID | 不具合 | 修正・回帰条件 |
|---|---|---|
| R14 / EAC-04 | 別riskしか覆わないtestをsupplied planで採用 | 明示coverage集合の整合をDQ-05で確認。旧native省略・risk由来change・複数test集合の対照を維持 |
| R15 / T-09 | planだけのmanual配置ではoracle検証を省略 | graph/planの双方を評価し、複製・矛盾も確認 |
| R16 / T-09 | human/implicit oracleで確認なしgo | humanはrequiredHumanReview、implicit単独はDQ-14。plannerと共通化し、引退済み履歴は別検証 |
| R17 / EAC-06 | 不正raw statusをcontext passへ置換 | 4 adapterのalias・lifecycle・exitCodeの不正/競合を拒否。正当なpassとfailを維持 |
| R18 / V-08 | 空白approverを有効waiverに算入 | schemaと公開APIで無効化。従来もexit 2だったが、DQを免除する誤りを修正 |
| R19 / EAC-07 | snapshot/checkがcwd変更だけで不一致 | 対象基準の新形式、旧snapshotの読み取り互換、alias/内容変更/自由文の対照 |

[共通matrix](../../tests/helpers/gate-contract-matrix.mjs)をsource CLI、公開API、Action、tarball CLI/API/Actionに適用する。初期化runtimeにもstatus/snapshotを適用する。R14/R15は固定fixtureを追加し、全既存fixtureの期待値を保持する。R17は誤った正規化artifactの生成を確認したもので、下流Gate全体のgoを実証したという主張ではない。

R14〜R19を受入済み。source commit 802e5b04de33a2bd37eaf5e1b34b982b15d7a529 の[CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34564476819)はLinux Node20/24・Windows Node24の3job全step成功。210 runtime nodes・55 fixtures・tarball/API/Action/初期化runtimeとlifecycleを検証した。[validation.json](../evidence/gate-contract-fixes-2026-09-11/validation.json)を正本とする。

契約と移行手順は[整合仕様](../spec/gate-contract-consistency.md)。package0.4.0未公開 / wire0.2を維持する。IPOのwaiver資格を厳格化し、human oracleは確認待ちとする。承認binding・retention・過去producer原本は維持する。実producerの再実行、本番操作、人間の手動QAは今回の受入範囲外。
