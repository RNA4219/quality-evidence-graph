---
intent_id: INT-QEG-EVIDENCE-ACCEPTANCE-STATUS-001
owner: quality-evidence-graph
status: implemented
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# 証跡共通基準の実装・受入状況

正本は[共通受入基準](../spec/evidence-acceptance-standard.md)。EAC-08〜10と実接続で判明した時刻・ID・形式の差を一括で実装した。現在は最終の統合検証・CIを実施中で、source commitに結び付く判定は[今回の証拠](../evidence/eac-completion-2026-09-10/validation.json)へ記録する。

| 要求 | 対象 | 必要ケース | 状況 |
|---|---|---|---|
| EAC-01 | build/revision/feature/case/environment | TC-01〜03/16 | PR #8 accepted。実producerの短縮revisionを明示解決する追加を検証 |
| EAC-02 | 評価時計・未来・期限 | TC-04〜06/10 | PR #8 accepted。小数秒1〜9桁、1ns未来・期限・最新順を追加 |
| EAC-03 | 最新実行・履歴・競合 | TC-07〜13/16 | PR #8 accepted。microsecondを丸めず比較 |
| EAC-04 | 要求からrawまでのjoin | TC-03/11/14 | PR #8 accepted。原本を変えないsource ID対応を追加 |
| EAC-05 | raw/参照先・producer契約 | TC-02/15 | PR #8 accepted。CTG YAML原本のhash/schema検証を追加 |
| EAC-06 | pass/fail/未実行/mock | TC-07〜09/13/14/17 | accepted。今回も既存統制を回帰検証 |
| EAC-07 | 決定性 | TC-12/18 | accepted。API/CLI/packedと固定再生を照合 |
| EAC-08 | 世代の完全性・復旧・競合 | TC-19〜22 | implemented / 最終CI待ち |
| EAC-09 | 実producerの接続証明 | TC-23 | implemented / 実2回と固定再生を照合、最終CI待ち |
| EAC-10 | consumer移行 | TC-24 | implemented / dry-run・適用・中断再実行・冪等性、最終CI待ち |
| EAC-11 | waiver/approval/retention/profile | TC-13/17/25 | accepted。移行でも承認原本と履歴を保持 |
| EAC-12 | revisionに結び付く完了証拠 | TC-18/25、各受入単位 | 今回のsource commit・CIによる封印待ち |

実装写像と操作は[統合契約](../spec/output-publication-and-migration.md)。追加試験は`output-publication.test.mjs`、`consumer-migration.test.mjs`、`producer-replay.test.mjs`。公開型と配布物のAPI/CLI/Actionも検証する。実行件数はnode:testの親test/subtestを含み、TC群数と混同しない。

## 実接続の証明範囲

[producer-replay](../evidence/eac-completion-2026-09-10/producer-replay/)に、RanD 0.3.0、code-to-gate 1.5.1、manual-bb 3.0.0の固定sourceから得た14原本×2回、target/build/revision、各run、hash、command、CLI観測を保存した。producerの作業中変更を取り込まず、source lockを実行前後に照合した。

同じ隔離CLIの`41 → 42`を2回実行し、manual実行は資格を満たすpassとして採用された。上流のstatic artifactにはpartial、RanDには未被覆の要求仮説があるため、期待するQEG判定は**disqualified / exit 2**。APIとCLIは同じ拒否を返す。上流原本の不足を修正してgoに見せる操作はしていない。これは実接続と不合格伝播の受入であり、対象のrelease承認、実環境、人間が実施したQAを主張しない。合成正常系は別試験で維持する。

## 既存の受入履歴

PR #8でEAC-01〜07/11/12を受入済み。実装commitは`553aeeda7c53e66e80d966d62c825ce60fa1f301`、mergeは`acb15d7047b9d734e62801acba8af9a42be1dde2`。[実装CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34422747335)、[main CI](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34423757979)はLinux Node20/24とWindows Node24の3job成功。当時はruntime 107 tests、53 fixtures、公開型・packed consumer・JSON・静的解析を検証した。

別buildと未来時刻の不一致を修正し、古いfail→新passの最新採用を実装した記録は[旧validation](../evidence/evidence-acceptance-2026-09-10/validation.json)と[4ケース実測](../evidence/evidence-acceptance-2026-09-10/execution-results.json)を保持する。[4054df7の変更前観測](../evidence/evidence-acceptance-2026-09-10/baseline-observations.json)と[R01〜R06の受入](remediation-2026-09-10.md)は履歴であり、今回の試験成功の代用にはしない。
