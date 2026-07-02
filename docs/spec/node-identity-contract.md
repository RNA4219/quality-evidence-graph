---
intent_id: INT-QEG-NODE-IDENTITY-001
owner: quality-evidence-graph
status: active
profile: ipo_controlled
last_reviewed_at: 2026-07-02
next_review_due: 2026-08-02
---

# Node Identity Contract

この文書は QEG graph と cross-repo QA artifact の ID join 規約を定義する。schema 互換性と upstream artifact の独立性を保つため、Gate policy 仕様とは別文書として管理する。

## 1. 形式

graph node、edge、risk、requirement、test obligation、waiver、source ref など、QEG が join に使う stable ID は次の形式を標準とする。

```text
<producer>:<local-id>
```

予約 producer prefix:

| Prefix | Producer |
|---|---|
| `rand` | RanD |
| `ctg` | code-to-gate |
| `mbb` | manual-bb-test-harness |
| `hate` | harness-auto-test-evidence |
| `qeg` | Quality Evidence Graph |

`local-id` は producer 内で安定していればよい。例: `rand:REQ-001`, `ctg:risk-001`, `mbb:case-001`, `hate:junit-001`, `qeg:verdict-001`。

## 2. Join Contract

- QEG は prefix を producer namespace として扱い、同じ `local-id` でも prefix が異なれば別 ID とする。
- upstream の生 ID は破壊せず、QEG ingest adapter が prefix 付き canonical ID へ写像する。
- 同一概念を複数 producer が出した場合、同一 ID へ潰さず、edge や cluster metadata で join する。
- `policyId` は QEG policy 正本を指す場合 `qeg:` prefix を推奨する。外部 tool の policy 候補は proposal として保持する。

## 3. Deprecation

互換期間中、prefix なし ID は warning 付きで受理する。unknown prefix を含む ID は validation error として拒否する。

互換期間終了時の migration:

- schema の `stableId` から prefix なし許容を外す。
- fixture の prefix なし ID を全て予約 prefix 付きに更新する。
- adapter は upstream local ID と canonical ID の対応表を evidence package または graph metadata に残す。

## 4. Gate Policy Separation

Gate policy の正本 producer は QEG のみである。RanD、code-to-gate、manual-bb、HATE が policy 相当の情報を出す場合は `gatePolicyProposal` または `gatePolicyProposals[]` として明示する。

外部 artifact が `gate_policy` または `gatePolicy` を直接持ち込んだ場合、QEG ingest は判定資格の欠落として DQ または validation error にする。proposal は source-backed な候補として保持できるが、QEG verdict を直接良化または悪化させない。

proposal を QEG policy として採用する場合は、採用後の QEG `policy.policyHash` と approval evidence の `policyHash` を照合し、不一致なら DQ-15 とする。
