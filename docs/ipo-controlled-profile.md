---
intent_id: INT-QEG-IPO-PROFILE-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-07-20
next_review_due: 2026-10-20
---

# IPO Controlled Profile

`ipo_controlled` は、上場準備レベルの変更管理、品質判定、例外承認、証跡保全を説明するための Gate profile である。repository内の契約実装は完了しているが、人間のrelease approval、実組織の統制運用、publish判断は別Gateとする。

## Gate Policy Minimum

Gate policy は次を持つ。

| Field | Required | Notes |
|---|---|---|
| `policyId` | yes | stable な policy identifier |
| `policyHash` | yes | policy contents の hash |
| `profile` | yes | `ipo_controlled` |
| `effectiveDate` | yes | policy 適用開始日 |
| `approver` | yes | 承認者 |
| `sourceRefs` | yes | 版管理された policy source |
| `dqScope` | yes | 基本DQ-01〜DQ-17。reliability有効時はDQ-18〜DQ-21も必須 |
| `exitCodePolicy` | yes | `conditional_go`, `no_go`, `disqualified` は exit code 2 |

## Verdict Rules

- DQ が 1 件以上あれば `disqualified` を最優先する。
- blocking risk があれば `no_go` にする。
- valid waiver または residual risk が残る場合は `conditional_go` にする。
- `conditional_go` は CI success として扱わず、exit code 2 にする。
- `go` は DQ、blocking risk、期限切れ waiver、required human review が残っていない場合だけ許可する。

## Waiver Minimum

accepted waiver は次を持つ場合だけ有効にする。

- linked risk IDs
- approver
- approval authority
- reason
- expiry
- impact scope
- rollback / containment
- follow-up owner
- recheck condition
- sourceRefs

不足がある waiver は `DQ-15` または invalid waiver として扱い、Gate を良化させない。

## Approval Evidence Minimum

approval evidence は QEG の自動判定とは分離して保持する。

- approver
- role / authority
- approved verdict or release decision
- approvedAt
- policyId / policyHash
- sourceRefs
- evidence package hash

## Retention and Immutability

- release 判定に使った evidence は content hash と storage location を持つ。
- silent overwrite 可能な場所だけにある evidence は `DQ-16` 候補にする。
- retention period、owner、再検証方法を evidence package または external control evidence に記録する。

## Implementation Preparation Acceptance

実装準備 Gate は次で Go とする。

- `GateProfile` と schema enum に `ipo_controlled` が存在する。
- DQ-15〜DQ-17 が requirements、types、gate schema に存在する。
- `docs/control-mapping.md` が変更管理、品質判定、例外承認、証跡保全、リリース承認を扱う。
- この文書が Gate policy、waiver、approval evidence、retention、exit code policy の最小仕様を固定している。

repository implementation Gateは`go`である。実際のrelease approvalは、対象revisionのevidence package、職務分掌、外部approval evidenceを用いて都度判定し、repository completionだけから自動的に`go`へ昇格させない。
