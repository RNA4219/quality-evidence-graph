---
intent_id: INT-QEG-SPEC-GATE-POLICY-001
owner: quality-evidence-graph
status: active
profile: ipo_controlled
last_reviewed_at: 2026-07-20
next_review_due: 2026-10-20
---

# Gate Policy 仕様

この文書は `ipo_controlled` profile の Gate policy を固定する。実装時は TypeScript 型、JSON Schema、fixture へ写像する。

Gate policy の正本は QEG の `policy` と `evidencePackage.gatePolicy` のみである。RanD / code-to-gate / manual-bb-test-harness / HATE など外部 producer から渡される policy 相当情報は proposal として扱い、verdict には直接影響させない。

## 1. GatePolicy contract

| Field | Required | Type | Rule |
|---|---|---|---|
| `policyId` | yes | string | 安定した policy 識別子。空文字不可。 |
| `policyHash` | yes | string | policy 内容から再計算できる hash。 |
| `profile` | yes | enum | `ipo_controlled` 固定。 |
| `effectiveDate` | yes | ISO date | policy 適用開始日。 |
| `approver` | yes | string | policy 承認者。 |
| `sourceRefs` | yes | SourceRef[] | 1 件以上。版管理された policy source を指す。 |
| `dqScope` | yes | DisqualificationCode[] | 基本 DQ-01〜DQ-17 を含む。reliabilityPolicy を有効化する policy は DQ-18〜DQ-21 も含む。 |
| `exitCodePolicy` | yes | object | verdict ごとの exit code を持つ。 |

`exitCodePolicy` は次を固定する。

| Verdict | Exit code |
|---|---:|
| `go` | 0 |
| `conditional_go` | 2 |
| `no_go` | 2 |
| `disqualified` | 2 |

処理エラー、parse 不能、schema 読込失敗、出力書込失敗は verdict ではなく command failure とし、exit code `1` にする。

## 1.1 外部 policy proposal

外部 artifact が `gate_policy` または `gatePolicy` を直接持ち込むことは禁止する。受理できるのは `gatePolicyProposal` または `gatePolicyProposals[]` として明示された候補だけである。

proposal 採用時の必須条件:

- proposal は source-backed である。
- QEG 側で採用後の `policy.policyHash` を再計算または固定する。
- `evidencePackage.gatePolicy.policyHash` と `policy.policyHash` が一致する。
- `approvalEvidence[].policyHash` と `policy.policyHash` が一致する。

不一致または source-backed でない採用は DQ-15 とする。直接持ち込まれた `gate_policy` / `gatePolicy` は DQ-01 または validation error として fail closed にする。

## 2. Verdict 優先順位

Gate evaluator は次の順で判定する。

1. DQ が 1 件以上ある場合は `disqualified`
2. blocking risk または P0/P1 failed evidence がある場合は `no_go`
3. valid waiver、residual risk、required human review が残る場合は `conditional_go`
4. 上記がすべて空の場合だけ `go`

この優先順位は profile、fixture、CLI option で変更しない。`ipo_controlled` では `lean` 相当の緩和を使わない。

## 3. DQ scope

`ipo_controlled` では DQ-01〜DQ-17 を有効にする。reliabilityPolicy を有効にする場合は、`docs/spec/reliability-extension.md` に従い DQ-18〜DQ-21 も有効にする。

| Code | Gate policy 上の扱い |
|---|---|
| DQ-01 | 必須 artifact 欠落または schema invalid。 |
| DQ-02 | final Gate reason が source-backed な判定材料に紐づかない。 |
| DQ-03 | gate-relevant path に unsupported claim がある。 |
| DQ-04 | P0/P1 risk の oracle gap を事実扱いしている。 |
| DQ-05 | changed_code があるのに test obligation または accepted waiver がない。 |
| DQ-06 | evidence の path / line / hash が実体と一致しない。 |
| DQ-07 | partial graph の completeness が明示されていない。 |
| DQ-08 | manual test case に expected result / oracle / traceability がない。 |
| DQ-09 | secret / token / PII を unredacted で artifact に保存した。 |
| DQ-10 | benchmark mode で hidden oracle に candidate がアクセスした。 |
| DQ-11 | 必須 3 接続先の契約違反を成功扱いした。 |
| DQ-12 | base_ref / head_ref と artifact revision、producer check head SHA、または producer readiness verdict が不一致。 |
| DQ-13 | Gate 関連 sourceRefs が空。 |
| DQ-14 | manual-scripted placement が acceptable oracle を持たない。 |
| DQ-15 | Gate policy / waiver / approval evidence が版管理または source-backed でない。 |
| DQ-16 | release 判定に使った evidence が silent overwrite 可能な保管先だけに存在する。 |
| DQ-17 | producer / reviewer / approver / waiver approver の職務分掌が記録されていない。 |
| DQ-18 | 必須 risk にmatching real resilience evidenceがない、mock-only、矛盾した`evidenced_by` provenance、stale / future / invalid time、environment、steady state、fault、abort、recovery lifecycleが不整合。 |
| DQ-19 | 同一execution identityまたはlatest instantのevidenceが異なるdecision fingerprintを持ち、選択が曖昧。 |
| DQ-20 | required observed / signal が存在しない、phase / metric / resolvable hash-backed EvidenceRef と結び付かない、または observed summary と一致しない。 |
| DQ-21 | reliability有効時のfull revision、SHA-256 policy hash、policy ID、profileのcross-object identityが欠落・形式不正・不一致、またはpolicyのDQ scopeが不足。 |

## 4. Waiver と DQ の関係

- waiver は DQ を無効化しない。
- DQ がある run では、valid waiver が存在しても verdict は `disqualified` のままにする。
- invalid waiver は Gate を良化させず、source-backed でない場合は DQ-15 候補にする。
- accepted waiver は `conditional_go` の理由になり得るが、`go` の理由にはしない。waiver が残る限り release decision は人間承認を必要とする。

## 5. Gate reason

`reasons` は独立した作文ではなく、次のいずれかの要約として生成する。

- `disqualifications[]`
- `blockers[]`
- `residualRisks[]`
- `requiredHumanReview[]`
- valid waiver
- approval evidence

Gate 関連の要約元が `sourceRefs` を持たない場合は DQ-02 または DQ-13 とする。

## 0.2.0 preflight

Gate評価前に必須componentのruntime schemaと必須evidence実体を検証する。parse可能な必須schema不適合はDQ-01、ipo_controlledのpath/hash欠落、不存在、hash不一致はDQ-06とする。revision不一致はrevision整合性DQとして扱う。Optional artifactだけの不適合はwarningであり、それ単独でDQにしない。
