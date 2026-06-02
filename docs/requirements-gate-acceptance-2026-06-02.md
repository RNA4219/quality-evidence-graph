---
intent_id: INT-QEG-REQ-GATE-2026-06-02
owner: quality-evidence-graph
status: reviewed
profile: ipo_controlled
reviewed_at: 2026-06-02
method: manual-bb-test-harness
---

# 要件定義 Gate 検収

## Intake Status

- status: degraded
- assumptions:
  - 本 Gate は要件定義と実装準備の検収であり、IPO controlled release Go 判定ではない。
  - 正本は `docs/requirements.md`、実装準備台帳は `TASK.codex.md`、IPO 統制契約は `docs/control-mapping.md` と `docs/ipo-controlled-profile.md` とする。
  - `manual-bb-test-harness` の出力順に従い、根拠付き観点、リスク、優先度、手動テストケース、工数、Gate、Go/No-Go brief を記録する。
- blockers:
  - 要件定義/実装準備 Gate の blocker はなし。
  - IPO controlled release Gate は、fixture 実体、adapter、graph、placement、Gate evaluator、record CLI、実証済み evidence package が未完了のため No-Go。

## 1. 根拠付き観点

| id | title | view | techniques | source | rationale | 判定 |
|---|---|---|---|---|---|---|
| OBS-01 | 目的とスコープ | rule | checklist / traceability | `docs/requirements.md`, `BLUEPRINT.md`, `README.md` | 3 必須接続先、workflow support only、memx 対象外、必須 / 任意 artifact、IPO 統制要求が明記されている。 | pass |
| OBS-02 | Traceability | rule / data | checklist | `docs/requirements.md`, `src/types.ts`, `schemas/shared-defs.schema.json` | Gate reason、placement、DQ、node / edge は `sourceRefs`, `assumptions`, `confidence` へ辿る契約になっている。 | pass |
| OBS-03 | Gate 契約 | state / rule | decision table | `docs/requirements.md`, `schemas/gate-verdict.schema.json`, `src/types.ts` | `go / conditional_go / no_go / disqualified`、DQ-01〜DQ-17、判定優先順位、profile 別 exit code policy が定義されている。 | pass |
| OBS-04 | IPO 統制要求 | role / rule | checklist | `docs/control-mapping.md`, `docs/ipo-controlled-profile.md` | waiver governance、approval evidence、retention、immutability、職務分掌、リリース承認分離が最小契約として固定されている。 | pass |
| OBS-05 | 型 / schema 同期 | regression | contract check | `src/types.ts`, `schemas/*.json` | `npm run typecheck` と schema JSON parse が成功。`GateProfile` と DQ enum は types / schema 上で一致している。 | pass |
| OBS-06 | 配布対象 | regression | release dry-run | `package.json`, `npm pack --dry-run --cache ./.npm-cache` | tarball に `docs/requirements.md`、schemas、主要 docs、fixtures、IPO profile、control mapping、Gate record が含まれる。 | pass |
| OBS-07 | Git 管理 | regression | source control check | `git ls-files` | `docs/requirements.md`、`TASK.codex.md`、fixture 契約、control mapping、IPO profile、実装準備 Gate record、要件 Gate record は Git tracked。 | pass |
| OBS-08 | Birdseye | data / regression | parser check | `docs/birdseye/index.json`, `docs/birdseye/caps/*.json` | index は parse 可能で、主要 19 node と 19 capsule を持つ。 | pass |
| OBS-09 | MVP 実装準備 | flow / regression | gap analysis | `TASK.codex.md`, `fixtures/README.md`, `src/` | TASK-01〜TASK-10 と fixture expected verdict / DQ は固定済み。実装本体と fixture 実体は次 Gate の対象。 | partial |

## 2. リスク

| id | scenario | I | L | modifiers | score | priority | rationale |
|---|---|---:|---:|---|---:|---|---|
| R-01 | fixture 契約は文書化済みだが、`minimal-valid/` と negative fixture 実体が未作成 | 4 | 4 | D2 C2 X1 P1 A1 | 56 | P1 | 要件定義 Gate は通せるが、MVP release Gate では DQ / verdict の実証不足になる。 |
| R-02 | adapter / graph / placement / Gate evaluator / record CLI が未実装 | 5 | 4 | D2 C3 X1 P1 A0 | 76 | P0 | IPO controlled release の中核判定がまだ実行可能でないため、release Gate は No-Go。 |
| R-03 | IPO 統制が最小契約としては固定済みだが、policy / waiver / approval evidence / retention を生成・検証する実 artifact が未実装 | 4 | 3 | D2 C2 X1 P3 A1 | 50 | P2 | 要件としては存在するが、IPO 監査証跡としては実証が必要。 |
| R-04 | strict schema hardening と migration note が V1 対象として残る | 4 | 3 | D1 C2 X0 P2 A1 | 45 | P2 | MVP schema は成立しているが、IPO 水準では gate-relevant artifact の strict 化が必要。 |
| R-05 | upstream 3 接続先の実 artifact schema との契約差分が未検証 | 4 | 3 | D2 C2 X2 P1 A1 | 50 | P2 | adapter contract fixture ができるまで、実接続時の schema drift リスクが残る。 |

## 3. 優先度

| 優先度 | 対応 |
|---|---|
| P0 | TASK-01〜TASK-08 を順に実装し、adapter / graph / placement / Gate evaluator / record CLI を実行可能にする。 |
| P1 | `fixtures/minimal-valid/` と negative fixture 群を作り、expected verdict / DQ を実データで固定する。 |
| P1 | own-output validation を追加し、`qeg.bundle.json`、`test-placement-plan.json`、`gate-verdict.json`、`quality-evidence-record.json` を schema validation で検証する。 |
| P2 | `ipo_controlled` の Gate policy / waiver / approval evidence / retention を artifact として実装する。 |
| P2 | strict schema profile、schema migration note、upstream 実 artifact contract test を追加する。 |

## 4. 手動テストケース

| tc_id | priority | title | preconditions | steps | expected | oracle | trace_to | minutes |
|---|---|---|---|---|---|---|---|---:|
| TC-REQ-01 | P0 | 要件正本の配布性確認 | repo root で実行 | `npm pack --dry-run --cache ./.npm-cache` を実行し、tarball contents を確認する。 | `docs/requirements.md`、schemas、主要 docs、fixtures、IPO profile、Gate records が含まれる。 | `RUNBOOK.md` Release dry-run | OBS-06 | 10 |
| TC-REQ-02 | P0 | 要件正本の版管理確認 | Git repo が初期化済み | `git ls-files docs/requirements.md TASK.codex.md fixtures/README.md docs/control-mapping.md docs/ipo-controlled-profile.md docs/implementation-prep-gate-2026-06-02.md docs/requirements-gate-acceptance-2026-06-02.md` を確認する。 | すべて Git tracked。 | `EVALUATION.md` Acceptance Criteria | OBS-07 | 5 |
| TC-REQ-03 | P0 | schema / type 契約確認 | Node.js 20 以上 | `npm run typecheck` と schema JSON parse を実行する。 | typecheck と parse が成功する。 | `RUNBOOK.md` Execute | OBS-05 | 10 |
| TC-REQ-04 | P1 | IPO 統制項目確認 | 文書正本が tracked | requirements / README / BLUEPRINT / RUNBOOK / GUARDRAILS / control mapping / IPO profile で `ipo_controlled`、waiver、approval evidence、retention を確認する。 | 統制要求が同期している。 | `docs/ipo-controlled-profile.md` | OBS-04 | 20 |
| TC-REQ-05 | P1 | Birdseye 鮮度確認 | Birdseye docs が存在 | `docs/birdseye/index.json` を parse し、capsule の存在数と主要 node を確認する。 | index parse 成功、主要 docs / schemas / src の capsule 欠落なし。 | `HUB.codex.md` Birdseye 鮮度 | OBS-08 | 10 |
| TC-REQ-06 | P1 | MVP 完了条件確認 | 実装前提の確認 | `fixtures/` と `src/` を確認する。 | 現時点では fixture 実体と evaluator 未実装が残課題として識別される。 | `docs/requirements.md` MVP 受入条件 | R-01, R-02 | 10 |

## 5. 工数

| 作業 | 見積 |
|---|---:|
| minimal / negative fixture 実体整備 | 1.0〜2.0 日 |
| adapter / graph / placement / Gate evaluator skeleton | 3.0〜5.0 日 |
| own-output validation と record / CLI | 1.5〜3.0 日 |
| IPO control artifact 実装 | 1.0〜1.5 日 |
| strict schema hardening と migration note | 1.0〜2.0 日 |

合計目安: MVP release Gate まで 6.5〜12.5 人日。IPO controlled release Gate まで追加で 2〜4 人日。

## 6. Gate 判定

- profile: `ipo_controlled`
- requirements definition decision: `go`
- implementation preparation decision: `go`
- IPO controlled release decision: `no_go`
- reasons:
  - 要件正本、TASK 台帳、fixture 契約、Gate 契約、IPO 統制契約、Git tracking、配布対象、type/schema parse は検収済み。
  - 実装者が TASK-01 から追加判断なしで着手できる粒度に、対象、順序、受入条件が固定されている。
  - release 判定に必要な実装本体、fixture 実体、own-output validation、evidence package は未完了。
- blocking_risks:
  - R-02: adapter / graph / placement / Gate evaluator / record CLI 未実装。
- waivers:
  - なし。IPO controlled release の blocker は waiver で消していない。

## 7. Go/No-Go brief

- feature: Quality Evidence Graph 要件定義 / 実装準備
- decision:
  - 要件定義 Gate: Go
  - 実装準備 Gate: Go
  - IPO controlled release Gate: No-Go
- top risks:
  - 実装本体と fixture 実体が未完了。
  - IPO 統制 artifact の生成・検証が未実装。
  - upstream 実 artifact contract test が未完了。
- evidence:
  - `npm run typecheck`: pass
  - schema JSON parse: pass
  - `npm pack --dry-run --cache ./.npm-cache`: pass
  - Git tracking: pass for requirements / task / fixture contract / control docs / Gate records
  - Birdseye index / capsule: pass
- residual risk:
  - MVP release までは P0/P1 の実装・fixture リスクが残る。
  - IPO controlled release までは waiver / approval evidence / retention / immutability の実証リスクが残る。
- required follow-up:
  - TASK-01〜TASK-08 を実装し、minimal / negative fixture と own-output validation を通す。
  - TASK-09〜TASK-10 を実 artifact として検証し、`ipo_controlled` の evidence package を作る。
