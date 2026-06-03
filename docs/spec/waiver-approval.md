---
intent_id: INT-QEG-SPEC-WAIVER-APPROVAL-001
owner: quality-evidence-graph
status: active
profile: ipo_controlled
last_reviewed_at: 2026-06-03
next_review_due: 2026-07-03
---

# Waiver / Approval 仕様

この文書は `ipo_controlled` profile で有効な waiver、approval evidence、human review、職務分掌を固定する。

## 1. Waiver contract

| Field | Required | Rule |
|---|---|---|
| `id` | yes | 安定 ID。 |
| `linkedRiskIds` | yes | 1 件以上。risk node に解決できる。 |
| `approver` | yes | 承認者名または承認者 ID。 |
| `approvalAuthority` | yes | 承認権限の sourceRef に辿れる。 |
| `reason` | yes | waiver 理由。空文字不可。 |
| `expiry` | yes | 期限。期限切れ waiver は invalid。 |
| `impactScope` | yes | 影響範囲。対象 requirement / risk / changed_code / release を特定できる。 |
| `rollbackOrContainment` | yes | rollback または containment の手段。 |
| `followUpOwner` | yes | follow-up の責任者。 |
| `recheckCondition` | yes | 再確認条件。 |
| `sourceRefs` | yes | 1 件以上。承認記録または管理された文書を指す。 |

## 2. Waiver の有効条件

waiver は次をすべて満たす場合だけ valid とする。

- `linkedRiskIds` が QEG graph 上の risk に解決できる。
- `approvalAuthority` と `sourceRefs` が存在する。
- `expiry` が Gate 実行時点で期限内である。
- `impactScope` が release 対象と対応している。
- `rollbackOrContainment`、`followUpOwner`、`recheckCondition` が空でない。
- waiver 自体が secret / token / PII を unredacted で含まない。

不備がある waiver は invalid とし、Gate を良化させない。source-backed でない場合は DQ-15 候補にする。

## 3. Waiver の Gate impact

| 状態 | Gate impact |
|---|---|
| valid waiver なし | blocker または residual risk をそのまま評価する。 |
| valid waiver あり | 対象 risk は residual risk として扱い、verdict は最大でも `conditional_go` に留める。 |
| invalid waiver | Gate を良化させない。source-backed でなければ DQ-15 候補。 |
| expired waiver | invalid waiver として扱う。 |
| DQ がある run の waiver | DQ を消せない。verdict は `disqualified` のまま。 |

## 4. ApprovalEvidence contract

| Field | Required | Rule |
|---|---|---|
| `id` | yes | 安定 ID。 |
| `approver` | yes | 承認者。 |
| `roleOrAuthority` | yes | 役割または承認権限。 |
| `approvedDecision` | yes | approved verdict または release decision。 |
| `approvedAt` | yes | 承認日時。 |
| `policyId` | yes | Gate policy と一致する。 |
| `policyHash` | yes | Gate policy と一致する。 |
| `sourceRefs` | yes | 1 件以上。 |
| `evidencePackageHash` | yes | 承認対象 evidence package の hash。 |

approval evidence は QEG が生成する Gate verdict と分離して保持する。QEG は release approval を自動生成しない。

## 5. ControlRoles contract

| Role | Required | Rule |
|---|---|---|
| `producer` | yes | artifact または record 生成者。 |
| `reviewer` | yes | QEG 出力または evidence package のレビュー者。 |
| `approver` | yes | release decision の承認者。 |
| `waiverApprover` | yes | waiver 承認者。 |
| `releaseOwner` | yes | release 責任者。 |

`ipo_controlled` release Go では、上記 roles が metadata または external control evidence に記録されていることを必須にする。未記録なら DQ-17 とする。

## 6. Human review

`requiredHumanReview` は次の場合に必須とする。

- confidence が low の claim が blocking risk の反証根拠に使われている。
- human oracle を使った manual-scripted placement がある。
- valid waiver が存在する。
- residual risk が残る。
- QEG が自動判定できない authority、retention、storage immutability がある。

human review は Gate を自動的に `go` にしない。`ipo_controlled` では、human review または waiver が残る場合は `go` にせず、判定資格が成立していれば `conditional_go` に留める。
