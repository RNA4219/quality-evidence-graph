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
- 証跡判定の受入単位（EAC-01〜07/11/12）：implemented。型/schema/adapter/evaluator/report、TC-01〜18/25を対象とするテストを追加。現在commitのCI確認までacceptedとしない。
- 別build・未来実行の既知不一致2件を修正し、古いfail→新しいpassでは最新passを採用する。採用・除外ID/理由をGate/record/reportへ保持する。
- ローカルWindows Node 24でruntime/Action 107 tests、公開型・tarball consumer試験が成功。source commitとCIは後続の受入記録で結び付ける。
- 出力復旧（EAC-08）の中断・競合、実producer接続（EAC-09）、一般consumerのdry-run移行（EAC-10）は未評価。既存の出力復旧試験や合成fixtureを追加受入の代用にしない。

## 要求・受入対応

| 要求 | 対象 | 必要ケース | 状況 |
|---|---|---|---|
| EAC-01 | build/revision/feature/case/environment | TC-01〜03/16 | implemented / ローカル試験成功 |
| EAC-02 | 評価時計・未来・期限 | TC-04〜06/10 | implemented / ローカル試験成功 |
| EAC-03 | 最新実行・履歴・競合 | TC-07〜13/16 | implemented / ローカル試験成功 |
| EAC-04 | 要求からrawまでのjoin | TC-03/11/14 | implemented / ローカル試験成功 |
| EAC-05 | raw/参照先・producer契約 | TC-02/15 | implemented / ローカル試験成功 |
| EAC-06 | pass/fail/未実行/mock | TC-07〜09/13/14/17 | implemented / ローカル試験成功 |
| EAC-07 | 決定性 | TC-12/18 | implemented / ローカル試験成功 |
| EAC-08 | 世代の完全性・復旧・競合 | TC-19〜22 | defined / 中断・競合未評価 |
| EAC-09 | 実producerの接続証明 | TC-23 | defined / 実接続受入未実施 |
| EAC-10 | consumer移行 | TC-24 | defined / 移行支援未実装 |
| EAC-11 | waiver/approval/retention/profile | TC-13/17/25 | implemented / profile・waiver回帰成功 |
| EAC-12 | revisionに結び付く完了証拠 | TC-18/25、各受入単位 | implemented / source・CIの封印待ち |

実装写像は[execution-qualification.md](../spec/execution-qualification.md)。`tests/execution-qualification.test.mjs`がEAC境界、`tests/producer-pipeline.test.mjs`が3producerの写像、`tests/package-smoke.mjs`が配布物を検証する。引退判定の3fixtureだけを明示policy・合成実行へ移行し、元のverdict/DQ/blocker/残余リスク/人間確認のoracleを照合して維持した。集計成功数だけでは引退を認めない。

承認者・retention・waiver期限等の既存契約を緩和せず、全profileで対象/時刻/実体のDQを優先する。scopeは合成fixtureと隔離consumer/Action。実producerの実行versionや実環境の成功を主張しない。

## 基準制定前の観測

[baseline-observations.json](../evidence/evidence-acceptance-2026-09-10/baseline-observations.json)は、既に実行した追加調査の記録を転記したもの。現在の新基準ケースを実行した証拠ではない。

| 観測 | schema / artifact検証 | 当時の結果 | 新基準との差 |
|---|---|---|---|
| 正常対照 | valid / pass | go / 0 | 比較用 |
| 異なるbuildのmanual実行 | valid / pass | go / 0 | EAC-01ではDQを要求 |
| 評価時計より1年未来のmanual実行 | valid / pass | go / 0 | EAC-02ではDQを要求 |
| 古いfailと新しいpassを併記 | valid / pass | no_go / 2 | EAC-03で採用と履歴を分ける。これは従来仕様の挙動 |

実装後は基準version・TC/subcase・source commit・実行結果と証拠を対応付けて追記する。旧baselineを修正後の結果で上書きしない。
