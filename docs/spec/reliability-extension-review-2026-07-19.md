---
intent_id: INT-QEG-RELIABILITY-REVIEW-2026-07-19
owner: quality-evidence-graph
status: superseded
profile: standard,strict,ipo_controlled
last_reviewed_at: 2026-07-19
next_review_due: 2026-10-19
---

# Reliability / Resilience 拡張仕様レビュー

> この文書は初期仕様レビュー時点の履歴である。現在の実装修正 contract と未完了項目は `docs/spec/reliability-hardening.md` および `docs/spec/reliability-hardening-checklist.md` を正本とする。

## 1. 対象

- docs/research/QEG Reliability Resilience 拡張要件定義.md
- docs/spec/reliability-extension.md
- docs/requirements.md
- docs/spec/gate-policy.md
- schemas/qeg.bundle.schema.json
- schemas/gate-policy.schema.json
- schemas/shared-defs.schema.json
- src/types/graph.ts
- src/types/gate.ts
- src/types/evidence.ts
- src/gate/evaluate.ts

## 2. レビュー結果

| ID | Finding | Resolution |
|---|---|---|
| REL-R01 | resilience evidence に schema discriminator がなく、legacy evidence と条件付き必須 field を分離できない | evidenceType=resilience を追加し、schema validation と evaluator validation の境界を固定した |
| REL-R02 | revision_mismatch の新 DQ が既存 DQ-12 と重複する | revision mismatch は DQ-12 を再利用し、新 DQ を作らない |
| REL-R03 | mock_not_allowed が既存 P-16 の mock exclusion と衝突する | mock 自体は監査記録に残し、必須 risk が mock-only の場合だけ DQ-18 とする |
| REL-R04 | freshness が wall clock に依存し、同一入力で verdict が変化する | metadata.createdAt を唯一の evaluationTime とした |
| REL-R05 | risk、failure mode、test、evidence の join 条件が曖昧 | coveredRiskIds と requires_test trace path、testId と evidenced_by edge の二重一致を必須化した |
| REL-R06 | abort condition が自由記述式で、QEG が式評価器になり得る | signal、operator、threshold、unit の構造化 contract に変更した |
| REL-R07 | declared blast radius だけでは実際の safety 違反を検出できない | actualTargetIds、fault timestamp、appliedDurationMs、environment を evidence に必須化した |
| REL-R08 | observed と signal artifact のどちらが正本か不明 | hash 付き signalManifest を正本とし、observed は一致検証する summary とした |
| REL-R09 | latest evidence の選択と旧 pass fallback が未定義 | endedAt 最大を採用し、同時刻競合は DQ-19、旧 pass fallback は禁止した |
| REL-R10 | DQ-18 と specific DQ が同じ原因で重複し得る | DQ の優先順位と同一原因の重複抑止を固定した |
| REL-R11 | pass-rate の分母から fail / blocker を除外する記述があり、成功率が過大になる | DQ / mock / stale だけを除外し、fail / aborted / blocker を分母に含めた |
| REL-R12 | percentile 算出方法が未定義 | nearest-rank 法と N=0 の null を固定した |
| REL-R13 | production safety policy の例外経路が曖昧 | MVP は forbidProduction=true 固定、waiver 解除不可とした |
| REL-R14 | safety violation が後続 pass で隠れる | current revision の全 real evidence に BLK-REL-04 を適用した |
| REL-R15 | DQ と blocker の waiver 可否が曖昧 | DQ と BLK-REL-04 は waiver 不可、BLK-REL-01〜03 は最大 conditional_go とした |
| REL-R16 | golden signals の saturation が observed / threshold contract から漏れている | saturationPct、saturation semanticRole、maxSaturationPct を必須化した |
| REL-R17 | risk coverage と execution pass rate が同じ分母で表現されていた | riskCoverageRate と resiliencePassRate を分離し、分子・分母を固定した |
| REL-R18 | traffic が 0 件でも error rate 0 として pass できる | policy.thresholds.minRequestCount を必須化し、BLK-REL-01 で評価する |
| REL-R19 | testId、revision、environmentId 単位の grouping では 1 test から複数 selected evidence が生じ、pass-rate 分母が不定になる | required resilience test ごとに current candidate 全体から latest 1 件だけを選ぶ規則へ変更した |
| REL-R20 | metadata.policyId / policyHash が未指定でも相互一致扱いになり得る | reliabilityPolicy 有効時は metadata の policyId / sha256 policyHash を必須化し、input policy、top-level metadata、graph.metadata の 3 者一致を要求した |
| REL-R21 | abortRecord が実測 signal entry と結び付かず、自己申告だけで abort を正当化できる | signal entry id / signalName と abortRecord.signalEntryId を追加し、値・window・operator の再検証を必須化した |
| REL-R22 | SLO をどの lifecycle phase で評価するか未定義 | evaluationPhases を必須化し、steady_state / fault / recovery の DQ・blocker 対応を固定した |
| REL-R23 | generic node の additionalProperties=true により resilience field の typo を受理し得る | discriminator branch だけ base field と extension field を列挙して additionalProperties=false とした |
| REL-R24 | raw / signal artifact の相対 path の解決基準が fixture または repo root と二通りあった | gate-input.json を含む Gate target directory を唯一の base directory とした |
| REL-R25 | selected evidence 外の safety violation を blocker にしても pass-rate が 100% と表示され得る | BLK-REL-04 が指す test / risk を passing count から除外すると固定した |
| REL-R26 | requiredSignals.metrics=false で decision-grade 観測を無効化できる | metrics、revision match、steady state、recovery observation は MVP で true 固定とした |
| REL-R27 | DQ-19 と DQ-21 の timestamp 不正条件が重なっていた | startedAt / endedAt の envelope と freshness は DQ-19、fault / abort / recovery 内部時系列は DQ-21 に分離した |
| REL-R28 | frontmatter は lean を対象外にする一方、policy contract に禁止規則がなかった | reliabilityPolicy は standard / strict / ipo_controlled のみで有効化可能とした |

## 3. 決定済み contract

- QEG は experiment runner ではなく validator、accountant、judge である。
- reliabilityPolicy の存在が機能有効化を意味し、enabled=false は使わない。
- metrics、revision match、steady state confirmation、recovery observation は MVP で true 固定とし、判定資格を policy で緩和しない。
- Gate coverage の environment は requiredEnvironment で 1 件に固定する。
- selected evidence は required resilience test ごとに最大 1 件とし、current revision の latest を採用する。
- evidence targetRevision と signal revision は metadata.headRef に完全一致する。
- policy identity は input policy、top-level metadata、graph.metadata の 3 者で一致する。
- reliabilityPolicy は standard、strict、ipo_controlled だけで有効化し、lean では schema invalid とする。
- evidence の fault duration と recovery duration は integer millisecond で保持し、policy threshold と report は second に換算する。
- schema invalid は DQ-01、cross-node / policy qualification は DQ-12、DQ-18〜DQ-21または blocker で判定する。
- report は選択根拠、除外根拠、分母、分子、percentile sample count を出力する。

## 4. 残リスク

| Risk | Status | Required evidence |
|---|---|---|
| JSON Schema と TypeScript 型は未実装 | open | schema-check、enum-check、typecheck、legacy fixture regression |
| DQ-18〜DQ-21 と blocker evaluator は未実装 | open | positive / negative fixture と Gate snapshot |
| adapter 固有 raw payload mapping は未検証 | open | Lakda / Toxiproxy / shell / CI contract fixture |
| evidence normalize CLI は未実装 | open | unreadable / unsupported / schema-invalid の exit 1 と atomic output test |
| signal artifact hash / revision verification は未実装 | open | tamper、revision mismatch、redaction fixture |
| report accounting は未実装 | open | pass-rate、nearest-rank、latest selection snapshot |

## 5. Gate 判定

| Gate | Verdict | Reason |
|---|---|---|
| Specification review | go | discriminator、boundary、DQ / blocker、selection、aggregation、安全規則の主要判断が閉じた |
| Implementation preparation | go | 実装対象、順序、fixture、受入条件が固定された |
| Implementation completion | no_go | schema、types、evaluator、CLI、fixture が未実装 |
| Release | no_go | 実行証跡と回帰テストが存在しない |

この review の go は実装着手可能を意味し、QEG release または resilience 品質の承認を意味しない。
