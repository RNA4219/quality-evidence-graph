---
intent_id: INT-QEG-RELIABILITY-HARDENING-CHECKLIST-001
owner: quality-evidence-graph
status: active
profile: standard,strict,ipo_controlled
last_reviewed_at: 2026-07-19
next_review_due: 2026-10-19
---

# Reliability / Resilience hardening 実装チェックリスト

## 1. 運用規則

- 正本は `docs/spec/reliability-extension.md` と `docs/spec/reliability-hardening.md` とする。
- `[x]` にするには、同じ行または証跡表へ file、test、fixture、commit、CI のいずれかを記録する。
- 実装中の仮確認は `[ ]` のままとし、「ローカルだけ成功」と「最新 commit の CI 成功」を区別する。
- fixture 成功を実環境の resilience acceptance として記録しない。
- release、tag、publish、merge、実 cluster 操作はこのチェックリストの範囲外とする。

## 2. 仕様・互換性

- [x] 元仕様の DQ-18 / DQ-19 / DQ-21 責務が hardening 仕様と一致している。
- [x] evidence join は `testId` を判定用正本、`evidenced_by` edge を provenance としている。
- [x] `status` が outcome の正本で、`passed` 未指定を許容している。
- [x] `error` / `timeout` / `skipped` の qualification が決定済みである。
- [x] package version `0.2.0` と `qegVersion` `0.2` を維持している。
- [x] legacy fixture の verdict、exit code、wire shape が不変である。

## 3. 公開 TypeScript 型

- [x] `LegacyTestNode` / `ResilienceTestNode` を公開している。
- [x] `TestNode` が discriminator union である。
- [x] `LegacyExecutionEvidenceNode` / `ResilienceExecutionEvidenceNode` を公開している。
- [x] `ExecutionEvidenceNode` が discriminator union である。
- [x] `QegNode` から `testType=resilience` で `resilienceScenario` へ narrow できる。
- [x] `QegNode` から `evidenceType=resilience` で signal / fault field へ narrow できる。
- [x] discriminator なしの legacy object が引き続き compile する。
- [x] packed tarball の `.d.ts` を consumer fixture で compile できる。

## 4. validation 責務分離

- [x] intra-node semantic rule の一覧と安定 rule ID が定義されている。
- [x] duplicate SLO / signal / abort ID の検証実装が一箇所である。
- [x] static range と `status` / `passed` の検証実装が一箇所である。
- [x] cross-node / policy validation が schema helper に混入していない。
- [x] validation helper は pure で input を変更しない。
- [x] schema invalid は DQ-01、artifact invalid は DQ-06 として分離されている。

## 5. evaluator 分割

- [x] `contracts.ts` に internal stage 型がある。
- [x] `indexing.ts` が risk / test / evidence index だけを担当する。
- [x] `selection.ts` が base / current / latest / fingerprint だけを担当する。
- [x] `qualification.ts` が lifecycle、environment、policy identity を担当する。
- [x] `signals.ts` が signal resolve と observed 照合を担当する。
- [x] `blockers.ts` が BLK-REL-01〜04 と waiver eligibility を担当する。
- [x] `accounting.ts` が counts、rates、percentile、drill-down だけを担当する。
- [x] `src/gate/reliability.ts` は facade であり、stage logic を重複して持たない。
- [x] stage output ordering が risk / test / evidence / rule ID で deterministic である。
- [x] programmatic evaluation に verification report がない場合 DQ-06 になる。

## 6. DQ / blocker contract

- [x] DQ-18 が candidate、freshness、environment、lifecycle、abort を担当する。
- [x] DQ-19 が selection ambiguity だけを担当する。
- [x] DQ-20 が observed / signal だけを担当する。
- [x] DQ-21 が policy identity だけを担当する。
- [x] 同一原因の DQ が優先順位に従って一件へ抑制される。
- [x] `passed` 未指定の `status=pass` は producer outcome の pass 候補になる。
- [x] non-completing status は field 不足による DQ ではなく BLK-REL-03 になる。
- [x] recovery の不成立と時系列矛盾が BLK-REL-02 / DQ-18 に正しく分かれる。
- [x] trace / log abort の aggregation、unit、matchedCount を再検証する。
- [x] current revision の全 real attempt へ BLK-REL-04 を適用する。
- [x] BLK-REL-01〜03 の waiver は risk ID と test ID の双方を要求する。
- [x] BLK-REL-04 は waiver 不可である。

## 7. normalize と producer 境界

- [x] input / context の同じ bytes を parse と hash に使う。
- [x] canonical comparison が OS / locale 非依存である。
- [x] path escape と symlink escape が exit 1 になる。
- [x] failure 後に incomplete output / temporary file が残らない。
- [x] error message が raw payload、secret、token、PII を出さない。
- [x] raw / context conflict が exit 1 になる。
- [x] Lakda は HATE/v1 producer mapping に限定されている。
- [x] Toxiproxy は不足値を placeholder で捏造しない。
- [x] shell / CI は versioned envelope だけを受理する。
- [x] unsupported adapter は canonical evidence 直接入力との境界を壊さず exit 1 になる。

## 8. end-to-end fixture

- [x] `positive-reliability-go`
- [x] `positive-legacy-compatible`
- [x] `negative-resilience-artifact-tamper` — DQ-06
- [x] `negative-resilience-revision-mismatch` — DQ-12
- [x] `negative-resilience-mock-only` — DQ-18
- [x] `negative-resilience-stale` — DQ-18
- [x] `negative-resilience-lifecycle` — DQ-18
- [x] `negative-resilience-selection-ambiguous` — DQ-19
- [x] `negative-resilience-signal-missing` — DQ-20
- [x] `negative-resilience-signal-mismatch` — DQ-20
- [x] `negative-resilience-policy-identity` — DQ-21
- [x] `negative-resilience-threshold` — BLK-REL-01 / no_go
- [x] `negative-resilience-recovery` — BLK-REL-02 / no_go
- [x] `negative-resilience-nonpass` — BLK-REL-03 / no_go
- [x] `negative-resilience-safety` — BLK-REL-04 / no_go
- [x] `conditional-resilience-waived-threshold` — conditional_go
- [x] `conditional-resilience-waived-recovery` — conditional_go
- [x] `conditional-resilience-waived-nonpass` — conditional_go
- [x] `negative-resilience-safety-waiver-attempt` — waiver 不可 / no_go
- [x] `negative-resilience-latest-fail` — old pass fallback 禁止
- [x] `negative-resilience-prior-safety-attempt` — prior safety attempt 隠蔽禁止

## 9. report / snapshot

- [x] reliability enabled / disabled の JSON wire shape が固定されている。
- [x] counts、rate、percentile、sample count を JSON / text の双方で出す。
- [x] selected / excluded reason と sourceRefs を出す。
- [x] blocker instance ID と ruleId、riskId、testId、evidenceId、effective、waiverId を出す。
- [x] manifest harness が verdict、exitCode、primaryDq、primaryBlocker instance ID、blocker rule set を比較する。
- [x] record と snapshot の round-trip が成功する。
- [x] QEG 自身が生成した JSON を再 parse / schema validation できる。

## 10. ローカル検証

- [x] `npm ci`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run test:runtime`
- [x] `npm run schema-check`
- [x] `npm run enum-check`
- [x] `npm run test:fixtures`
- [x] `npm run test:package`
- [x] `npm run birdseye-check`
- [x] repository JSON parse
- [x] package dry-run
- [x] `git diff --check`

## 11. CI と完了証跡

- [x] 最新の code-bearing commit SHA を記録した。
- [x] 当該 code-bearing commit の GitHub Actions `quality (20)` が SUCCESS。
- [x] 当該 code-bearing commit の GitHub Actions `quality (24)` が SUCCESS。
- [ ] 証跡を記録した docs-only commit を draft PR へ push した。
- [ ] draft PR の最新 docs-only commit でも `quality (20)` / `quality (24)` が SUCCESS。
- [x] cancelled / skipped / 過去 commit の run を完了証跡に使っていない。
- [x] release、tag、publish、merge を実行していない。

| Evidence | Value | Verified at | Status |
|---|---|---|---|
| Latest code-bearing commit | `4f4090e94e46cb17e8eacbdc8062259fc19cc26b` | 2026-07-19 | success |
| Draft PR | [#3](https://github.com/RNA4219/quality-evidence-graph/pull/3) | 2026-07-19 | draft |
| Code-bearing quality (20) | [run 29694500358 / job 88212782450](https://github.com/RNA4219/quality-evidence-graph/actions/runs/29694500358/job/88212782450) | 2026-07-19 | SUCCESS |
| Code-bearing quality (24) | [run 29694500358 / job 88212782412](https://github.com/RNA4219/quality-evidence-graph/actions/runs/29694500358/job/88212782412) | 2026-07-19 | SUCCESS |
| Latest docs-only quality (20) | PR latest check で外部確認 | - | pending |
| Latest docs-only quality (24) | PR latest check で外部確認 | - | pending |
| Local verification log | `npm ci`、全12 gate、34 runtime、52 fixture（21 reliability E2E）、530 tracked JSON | 2026-07-19 | success |

## 12. 停止条件

次のいずれかがある状態で完了扱いにしてはならない。

- DQ ownership が複数 module に重複している。
- public type narrowing または legacy assignability が未検証である。
- 上表の主要 failure mode が runtime mutation test にしか存在しない。
- latest commit の Node 20 / 24 のどちらかが未成功である。
- fixture artifact を real environment acceptance と誤表示している。
- Lakda adapter が HATE/v1 producer の境界を越えている。
