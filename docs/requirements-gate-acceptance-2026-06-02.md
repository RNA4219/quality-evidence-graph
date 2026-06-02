---
intent_id: INT-QEG-REQ-GATE-2026-06-02
owner: quality-evidence-graph
status: reviewed
profile: ipo_controlled
reviewed_at: 2026-06-02
---

# 要件定義 Gate 検収

## 1. 根拠付き観点

| 観点 | 判定 | 根拠 |
|---|---|---|
| 目的とスコープ | pass | `docs/requirements.md` が 3 必須接続先、workflow support only、memx 対象外、必須 / 任意 artifact を明記している。 |
| Traceability | pass | Gate reason、placement、DQ、node / edge に `sourceRefs`, `assumptions`, `confidence` を要求している。 |
| Gate 契約 | pass | `go / conditional_go / no_go / disqualified`、DQ-01〜DQ-17、判定優先順位、exit code policy が定義されている。 |
| IPO 統制要求 | partial | `ipo_controlled`、waiver governance、evidence immutability、職務分掌は要件化済み。ただし policy / approval evidence / retention の具体 artifact は未実装。 |
| 型 / schema 同期 | pass | `npm run typecheck` 成功。`schemas/*.json` parse 成功。`GateProfile` と DQ enum は types / schema 上で主要契約が一致している。 |
| 配布対象 | pass | `npm pack --dry-run --cache ./.npm-cache` 成功。tarball に `docs/requirements.md`、schemas、主要 docs が含まれる。 |
| Git 管理 | fail | `git status --short` で全ファイルが untracked。`docs/requirements.md` は Git 管理対象という受入条件を満たしていない。 |
| Birdseye | pass | `docs/birdseye/index.json` は parse 可能。主要 15 node と 18 edge を持ち、capsule 欠落は 0 件。 |
| MVP 実装準備 | partial | 要件と初期 schema / type は存在するが、minimal fixture、negative fixture、adapter / graph / placement / gate evaluator は未完了。 |

## 2. リスク

| ID | リスク | 影響 | 根拠 |
|---|---|---|---|
| R-01 | Git 管理外のため、要件正本の監査証跡が成立しない | critical | `EVALUATION.md` と `RUNBOOK.md` は Git 管理対象を必須にしているが、現状は untracked。 |
| R-02 | IPO profile の統制 artifact が要件止まり | high | Gate policy、waiver、approval evidence、retention、control mapping は要求定義済みだが実体が未整備。 |
| R-03 | MVP の fixture / evaluator が未完了 | high | `docs/requirements.md` の MVP 受入条件に minimal fixture と DQ evaluator があるが、現時点では実装準備段階。 |
| R-04 | strict schema hardening が未完了 | medium | MVP schema では `additionalProperties: true` や抽象的 object が残り、IPO strict 化の余地がある。 |
| R-05 | upstream artifact schema との実契約差分が未検証 | medium | 3 接続先の adapter contract test 用 fixture 方針はあるが、実 artifact による契約テストは未完了。 |

## 3. 優先度

| 優先度 | 対応 |
|---|---|
| P0 | Git 管理対象化、Gate policy / waiver / approval evidence / retention の正本 artifact 作成。 |
| P1 | minimal fixture と negative fixture を追加し、DQ-01 / DQ-02 / DQ-03 / DQ-05 / DQ-12 / DQ-13 / DQ-14 を評価可能にする。 |
| P1 | adapter / graph / placement / gate evaluator の skeleton を実装し、own-output validation まで通す。 |
| P2 | `ipo_controlled` strict schema profile、control mapping、schema migration note を追加する。 |
| P2 | upstream 実 artifact との contract test を追加する。 |

## 4. 手動テストケース

| Case | 目的 | 手順 | 期待結果 | 優先度 |
|---|---|---|---|---|
| TC-REQ-01 | 要件正本の配布性確認 | `npm pack --dry-run --cache ./.npm-cache` を実行し、tarball contents を確認する。 | `docs/requirements.md` と schemas / 主要 docs が含まれる。 | P0 |
| TC-REQ-02 | 要件正本の版管理確認 | `git status --short` と `git ls-files docs/requirements.md` を確認する。 | `docs/requirements.md` が tracked で、意図しない untracked 正本がない。 | P0 |
| TC-REQ-03 | schema / type 契約確認 | `npm run typecheck` と schema JSON parse を実行する。 | typecheck と parse が成功する。 | P0 |
| TC-REQ-04 | IPO 統制項目確認 | requirements / README / BLUEPRINT / RUNBOOK / GUARDRAILS で `ipo_controlled`、waiver、approval evidence、retention を確認する。 | 統制要求が同期している。 | P1 |
| TC-REQ-05 | Birdseye 鮮度確認 | `docs/birdseye/index.json` を parse し、capsule の存在を確認する。 | 主要 docs / schemas / src の capsule 欠落がない。 | P1 |
| TC-REQ-06 | MVP 完了条件確認 | fixture、adapter、graph、placement、gate evaluator、record / CLI の存在を確認する。 | MVP 受入条件に対応する成果物と実行証跡がある。 | P1 |

## 5. 工数

| 作業 | 見積 |
|---|---|
| Git 管理対象化と初回 baseline commit | 0.5 日 |
| IPO control artifact 設計 | 1.0〜1.5 日 |
| minimal / negative fixture 整備 | 1.0〜2.0 日 |
| adapter / graph / placement / gate skeleton | 3.0〜5.0 日 |
| own-output validation と record / CLI | 1.5〜3.0 日 |
| strict schema hardening と migration note | 1.0〜2.0 日 |

合計目安: MVP 実装準備完了まで 7〜14 人日。IPO controlled release gate まで追加で 3〜6 人日。

## 6. Gate 判定

Verdict: `no_go` for IPO controlled release.

理由:

- `docs/requirements.md` が Git 管理対象という受入条件を満たしていない。
- `ipo_controlled` の policy / waiver / approval evidence / retention / control mapping が実 artifact として未整備。
- MVP 完了条件の minimal fixture、negative fixture、adapter / graph / placement / gate evaluator、own-output validation が未完了。

補足判定:

- 要件定義の方向性と契約粒度は `conditional_go` for implementation preparation。
- 実装準備へ進むことは妥当。ただし IPO controlled release gate には進めない。

## 7. Go/No-Go brief

現時点の要件定義は、QEG の中核価値、必須接続先、traceability、Gate verdict、DQ、IPO 統制要求をよく捉えている。`typecheck`、schema parse、package dry-run、Birdseye capsule 確認も成功しており、実装準備へ進むだけの骨格はある。

一方で IPO レベルのリリース判定としては No-Go。最大の blocker は、要件正本を含む全ファイルが Git 未追跡であること、統制 artifact がまだ要件文書内の要求に留まっていること、MVP の fixture と evaluator が未完了であること。次の通過条件は、Git baseline、control mapping / Gate policy / waiver schema、minimal / negative fixture、DQ evaluator の実装証跡を揃えること。
