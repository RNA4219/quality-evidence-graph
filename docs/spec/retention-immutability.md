---
intent_id: INT-QEG-SPEC-RETENTION-IMMUTABILITY-001
owner: quality-evidence-graph
status: active
profile: ipo_controlled
last_reviewed_at: 2026-06-03
next_review_due: 2026-07-03
---

# Retention / Immutability 仕様

この文書は release 判定に使った evidence の保管、改ざん検知、silent overwrite 判定を固定する。

## 1. Retention contract

| Field | Required | Rule |
|---|---|---|
| `retentionPeriod` | yes | 保管期間。組織規程がある場合は sourceRef に辿る。 |
| `retentionOwner` | yes | 保管責任者。 |
| `storageLocation` | yes | evidence package と個別 evidence の保管先。 |
| `contentHash` | yes | 保管対象の内容 hash。 |
| `capturedAt` | yes | 証跡取得日時。 |
| `tamperEvidence` | yes | 改ざん検知方法。 |
| `reverificationMethod` | yes | 再検証方法。 |
| `sourceRefs` | yes | 1 件以上。 |

## 2. Storage classification

| Classification | Gate impact |
|---|---|
| immutable | release 判定に利用可能。 |
| append_only | release 判定に利用可能。 |
| versioned | revision と hash が一致する場合だけ利用可能。 |
| mutable | 補助情報としてのみ利用可能。release 判定の唯一根拠にはできない。 |
| unknown | DQ-16 候補。 |

silent overwrite 可能な保管先だけに存在する evidence を release 判定の根拠にした場合は DQ-16 とする。

## 3. Tamper evidence

tamper evidence は次のいずれかを持つ。

- immutable storage の object version または retention lock
- append-only log の entry ID
- Git commit hash
- artifact registry の digest
- content hash と versioned storage revision

スクリーンショット、Excel、ローカルフォルダ、共有ドライブ上の単独ファイルは、それだけでは immutable evidence と扱わない。content hash と revision、または別の tamper evidence が必要である。

## 4. Reverification

再検証は次を満たす。

- evidence package manifest から input artifact と QEG output を取得できる。
- `policyId` と `policyHash` を確認できる。
- `contentHash` を再計算または照合できる。
- Gate verdict の reasons から source-backed な判定材料へ辿れる。

再検証できない evidence は confidence を下げる。Gate 関連の唯一根拠であれば DQ または blocker 候補にする。

## 5. Secret / PII

secret、token、PII を unredacted で evidence package に保存してはならない。検出した場合は DQ-09 とする。redaction した場合は、redaction policy と reviewer note を sourceRefs 付きで残す。
