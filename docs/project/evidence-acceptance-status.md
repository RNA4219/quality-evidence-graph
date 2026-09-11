---
intent_id: INT-QEG-EVIDENCE-ACCEPTANCE-STATUS-001
owner: quality-evidence-graph
status: accepted
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# 証跡共通基準の実装・受入状況

正本は[共通受入基準](../spec/evidence-acceptance-standard.md)。[R8〜R13のCLI境界改修](cli-boundary-fixes-2026-09-11.md)を受入済み。source commit bce4012e6788d7515375a1311afc6d9c5155edb1 の[CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34559142365)はLinux Node20/24・Windows Node24の3job全step成功。[今回の証拠](../evidence/cli-boundary-fixes-2026-09-11/validation.json)にsource/runtime tree/全stepを固定し、R1〜R7と実producer原本は履歴として保持する。

| 要求 | 対象 | 必要ケース | 状況 |
|---|---|---|---|
| EAC-01 | build/revision/feature/case/environment | TC-01〜03/16 | PR #8 accepted。実producerの短縮revisionを明示解決する追加を検証 |
| EAC-02 | 評価時計・未来・期限 | TC-04〜06/10 | PR #8 accepted。小数秒1〜9桁、1ns未来・期限・最新順を追加 |
| EAC-03 | 最新実行・履歴・競合 | TC-07〜13/16 | PR #8 accepted。microsecondを丸めず比較 |
| EAC-04 | 要求からrawまでのjoin | TC-03/11/14、R4 | 別objectのmanifest mappingを全phaseで採用。accepted（今回のsource CIで検証） |
| EAC-05 | raw/参照先・producer契約 | TC-02/15 | PR #8 accepted。CTG YAML原本のhash/schema検証を追加 |
| EAC-06 | pass/fail/未実行/mock | TC-07〜09/13/14/17 | accepted。今回も既存統制を回帰検証 |
| EAC-07 | 決定性 | TC-12/18、R4 | API/CLIのmapping不一致を修正。accepted（今回のsource CIで検証） |
| EAC-08 | 世代の完全性・復旧・競合 | TC-19〜22、R1/2/6 | 前世代4種からの復旧でnative入力を保護し、古い世代と異なる場合は再評価を要求。accepted（今回のsource CIで検証） |
| EAC-09 | 実producerの接続証明 | TC-23 | accepted。実2回と固定再生を照合。下記の接続・拒否伝播範囲 |
| EAC-10 | consumer移行 | TC-24、R2/3/6 | 中断復旧が明示native編集を巻き戻さないことと、producer再実行を追加検証。accepted（今回のsource CIで検証） |
| EAC-11 | waiver/approval/retention/profile | TC-13/17/25 | accepted。移行でも承認原本と履歴を保持 |
| EAC-12 | revisionに結び付く完了証拠 | TC-18/25、各受入単位 | accepted。R8〜R13のsource commit・CI・runtime treeを今回の証拠へ固定 |
| C-15 | 差分対象の選択 | R5a/b/8 | cwd/Git rootを正規化し、root/子階層/target自身を共通matrixで検証。accepted（今回のsource CIで検証） |
| C-19 | 再現資料の完全性 | R7/13 | 同名targetの分離と全hashを維持し、配布物のschema/metadataを使用。accepted（今回のsource CIで検証） |
| C-06 | 親指定の対象収集 | R9 | 管理済みconsumerの入力欠落・不正も診断に残す。accepted（今回のsource CIで検証） |
| C-14/17 | baseline資格と対象 | R10/11 | 共通schema/owner/期限/target検証と完全path一致。accepted（今回のsource CIで検証） |
| C-18 | 差分の解消証明 | R12 | 未選択・評価不能はunverifiedとして表示。accepted（今回のsource CIで検証） |
| C-07/10/22 | 配布後の診断 | R13 | source/tarball/Action/初期化runtimeで共通診断。accepted（今回のsource CIで検証） |

実装写像と操作は[統合契約](../spec/output-publication-and-migration.md)。実行件数はnode:testの親test/subtestを含み、TC群数と混同しない。最終の文書sealはruntime treeを維持し、PR最新CIとmerge後main CIは外部で確認する。

## 実接続の証明範囲

[producer-replay](../evidence/eac-completion-2026-09-10/producer-replay/)に、RanD 0.3.0、code-to-gate 1.5.1、manual-bb 3.0.0の固定sourceから得た14原本×2回、target/build/revision、各run、hash、command、CLI観測を保存した。producerの作業中変更を取り込まず、source lockを実行前後に照合した。

同じ隔離CLIの`41 → 42`を2回実行し、manual実行は資格を満たすpassとして採用された。上流のstatic artifactにはpartial、RanDには未被覆の要求仮説があるため、期待するQEG判定は**disqualified / exit 2**。APIとCLIは同じ拒否を返す。上流原本の不足を修正してgoに見せる操作はしていない。これは実接続と不合格伝播の受入であり、対象のrelease承認、実環境、人間が実施したQAを主張しない。合成正常系は別試験で維持する。

## 既存の受入履歴

PR #11はR5〜R7の追加条件に対応した修正。source `f89e82219d80eff5e2085a73194915e992942483`の[CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34552047197)と[merge後main CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34552754114)は3job全step成功。[当時の証拠](../evidence/followup-fixes-2026-09-11/validation.json)はruntime186件・53fixturesを固定している。今回の6件はCLIの実行場所・対象収集・例外設定・配布形態の未検証組合せであり、共通matrixで補完する。

PR #10はR1〜R4の再現条件に対応した修正。source commit `4da7cca488efb3680b0c581a211faa41b812d206`の[CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34544057648)と[merge後main CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34544849095)は3job全step成功。[当時の証拠](../evidence/review-fixes-2026-09-11/validation.json)はruntime 165 tests・53 fixturesを固定している。R6はその復旧試験に含まれなかった前世代とnative編集の組合せであり、今回補完する。

PR #9ではsource commit `643a47d741a1e016f43a6bdb63f67d485e4c304f`の[CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34428936447)が3job全step成功。当時はruntime 147 tests、53 fixture contracts（22 reliability）、公開型・隔離tarball・Action lifecycle・19 schemas・enum・808 tracked JSON・Birdseye 234 source hashesを検証した。[前回証拠](../evidence/eac-completion-2026-09-10/validation.json)の実producer原本と実行結果は保持する。R1〜R4はその試験範囲の抜けであり、今回の追加試験で補う。

PR #8でEAC-01〜07/11/12を受入済み。実装commitは`553aeeda7c53e66e80d966d62c825ce60fa1f301`、mergeは`acb15d7047b9d734e62801acba8af9a42be1dde2`。[実装CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34422747335)、[main CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34423757979)はLinux Node20/24とWindows Node24の3job成功。当時はruntime 107 tests、53 fixtures、公開型・packed consumer・JSON・静的解析を検証した。

別buildと未来時刻の不一致を修正し、古いfail→新passの最新採用を実装した記録は[旧validation](../evidence/evidence-acceptance-2026-09-10/validation.json)と[4ケース実測](../evidence/evidence-acceptance-2026-09-10/execution-results.json)を保持する。[4054df7の変更前観測](../evidence/evidence-acceptance-2026-09-10/baseline-observations.json)と[R01〜R06の受入](remediation-2026-09-10.md)は履歴であり、今回の試験成功の代用にはしない。
