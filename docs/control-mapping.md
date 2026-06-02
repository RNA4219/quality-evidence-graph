---
intent_id: INT-QEG-CONTROL-MAPPING-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-06-02
next_review_due: 2026-07-02
---

# Control Mapping

この文書は `ipo_controlled` profile で QEG が説明する統制対応の最小正本である。正式な法務、監査法人、主幹事証券、取引所審査を代替しない。

## Control Areas

| Control area | QEG artifact | Required evidence | Gate impact |
|---|---|---|---|
| 変更管理 | `qeg.bundle.json`, `quality-evidence-record.json` | `baseRef`, `headRef`, changed code node、artifact revision、input hash | revision 不一致は `DQ-12` |
| 品質判定 | `test-placement-plan.json`, `gate-verdict.json` | risk、test obligation、placement rationale、execution evidence | blocker / residual risk が verdict を決める |
| 例外承認 | waiver node、external approval evidence | linked risk、approver、authority、reason、expiry、impact、recheck condition、sourceRefs | 不備は `DQ-15` または `conditional_go` 不成立 |
| 証跡保全 | `quality-evidence-record.json`, evidence package | content hash、storage location、retention、tamper evidence | silent overwrite 可能な証跡だけなら `DQ-16` |
| 職務分掌 | metadata または external control evidence | producer、reviewer、approver、waiver approver、release owner | 未記録なら `DQ-17` |
| リリース承認 | external release decision | QEG verdict、human approval、approval timestamp、policy hash | QEG Gate と人間承認を混同しない |
| アクセス管理 | evidence metadata | data classification、restricted evidence owner、access policy | secret / PII unredacted は `DQ-09` |
| schema drift 統制 | schema migration note、fixture diff | compatibility impact、fixture update、approver | type / schema / fixture 矛盾は release 判定停止 |

## Minimum Evidence Package

IPO controlled release 判定で evidence package に含める最小要素:

- 入力 artifact 一式と `contentHash`
- Gate policy の `policyId`, `policyHash`, effective date, approver
- `qeg.bundle.json`
- `test-placement-plan.json`
- `gate-verdict.json`
- `quality-evidence-record.json`
- accepted waiver と approval evidence
- manual execution evidence と reviewer note
- retention / storage location / tamper evidence の記録

## Separation of Duties

同一人物が全役割を兼務する前提にしない。MVP では metadata または external control evidence に次を記録できれば実装準備 Go とする。

- producer
- reviewer
- approver
- waiver approver
- release owner

IPO controlled release Go では、実運用の権限規程に沿った承認者と承認権限の sourceRef が必要になる。

## Gate Notes

- QEG は release decision の判断材料を生成する。人間の release approval そのものを生成しない。
- `conditional_go` は `ipo_controlled` では CI success として扱わない。
- waiver で blocker を消す場合も、linked risk と期限付き再確認条件を残す。
