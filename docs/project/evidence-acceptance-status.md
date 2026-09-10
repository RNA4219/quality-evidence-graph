---
intent_id: INT-QEG-EVIDENCE-ACCEPTANCE-STATUS-001
owner: quality-evidence-graph
status: in_progress
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# 証跡共通基準の実装・受入状況

正本は [共通受入基準 qeg-evidence-acceptance/v1](../spec/evidence-acceptance-standard.md)。本台帳は追加EAC要求を扱い、[R01〜R06の過去受入](remediation-2026-09-10.md)のCI結果やログを書き換えない。

## 現在の判断

- 基準制定前に調査した実装：`4054df785054e1e5cae73fdf3d375f6a00e42c61`。下表の観測はこのcommitの履歴。
- 証跡判定の受入単位（EAC-01〜07/11/12）：**accepted**。実装commit `553aeeda7c53e66e80d966d62c825ce60fa1f301`で型/schema/adapter/evaluator/reportとTC-01〜18/25を検証。[CI 34422747335](https://github.com/RNA4219/quality-evidence-graph/actions/runs/34422747335)のLinux Node 20/24・Windows Node 24の3 jobが成功した。
- 別build・未来実行の既知不一致2件を修正し、古いfail→新しいpassでは最新passを採用する。採用・除外ID/理由をGate/record/reportへ保持する。
- 同じ実装commitのローカルWindows Node 24で`npm test`成功：runtime/Action 107 tests、53 fixture、公開型、隔離tarball consumer、JSON。追加の静的解析はfinding 0。Node test件数には親testとsubtestを含む。55件のEAC testが追加分であり、TC表の群数とは区別する。
- 出力復旧（EAC-08）の中断・競合、実producer接続（EAC-09）、一般consumerのdry-run移行（EAC-10）は未評価。既存の出力復旧試験や合成fixtureを追加受入の代用にしない。

## 要求・受入対応

| 要求 | 対象 | 必要ケース | 状況 |
|---|---|---|---|
| EAC-01 | build/revision/feature/case/environment | TC-01〜03/16 | accepted / 今回の証跡判定単位 |
| EAC-02 | 評価時計・未来・期限 | TC-04〜06/10 | accepted / 今回の証跡判定単位 |
| EAC-03 | 最新実行・履歴・競合 | TC-07〜13/16 | accepted / 今回の証跡判定単位 |
| EAC-04 | 要求からrawまでのjoin | TC-03/11/14 | accepted / 今回の証跡判定単位 |
| EAC-05 | raw/参照先・producer契約 | TC-02/15 | accepted / 今回の証跡判定単位 |
| EAC-06 | pass/fail/未実行/mock | TC-07〜09/13/14/17 | accepted / 今回の証跡判定単位 |
| EAC-07 | 決定性 | TC-12/18 | accepted / 今回の証跡判定単位 |
| EAC-08 | 世代の完全性・復旧・競合 | TC-19〜22 | defined / 中断・競合未評価 |
| EAC-09 | 実producerの接続証明 | TC-23 | defined / 実接続受入未実施 |
| EAC-10 | consumer移行 | TC-24 | defined / 移行支援未実装 |
| EAC-11 | waiver/approval/retention/profile | TC-13/17/25 | accepted / profile・waiver・既存統制回帰 |
| EAC-12 | revisionに結び付く完了証拠 | TC-18/25、各受入単位 | accepted / 今回の単位。EAC-08〜10は未受入 |

実装写像は[execution-qualification.md](../spec/execution-qualification.md)。`tests/execution-qualification.test.mjs`がEAC境界、`tests/producer-pipeline.test.mjs`が3producerの写像、`tests/package-smoke.mjs`が配布物を検証する。引退判定の3fixtureだけを明示policy・合成実行へ移行し、元のverdict/DQ/blocker/残余リスク/人間確認のoracleを照合して維持した。集計成功数だけでは引退を認めない。

承認者・retention・waiver期限等の既存契約を緩和せず、全profileで対象/時刻/実体のDQを優先する。scopeは合成fixtureと隔離consumer/Action。実producerの実行versionや実環境の成功を主張しない。

## 受入証拠

[validation.json](../evidence/evidence-acceptance-2026-09-10/validation.json)にsource commit、runtime tree指紋、ローカルlogのhash、CIのjob URL、受入単位と残課題を保存した。[execution-results.json](../evidence/evidence-acceptance-2026-09-10/execution-results.json)はraw→graph→placement→gate→record→schema/hashとpure APIを同じ入力で照合した4ケースの実測。manifest、policy、target、T、producer descriptor、採用/除外理由、期待/実際のexitを含む。

| ケース | 今回の結果 | 比較上の意味 |
|---|---|---|
| TC-01 正常対照 | go / 0 | schema・raw検証・全出力hashが成功 |
| TC-02 別build | disqualified / 2、DQ-12 | raw hashが正しくても対象不一致を拒否 |
| TC-04 未来1ms | disqualified / 2、DQ-05 | 実体が正しくても未来時刻を拒否 |
| TC-07 古いfail→新pass | go / 0、RUN-001採用 | 旧失敗をsupersededとして保持 |

受入者はCodexによる実装・受入照合。本判定はrepo内部の今回の改修単位であり、外部release approvalではない。封印する後続commitではruntime treeが同一であることと、PR #8の最新3 jobの成功を確認してからマージする。

## 基準制定前の観測

[baseline-observations.json](../evidence/evidence-acceptance-2026-09-10/baseline-observations.json)は、既に実行した追加調査の記録を転記したもの。現在の新基準ケースを実行した証拠ではない。

| 観測 | schema / artifact検証 | 当時の結果 | 新基準との差 |
|---|---|---|---|
| 正常対照 | valid / pass | go / 0 | 比較用 |
| 異なるbuildのmanual実行 | valid / pass | go / 0 | EAC-01ではDQを要求 |
| 評価時計より1年未来のmanual実行 | valid / pass | go / 0 | EAC-02ではDQを要求 |
| 古いfailと新しいpassを併記 | valid / pass | no_go / 2 | EAC-03で採用と履歴を分ける。これは従来仕様の挙動 |

基準version・TC/subcase・source commit・実行結果は上記の新しい受入証拠へ対応付けた。旧baselineは修正後の結果で上書きしない。
