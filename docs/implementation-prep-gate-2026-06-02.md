---
intent_id: INT-QEG-IMPL-PREP-GATE-2026-06-02
owner: quality-evidence-graph
status: reviewed
profile: ipo_controlled
reviewed_at: 2026-06-02
---

# Implementation Preparation Gate

## 1. 根拠付き観点

| 観点 | 判定 | 根拠 |
|---|---|---|
| Git baseline | pass | 正本ファイルを Git tracked にすることを Go 条件とし、baseline commit 後に `git ls-files docs/requirements.md` で確認する。 |
| Task readiness | pass | `TASK.codex.md` が TASK-01〜TASK-10 の順序、対象、受入条件を固定している。 |
| Fixture readiness | pass | `fixtures/README.md` が minimal / negative fixture の構成、期待 verdict、期待 DQ を固定している。 |
| IPO control readiness | pass | `docs/control-mapping.md` と `docs/ipo-controlled-profile.md` が policy、waiver、approval evidence、retention、職務分掌を固定している。 |
| Verification readiness | pass | `npm run typecheck`、schema parse、`npm pack --dry-run --cache ./.npm-cache` を実行対象とする。 |
| Release readiness | fail | adapter、graph builder、placement engine、Gate evaluator、record CLI は未実装のため IPO controlled release は No-Go。 |

## 2. リスク

| ID | リスク | 優先度 | 対応 |
|---|---|---|---|
| R-01 | Git baseline が作られない | P0 | baseline commit を必須にする。 |
| R-02 | fixture 契約が実装時に揺れる | P0 | `fixtures/README.md` の expected verdict / DQ を正本にする。 |
| R-03 | IPO control が文書宣言に留まる | P1 | control mapping と IPO profile を実装前正本にする。 |
| R-04 | 実装準備 Go と release Go が混同される | P1 | この record で二段階 Gate を明記する。 |

## 3. 優先度

| 優先度 | Go 条件 |
|---|---|
| P0 | Git tracked、TASK 台帳、fixture 契約 |
| P1 | control mapping、IPO profile、再検収 record |
| P2 | Birdseye / package 配布導線の同期 |

## 4. 手動テストケース

| Case | 手順 | 期待結果 |
|---|---|---|
| TC-PREP-01 | `git status --short` と `git ls-files docs/requirements.md` を確認する | 正本ファイルが tracked |
| TC-PREP-02 | `TASK.codex.md` を確認する | TASK-01〜TASK-10 が decision complete |
| TC-PREP-03 | `fixtures/README.md` を確認する | minimal fixture と negative fixture 4 種以上が定義済み |
| TC-PREP-04 | `docs/control-mapping.md` と `docs/ipo-controlled-profile.md` を確認する | waiver、approval evidence、retention、職務分掌、immutability が定義済み |
| TC-PREP-05 | `npm run typecheck`、schema parse、pack dry-run を実行する | すべて成功し、追加 docs / fixtures が package に含まれる |

## 5. 工数

実装準備 Gate を Go に上げる作業は 2.5〜3.5 人日相当。残る MVP 実装は TASK-01〜TASK-08 に従って別 Gate で検収する。

## 6. Gate 判定

Implementation preparation verdict: `go`

IPO controlled release verdict: `no_go`

理由:

- 実装に必要な task ledger、fixture contract、control artifact、profile contract、再検収 record は揃った。
- release に必要な adapter、graph builder、placement engine、Gate evaluator、record CLI は未実装であり、IPO controlled release Go とは判定しない。

## 7. Go/No-Go brief

実装準備は Go。次の作業者は `TASK.codex.md` の order 1 から順に、`fixtures/README.md` の expected verdict / DQ を崩さず実装できる。

IPO controlled release は No-Go。実装完了後、minimal / negative fixture、own-output validation、evidence package、waiver / approval / retention の実証を揃えて再判定する。
