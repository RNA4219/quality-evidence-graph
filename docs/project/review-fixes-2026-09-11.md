---
intent_id: INT-QEG-REVIEW-FIXES-20260911
owner: quality-evidence-graph
status: accepted
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# 再レビュー R1〜R4 の修正・追加受入

`d957fc25907e1b678add65eb47f92853dd093d32`では既存147 runtime tests・53 fixture contractsとmain CIが成功していたが、別途の実プロセス試験で次の4件を再現した。旧受入を取り消して原本を編集することはせず、EAC-04/07/08/10の不足ケースを追加し、本記録で補完する。

| 指摘 | 修正前の実測 | 修正と判定基準 | 追加試験 |
|---|---|---|---|
| R1 / P1 / EAC-08 | 配置の入力読取り後に移行成功。その後の配置もexit 0で古いpolicyHashとscopeへ巻き戻す | 入力読取りから公開まで同一leaseを保持。競合移行は明示拒否、後続の適用は保持 | 実place-tests/recordを読取り直後で停止し、移行競合→再開→移行を確認 |
| R2 / P1 / EAC-08/10 | recordの後の移行を入力更新直後に終了。recover後も新入力が残り、旧recordはDQなのにGateはgo | 上書き対象全fileの更新前bytesを永続化。未確定入力でGateを進めず、復旧は入力も戻す | 初回/既存record×入力更新前/後/pointer後、復旧自身の終了、破損journal、再適用 |
| R3 / P2 / EAC-10 | 未定義ID prefixでpreview ready/go・apply成功、実CLIだけexit 1 | previewと実CLIのingest前処理を共通化。blocked時に入力を変更しない | 未定義prefixの拒否と、有効設定のpreview/実Gate一致 |
| R4 / P2 / EAC-04/07 | 別objectのmanifest mappingをAPIが無視。不存在要求へのmappingでAPI go、CLI DQ-01 | 全graph生成でmanifestのid/pathに対応するdescriptorを使用 | loaded.refとmanifestを別objectにし、有効/不正mappingのgraph・parser failureをCLI loaderと照合 |

実装は[出力・移行契約](../spec/output-publication-and-migration.md)、試験は[transaction-regression](../../tests/transaction-regression.test.mjs)と[publication](../../tests/output-publication.test.mjs)。同じfile集合の公開試験だけではR2を検出できず、同じdescriptor objectを共有する試験だけではR4を検出できなかった点を受入基準へ反映した。

R1〜R4を受入済み。source commit `4da7cca488efb3680b0c581a211faa41b812d206`の[CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34544057648)はLinux Node20/24・Windows Node24の3job全step成功。[validation.json](../evidence/review-fixes-2026-09-11/validation.json)にruntime tree、165 runtime tests・53 fixtures・Action lifecycle・型・schema・JSON・Birdseyeの検証を固定した。node:testの実行件数には親test/subtestを含む。

既存producer原本と承認・履歴、wire 0.2、未公開0.4.0の配布状態を維持する。実producer再実行は前回の2回を履歴として参照し、今回はその不変原本の再生を回帰検証する。人手QA・本番deploy・電源断・network filesystem耐久性の受入は含めない。
