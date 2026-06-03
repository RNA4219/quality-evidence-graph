---
intent_id: INT-QEG-SPEC-EVIDENCE-PACKAGE-001
owner: quality-evidence-graph
status: active
profile: ipo_controlled
last_reviewed_at: 2026-06-03
next_review_due: 2026-07-03
---

# Evidence Package 仕様

この文書は `ipo_controlled` release 判定に必要な evidence package を固定する。

## 1. EvidencePackage contract

| Field | Required | Rule |
|---|---|---|
| `id` | yes | 安定 ID。 |
| `createdAt` | yes | package 作成日時。 |
| `createdBy` | yes | producer role と対応する。 |
| `inputArtifactHashes` | yes | 必須 3 接続先と optional evidence の content hash。 |
| `qegOutputs` | yes | QEG 4 出力 artifact への参照。 |
| `gatePolicy` | yes | `GatePolicy` contract を満たす。 |
| `waivers` | yes | 配列。該当なしなら空配列。 |
| `approvalEvidence` | yes | 配列。IPO controlled release Go 判定では 1 件以上。事前検収 package では空配列を許すが release Go には使えない。 |
| `manualEvidence` | yes | manual execution evidence と reviewer note。 |
| `retention` | yes | retention / storage / tamper evidence の記録。 |
| `sourceRefs` | yes | 1 件以上。package manifest または版管理された record を指す。 |

## 2. 必須 QEG outputs

evidence package は次の QEG output を含める。

| Artifact | Required | Rule |
|---|---|---|
| `qeg.bundle.json` | yes | canonical graph と completeness を含む。 |
| `test-placement-plan.json` | yes | risk obligation と placement rationale を含む。 |
| `gate-verdict.json` | yes | verdict、reasons、DQ、blocker、residual risk、human review を含む。 |
| `quality-evidence-record.json` | yes | input hash、policy hash、exports を束ねる。 |
| Markdown summary | yes | 人間向け Gate brief。 |

出力 artifact の schema validation が失敗した場合、その artifact は evidence package に含めても release 判定には使えない。

## 3. 入力 artifact 証跡

必須 3 接続先について、各 artifact は次を package に記録する。

- adapter
- artifact kind
- path
- schemaId
- contentHash
- revision
- sourceRefs

必須 artifact が欠ける場合は DQ-01。schema valid でも Gate 関連 `sourceRefs` が空なら DQ-13 とする。

## 4. Manual evidence

manual evidence は次を持つ。

- executed case ID
- result
- expected result
- oracle refs
- trace_to requirement / risk / acceptance criteria
- evidence refs
- reviewer note

manual case に expected result、oracle、traceability が欠ける場合は DQ-08。manual-scripted placement が acceptable oracle を持たない場合は DQ-14 とする。

## 5. Evidence package hash

`evidencePackageHash` は承認対象を固定するための値である。MVP では hash algorithm を固定しないが、同一 package manifest から同一値を再計算できることを受入条件にする。

approval evidence の `evidencePackageHash` と package manifest の hash が一致しない場合、approval evidence は invalid とし、Gate を良化させない。

## 6. Package phase

evidence package は phase を区別する。

| Phase | 用途 | Approval requirement | Gate impact |
|---|---|---|---|
| `implementation_preparation` | 実装着手前の仕様・契約検収 | 空配列可 | release Go には使えない。 |
| `pre_release_review` | release 前の証跡確認 | 空配列可 | approval 未取得なら最大 `conditional_go`。 |
| `release_decision` | IPO controlled release 判定 | 1 件以上必須 | approval evidence 不備は DQ-15 または No-Go。 |

QEG が `release_decision` phase の package を評価する場合、approval evidence と evidence package hash が一致しなければ release Go にしてはならない。
