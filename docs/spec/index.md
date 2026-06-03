---
intent_id: INT-QEG-SPEC-INDEX-001
owner: quality-evidence-graph
status: active
profile: ipo_controlled
last_reviewed_at: 2026-06-03
next_review_due: 2026-07-03
---

# IPO 統制仕様

`docs/spec/` は `ipo_controlled` profile を実装するための仕様正本である。要求正本は `docs/requirements.md` とし、この仕様群は要求を TypeScript 型、JSON Schema、fixture、CLI 判定へ落とすための決定済み contract を記録する。

## 1. 正本関係

| 文書 | 役割 | 優先 |
|---|---|---|
| `docs/requirements.md` | 要求正本 | 1 |
| `docs/control-mapping.md` | 統制対応表 | 2 |
| `docs/ipo-controlled-profile.md` | IPO profile 要求 | 2 |
| `docs/spec/*.md` | 実装仕様正本 | 3 |
| `TASK.codex.md` | 実装順序と受入条件 | 4 |
| `fixtures/README.md` | fixture 契約 | 4 |

矛盾した場合は、要求正本を更新するか、この仕様群を修正する。実装側だけで解釈を変えてはならない。

## 2. 読み順

1. `docs/spec/index.md`
2. `docs/spec/gate-policy.md`
3. `docs/spec/waiver-approval.md`
4. `docs/spec/evidence-package.md`
5. `docs/spec/retention-immutability.md`
6. `docs/spec/acceptance.md`
7. `docs/spec/review-2026-06-03.md`
8. `docs/spec/gate-acceptance-2026-06-03.md`

## 3. 境界

### MVP 実装で扱う

- `ipo_controlled` の Gate policy contract
- DQ-01〜DQ-17 の有効範囲
- `conditional_go` / `no_go` / `disqualified` の exit code policy
- waiver / approval evidence / retention / immutability / 職務分掌の最小 artifact contract
- evidence package に含める最小要素
- 仕様書検収と package 配布確認

### MVP 実装で扱わない

- 組織固有の承認権限規程そのものの正本化
- 外部 SaaS や immutable storage の本番設定
- 監査法人、主幹事証券、取引所審査の代替
- upstream tool の実行 orchestration
- TypeScript 型、JSON Schema、CLI、fixture 実体の今回の仕様書作成タスク内での実装

## 4. 共通判定原則

- DQ が 1 件以上あれば verdict は `disqualified` を最優先する。
- `disqualified` は品質不良ではなく、判定資格の失格を表す。
- waiver は blocker または residual risk の扱いを変更できるが、DQ を消すことはできない。
- `ipo_controlled` では `conditional_go` を CI success として扱わず、exit code は `2` とする。
- QEG は release decision の判断材料を生成する。人間の release approval そのものは external approval evidence として分離する。

## 5. 実装者への固定事項

- `GatePolicy`, `Waiver`, `ApprovalEvidence`, `EvidencePackage`, `ControlRoles` はこの仕様群を元に型と schema へ写像する。
- すべての Gate 関連 reason、blocker、disqualification、waiver、approval evidence は `sourceRefs` を 1 件以上持つ。
- `policyHash`、`contentHash`、`evidencePackageHash` は比較可能な文字列として扱い、アルゴリズムは MVP では固定しない。ただし同一内容で再計算できることを実装 acceptance にする。
- IPO controlled release Gate は、実装、fixture、own-output validation、evidence package が揃うまで `no_go` のままとする。
