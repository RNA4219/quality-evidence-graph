---
intent_id: INT-QEG-FIXTURES-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-06-02
next_review_due: 2026-07-02
---

# Fixture Contract

`fixtures/` は adapter、graph、placement、Gate evaluator、record CLI の契約テスト正本を置く。fixture は upstream artifact の意味を QEG 側で再定義せず、QEG が読む最小フィールドと期待 verdict / DQ だけを固定する。

## Directory Layout

| Directory | Purpose | Expected verdict | Required DQ |
|---|---|---|---|
| `minimal-valid/` | 必須 3 接続先が揃う最小 happy path | `go` または `conditional_go` | none |
| `negative-missing-required-artifact/` | 必須 artifact 欠落 | `disqualified` | `DQ-01` |
| `negative-empty-source-refs/` | Gate 関連 sourceRefs 空 | `disqualified` | `DQ-02` または `DQ-13` |
| `negative-revision-mismatch/` | `base_ref` / `head_ref` と artifact revision 不一致 | `disqualified` | `DQ-12` |
| `negative-manual-oracle-gap/` | manual-scripted case の expected result / oracle / traceability 欠落 | `disqualified` | `DQ-08` または `DQ-14` |
| `negative-optional-evidence-invalid/` | optional evidence invalid と必須 artifact の DQ を分離 | `go` / `conditional_go` / `no_go` のいずれか | none for optional-only invalid |

## Required Artifact Files

`minimal-valid/` は次を持つ。

| Adapter | Artifact files |
|---|---|
| `RanD` | `requirements_packet.json`, `requirements_audit_packet.json` |
| `code-to-gate` | `normalized_repo_graph.json`, `diff_analysis.json`, `findings.json`, `risk_register.json`, `test_seeds.json`, `release_readiness.json`, `audit.json` |
| `manual-bb-test-harness` | `feature_spec.json`, `risk_register.json`, `manual_case_set.json`, `gate_decision.json`, `execution_evidence.json` |
| QEG expected | `expected-gate-verdict.json`, `expected-test-placement-plan.json` |

Optional artifact がある場合は `optional/` に置く。

## Fixture Rules

- 各 artifact は `path`, `schemaId`, `contentHash`, `revision` を QEG metadata に写像できる値を持つ。
- Gate 関連 claim、blocker、disqualification、placement rationale は `sourceRefs` を 1 件以上持つ。
- `assumptions` は空配列を許容するが、判定に影響する assumption は expected output 側で `requiredHumanReview` または blocker にする。
- `minimal-valid/` の `conditional_go` は accepted waiver、owner、期限、rollback / containment、follow-up を source-backed に持つ場合だけ許容する。
- `negative-optional-evidence-invalid/` は optional parser failure を記録するが、それだけで DQ-01 にしない。

## Acceptance Commands

```sh
npm run typecheck
node -e "const fs=require('fs'); for (const f of fs.readdirSync('schemas').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('schemas/'+f,'utf8')); console.log('schemas ok')"
```

MVP CLI 実装後は次を追加する。

```sh
npm run qeg -- validate fixtures/minimal-valid
npm run qeg -- record fixtures/minimal-valid
npm run qeg -- validate fixtures/negative-missing-required-artifact
```
