---
intent_id: INT-QEG-FIXTURES-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# Fixture Contract

`fixtures/` は adapter、graph、placement、Gate evaluator、record CLI の契約テスト正本を置く。fixture は upstream artifact の意味を QEG 側で再定義せず、QEG が読む最小フィールドと期待 verdict / DQ だけを固定する。

## Directory Layout

| Directory | Purpose | Expected verdict | Required DQ |
|---|---|---|---|
| `positive-release-go/` | 明示的native_graphのhappy path | `go` | none |
| `negative-explicit-placement-coverage/` | 明示coverageが選択obligationと矛盾 | `disqualified` | `DQ-05` |
| `negative-plan-only-manual-oracle/` | planのみのmanual配置でoracle不足 | `disqualified` | `DQ-14` |
| `negative-required-connector-contract/` | 必須接続先の契約違反 | `disqualified` | `DQ-11` |
| `negative-empty-gate-source-refs/` | Gate 関連 sourceRefs 空 | `disqualified` | `DQ-13` |
| `negative-revision-mismatch/` | `base_ref` / `head_ref` と artifact revision 不一致 | `disqualified` | `DQ-12` |
| `negative-producer-check-inconsistent/` | producer check の conclusion / readiness / head SHA 不整合 | `disqualified` | `DQ-12` |
| `negative-producer-check-stale-sha/` | producer check が古い commit SHA に紐づく | `disqualified` | `DQ-12` |
| `negative-manual-scripted-no-oracle/` | manual-scripted case のoracle不足 | `disqualified` | `DQ-14` |
| `positive-prefixed-ids/` | `<producer>:<local-id>` の namespaced ID happy path | `go` | none |
| `positive-placement-change-retirement/` | source-backed な manual→automated 引退記録 | `go` | none |
| `negative-direct-gate-policy/` | 外部 artifact が `gate_policy` を直接持ち込む | `disqualified` | `DQ-01` |
| `negative-unknown-id-prefix/` | 未予約 prefix の stable ID を持つ | validation error | n/a |
| `negative-placement-change-no-evidence/` | `evidence_refs` なしで manual case を引退 | `disqualified` | `DQ-14` |
| `negative-placement-change-unreverted/` | replacement 自動証跡が policy 閾値を割ったのに manual case 未復帰 | `disqualified` | `DQ-14` |
| `negative-manual-case-disappeared/` | `placement_change` なしに manual case が棚卸しから消失 | `disqualified` | `DQ-14` |

## Required Artifact Files

全fixture名と正確な期待値は `manifest.json` が正本。rawの正常系は `../examples/raw-producer-contract/` に次の14種を保持し、`tests/helpers/raw-producer-fixture.mjs` で同じ契約の入力を生成する。過去に本表へ記載した `minimal-valid/` 等は実在せず、今回訂正した。

| Adapter | Artifact files |
|---|---|
| `RanD` | `requirements_packet.json`, `requirements_audit_packet.json` |
| `code-to-gate` | `normalized_repo_graph.json`, `diff_analysis.json`, `findings.json`, `risk_register.json`, `test_seeds.json`, `release_readiness.json`, `audit.json` |
| `manual-bb-test-harness` | `feature_spec.json`, `risk_register.json`, `manual_case_set.json`, `gate_decision.json`, `execution_evidence.json` |
| QEG expected | native fixtureは `expected-gate-verdict.json`、`expected-report.json`、`output-record.json`。rawの期待値はproducer-pipeline試験で検証 |

rawはartifact descriptorが指す相対pathへ置く。producer契約version、hash、revisionの検査を通した後にgraphを生成する。

## Fixture Rules

- 各 artifact は `path`, `schemaId`, `contentHash`, `revision` を QEG metadata に写像できる値を持つ。
- Gate 関連 claim、blocker、disqualification、placement rationale は `sourceRefs` を 1 件以上持つ。
- stable ID は `<producer>:<local-id>` を標準とし、予約 prefix は `rand` / `ctg` / `mbb` / `hate` / `qeg` とする。
- prefix なし ID は deprecation warning 付きで受理する。未知 prefix は validation error として拒否する。
- Gate policy 正本は QEG のみである。外部 artifact の policy 相当情報は `gatePolicyProposal` / `gatePolicyProposals[]` として明示し、verdict には直接影響させない。
- `assumptions` は空配列を許容するが、判定に影響する assumption は expected output 側で `requiredHumanReview` または blocker にする。
- `conditional_go` は accepted waiver、owner、期限、rollback / containment、follow-up を source-backed に持つ場合だけ許容する。
- optional parser failureだけでDQ-01へ昇格しない既存契約をruntime試験で維持する。
- manual case の引退は `placement_changes[]` として記録する。`evidence_refs[]`、policy 参照、revert 条件を持たない引退、または棚卸しからの単純消失は DQ-14 として扱う。
- test node は `testExecutionMode=real|mock` を必須とする。`mock` の replacement は強度・green 回数・risk coverage の値にかかわらず Gate 証跡へ算入せず、manual case 未復帰なら DQ-14 とする。

## Reliability / Resilience hardening matrix

`positive-reliability-go/` を基準に 22 fixture を on-disk E2E で固定する。`positive-legacy-compatible/` は reliability disabled の legacy 互換性を確認する。

- positive: `positive-reliability-go`、`positive-legacy-compatible`
- DQ-06 / DQ-12: `negative-resilience-artifact-tamper`、`negative-resilience-revision-mismatch`
- DQ-18〜DQ-21: `negative-resilience-mock-only`、`negative-resilience-stale`、`negative-resilience-lifecycle`、`negative-resilience-evidenced-by-conflict`、`negative-resilience-selection-ambiguous`、`negative-resilience-signal-missing`、`negative-resilience-signal-mismatch`、`negative-resilience-policy-identity`
- blocker: `negative-resilience-threshold`、`negative-resilience-recovery`、`negative-resilience-nonpass`、`negative-resilience-safety`
- waiver: `conditional-resilience-waived-threshold`、`conditional-resilience-waived-recovery`、`conditional-resilience-waived-nonpass`、`negative-resilience-safety-waiver-attempt`
- selection / safety history: `negative-resilience-latest-fail`、`negative-resilience-prior-safety-attempt`

各 reliability fixture は `validate`、`gate`、一時copy上の `record`、JSON/text `report`、`evidence verify`、`policy lint`、`snapshot` を検証する。expected blocker は ID / message に加えて、指定された `ruleId`、risk / test / evidence、`effective`、`waiverId` を検証する。

fixture と mock の合格は、実cluster、実fault injection、Lakda real acceptance を意味しない。

## Acceptance Commands

R20/R21/R24は`negative-placement-layer-mismatch`、`negative-retirement-manual-replacement`、`negative-retention-unknown`の固定fixtureでDQ-03/14/16を確認する。R22/R23と各正常対照は`tests/helpers/governance-matrix.mjs`をCLI/API/配布物/Actionへ共通適用する。

```sh
npm run typecheck
npm run build
npm run test:runtime
npm run test:fixtures
```

`test:fixtures` は全manifest fixtureのexpected verdictとsnapshotを比較し、CLI入力エラー以外の全fixtureでrecordと全生成JSONのschema、DQ/blockerのsourceRefsを検証する。reliability matrixでは各commandのexit code、report、accountingも検証する。

0.4.0では既存53 fixtureにnative_graphの入力契約と評価scopeを明示した。別の失格理由を検査する旧空graphには要件context nodeを追加し、引退履歴には削除済みtest nodeを保持した。manual oracle不足fixtureには参照先obligationを補い、DQ-14だけを評価できるようにした。既存の期待verdict・DQ・blockerは変更せず、それらの一致を検査してから派生record/reportを再生成した。空init、必須14種の各欠落、別変更の配置、重複・未解決参照、未実行・mock・失敗、出力改ざんは追加のruntime/producer境界試験で検証する。
