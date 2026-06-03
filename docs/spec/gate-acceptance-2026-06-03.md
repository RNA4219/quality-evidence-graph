---
intent_id: INT-QEG-SPEC-GATE-ACCEPTANCE-2026-06-03
owner: quality-evidence-graph
status: reviewed
profile: ipo_controlled
method: manual-bb-test-harness
reviewed_at: 2026-06-03
---

# IPO 水準 仕様書 Gate 検収

## Intake Status

- status: degraded
- assumptions:
  - 本 Gate は実装前の仕様書検収であり、release approval ではない。
  - 要求正本は `docs/requirements.md`、統制正本は `docs/control-mapping.md` と `docs/ipo-controlled-profile.md`、実装仕様正本は `docs/spec/*.md` とする。
  - `manual-bb-test-harness` の出力順に従い、根拠付き観点、リスク、優先度、手動テストケース、工数、Gate 判定、Go/No-Go brief を記録する。
  - 仕様内容の充足と、Git tracked / package 配布を含む正式 Gate 資格は分けて判定する。
- blockers:
  - P0-REL-01: TypeScript 型、JSON Schema、CLI、fixture 実体、own-output validation、実証済み evidence package は未実装であり、IPO controlled release Gate は No-Go。

## 1. 根拠付き観点

| id | title | view | techniques | source | rationale | 判定 |
|---|---|---|---|---|---|---|
| OBS-GATE-01 | 正本関係 | rule | traceability checklist | `docs/spec/index.md`, `docs/requirements.md` | 要求正本、統制正本、実装仕様正本、TASK / fixture の優先順位が明記され、実装側だけで解釈を変えない方針が固定されている。 | pass |
| OBS-GATE-02 | Gate policy | state / rule | decision table | `docs/spec/gate-policy.md`, `docs/ipo-controlled-profile.md` | DQ 最優先、`disqualified` / `no_go` / `conditional_go` / `go` の優先順位、`conditional_go` exit code `2` が明記されている。 | pass |
| OBS-GATE-03 | Waiver と DQ | rule | negative rule check | `docs/spec/gate-policy.md`, `docs/spec/waiver-approval.md` | waiver は DQ を消せず、valid waiver が残る場合も最大 `conditional_go` に留まる。 | pass |
| OBS-GATE-04 | Approval separation | role | role x decision check | `docs/spec/waiver-approval.md`, `docs/control-mapping.md` | QEG verdict と人間の release approval は `ApprovalEvidence` として分離され、QEG は release approval を自動生成しない。 | pass |
| OBS-GATE-05 | Evidence package | data / flow | artifact completeness | `docs/spec/evidence-package.md` | input artifact hashes、QEG outputs、Gate policy、waiver、approval evidence、manual evidence、retention、sourceRefs が package contract として固定されている。 | pass |
| OBS-GATE-06 | Package phase | state | state transition | `docs/spec/evidence-package.md` | `implementation_preparation`、`pre_release_review`、`release_decision` の phase が分かれ、approval evidence 未取得 package を release Go に使えない。 | pass |
| OBS-GATE-07 | Retention / immutability | data / rule | classification table | `docs/spec/retention-immutability.md` | storage classification、tamper evidence、silent overwrite 判定が DQ-16 と接続されている。 | pass |
| OBS-GATE-08 | Review record | regression | review trace | `docs/spec/review-2026-06-03.md` | FIND-01〜FIND-03 の指摘、修正方針、残リスク、Gate 判定が記録されている。 | pass |
| OBS-GATE-09 | 運用導線 | flow / regression | navigation check | `HUB.codex.md`, `RUNBOOK.md`, `EVALUATION.md`, `docs/birdseye/index.json` | 仕様書群とレビュー記録へ到達できる導線が追加されている。 | pass |
| OBS-GATE-10 | Git controlled source | regression | source control check | `git ls-files docs/spec/*.md` | `docs/spec/*.md` と関連 Birdseye capsule は Git index に登録され、実装前 Gate の controlled source of truth 条件を満たす。 | pass |
| OBS-GATE-11 | code-to-gate 静的 Gate | tool / regression | repository gate artifact | `docs/spec/code-to-gate-2026-06-03/release-readiness.json`, `docs/spec/code-to-gate-2026-06-03/analysis-report.md` | code-to-gate v1.4.1 により QEG repo を解析し、findings 0 件、critical 0 件、high 0 件、readiness `passed` を確認した。これは仕様書 Gate の補強証跡であり、IPO controlled release approval ではない。 | pass |
| OBS-GATE-12 | RanD KanoMode 監査 | value / audit | Kano-inspired requirement audit | `docs/spec/kano-mode-2026-06-03/requirements_audit_packet.json`, `docs/spec/kano-mode-2026-06-03/kano.json` | RanD KanoMode audit で 5 要件を must_be / performance / attractive に仮分類し、go=5、conditional_go=0、no_go=0、overall `go` を確認した。これは正式な狩野調査ではなく、仕様書 Gate の価値妥当性補強証跡である。 | pass |

## 2. リスク

| id | scenario | I | L | modifiers | score | priority | rationale |
|---|---|---:|---:|---|---:|---|---|
| R-GATE-01 | 仕様書群が Git 管理対象から外れて実装判断に使われる | 5 | 2 | D1 C2 X0 P3 A1 | 43 | P2 | Git index 登録により直近 blocker は解消。今後の変更で tracking が外れると再発するため確認を継続する。 |
| R-GATE-02 | 仕様書 Gate Go と IPO release Go が混同される | 5 | 3 | D2 C2 X1 P2 A1 | 61 | P1 | 実装・fixture・evidence package がない状態で release Go と誤認すると、品質判定の根拠が壊れる。 |
| R-GATE-03 | 型 / schema への写像時に contract が欠落する | 4 | 3 | D2 C2 X0 P2 A1 | 45 | P2 | 仕様本文は実装可能な粒度だが、まだ TypeScript / JSON Schema に反映されていない。 |
| R-GATE-04 | release decision phase の fixture がない | 4 | 3 | D2 C2 X0 P2 A0 | 47 | P2 | approval evidence、package hash、retention の失格条件を実データで検証できない。 |
| R-GATE-05 | storage classification の実保管先判定が未実装 | 4 | 3 | D2 C1 X1 P2 A0 | 48 | P2 | DQ-16 の実効性は evaluator と fixture が揃うまで証明できない。 |
| R-GATE-06 | code-to-gate `passed` を IPO controlled release Go と誤読する | 5 | 2 | D2 C2 X1 P2 A1 | 52 | P1 | code-to-gate は repository static gate と readiness artifact を生成するが、QEG の IPO release に必要な型、schema、fixture、own-output validation、evidence package の代替にはならない。 |
| R-GATE-07 | KanoMode `go` を市場実証または release approval と誤読する | 4 | 2 | D2 C2 X0 P2 A1 | 40 | P2 | KanoMode は Kano-inspired audit hypothesis であり、正式な狩野調査、顧客検証、IPO release approval の代替ではない。 |

## 3. 優先度

| 優先度 | 対応 |
|---|---|
| P0 | Gate 記録を含めた `git ls-files` を再実行し、controlled source of truth 条件を満たす。完了済み。 |
| P1 | 仕様書 Gate Go、実装着手 Gate Go、IPO controlled release No-Go を release brief / RUNBOOK / EVALUATION で混同しない。 |
| P1 | code-to-gate readiness `passed` を、仕様書 Gate の補強証跡として扱い、IPO controlled release approval として扱わない。 |
| P2 | KanoMode audit `go` を、価値妥当性の補強証跡として扱い、正式な狩野調査または release approval として扱わない。 |
| P2 | TASK-09 / TASK-10 で `GatePolicy`、`Waiver`、`ApprovalEvidence`、`EvidencePackage`、`ControlRoles` を型 / schema に写像する。 |
| P2 | IPO controlled 用 minimal / negative fixture を追加し、approval evidence、retention、silent overwrite、DQ-15〜DQ-17 を検証する。 |

## 4. 手動テストケース

| tc_id | priority | title | preconditions | steps | expected | oracle | trace_to | minutes |
|---|---|---|---|---|---|---|---|---:|
| TC-GATE-01 | P0 | 正本関係確認 | `docs/spec/index.md` が存在する | 正本関係表を読み、requirements > control/profile > spec > task/fixture の順序を確認する。 | 優先順位が明記され、実装側だけで解釈変更できない。 | `docs/spec/index.md` | OBS-GATE-01 | 10 |
| TC-GATE-02 | P0 | Gate policy 確認 | `docs/spec/gate-policy.md` が存在する | verdict 優先順位、DQ scope、exit code policy を確認する。 | DQ は `disqualified` 最優先、`conditional_go` exit code は `2`。 | `docs/spec/gate-policy.md` | OBS-GATE-02 | 10 |
| TC-GATE-03 | P0 | Waiver / approval 確認 | `docs/spec/waiver-approval.md` が存在する | waiver の有効条件、Gate impact、approval evidence、ControlRoles、human review を確認する。 | waiver は DQ を消せず、QEG verdict と release approval は分離される。 | `docs/spec/waiver-approval.md` | OBS-GATE-03, OBS-GATE-04 | 15 |
| TC-GATE-04 | P1 | Evidence package 確認 | `docs/spec/evidence-package.md` が存在する | package contract、必須 QEG outputs、manual evidence、package phase を確認する。 | release decision phase では approval evidence が必須で、未取得 package は release Go に使えない。 | `docs/spec/evidence-package.md` | OBS-GATE-05, OBS-GATE-06 | 15 |
| TC-GATE-05 | P1 | Retention / immutability 確認 | `docs/spec/retention-immutability.md` が存在する | storage classification と tamper evidence を確認する。 | silent overwrite 可能な evidence だけを release 判定根拠にすると DQ-16。 | `docs/spec/retention-immutability.md` | OBS-GATE-07 | 10 |
| TC-GATE-06 | P1 | Review record 確認 | `docs/spec/review-2026-06-03.md` が存在する | FIND-01〜FIND-03 と Gate 判定を確認する。 | 指摘対応と残リスクが記録されている。 | `docs/spec/review-2026-06-03.md` | OBS-GATE-08 | 10 |
| TC-GATE-07 | P0 | Git tracking 確認 | 仕様書群が追加済み | `git ls-files docs/spec/gate-acceptance-2026-06-03.md docs/spec/index.md docs/spec/gate-policy.md docs/spec/waiver-approval.md docs/spec/evidence-package.md docs/spec/retention-immutability.md docs/spec/acceptance.md docs/spec/review-2026-06-03.md` を実行する。 | 全対象が表示される。 | `docs/spec/acceptance.md` | OBS-GATE-10 | 5 |
| TC-GATE-08 | P1 | 配布対象確認 | package dry-run を実行可能 | `npm pack --dry-run --cache ./.npm-cache` を実行し tarball contents を確認する。 | `docs/spec/` と Gate 記録が含まれる。 | `RUNBOOK.md` | OBS-GATE-09 | 10 |
| TC-GATE-09 | P1 | code-to-gate Gate 証跡確認 | `docs/spec/code-to-gate-2026-06-03/` が存在する | `analysis-report.md` と `release-readiness.json` を確認する。 | findings 0 件、critical 0 件、high 0 件、readiness `passed`。ただし IPO controlled release Gate は `no_go` として分離される。 | `docs/spec/code-to-gate-2026-06-03/release-readiness.json` | OBS-GATE-11 | 10 |
| TC-GATE-10 | P2 | KanoMode 要求価値監査確認 | `docs/spec/kano-mode-2026-06-03/` が存在する | `requirements_audit_packet.json` と `kano.json` を確認する。 | go=5、conditional_go=0、no_go=0、overall `go`。ただし正式な狩野調査または IPO release approval ではない。 | `docs/spec/kano-mode-2026-06-03/requirements_audit_packet.json` | OBS-GATE-12 | 10 |

## 5. 工数

- prep: 0.25 日
- execution: 0.5 日
- evidence: 0.25 日
- retry buffer: 0.25 日
- total: 1.25 日

## 6. Gate 判定

- profile: `ipo_controlled`
- specification content decision: `go`
- formal pre-implementation gate decision: `go`
- implementation start decision: `go`
- IPO controlled release decision: `no_go`
- reasons:
  - 仕様内容は、Gate policy、waiver、approval evidence、evidence package、retention、immutability、職務分掌を実装可能な粒度で固定している。
  - `docs/spec/*.md` と関連 Birdseye capsule は Git index に登録され、controlled source of truth 条件を満たす。
  - code-to-gate v1.4.1 による repository static gate は findings 0 件、critical 0 件、high 0 件、readiness `passed` である。
  - TypeScript 型、JSON Schema、CLI、fixture 実体、own-output validation、実証済み evidence package は未実装であり、IPO controlled release は No-Go。
- blocking_risks:
  - P0-REL-01: TypeScript 型、JSON Schema、CLI、fixture 実体、own-output validation、実証済み evidence package は未実装。
- waivers:
  - なし。release readiness の blocker は waiver で消していない。

## 7. Go/No-Go brief

- feature: IPO 統制仕様書 実装前 Gate
- decision:
  - 仕様内容 Gate: Go
  - 正式な実装前 Gate: Go
  - 実装着手 Gate: Go
  - IPO controlled release Gate: No-Go
- top risks:
  - 実装・fixture・evidence package が未完了で、release Go 判定の証跡がない。
  - 型 / schema / evaluator への写像が未完了。
- evidence:
  - `docs/spec/index.md`: 正本関係と共通判定原則
  - `docs/spec/gate-policy.md`: Gate policy、DQ scope、exit code
  - `docs/spec/waiver-approval.md`: waiver、approval evidence、ControlRoles
  - `docs/spec/evidence-package.md`: evidence package と package phase
  - `docs/spec/retention-immutability.md`: retention、storage classification、tamper evidence
  - `docs/spec/review-2026-06-03.md`: 仕様書レビュー記録
  - `docs/spec/code-to-gate-2026-06-03/analysis-report.md`: code-to-gate 解析結果
  - `docs/spec/code-to-gate-2026-06-03/release-readiness.json`: code-to-gate readiness 結果
  - `docs/spec/kano-mode-2026-06-03/requirements_audit_packet.json`: RanD KanoMode audit 結果
  - `docs/spec/kano-mode-2026-06-03/kano.json`: Kano-inspired 仮分類
- residual risk:
  - Git 管理対象化は完了。今後の変更で tracking が外れないよう再確認が必要。
  - TASK-09 / TASK-10 実装まで release Gate は No-Go。
- required follow-up:
  - `npm run typecheck`、JSON parse、`npm pack --dry-run --cache ./.npm-cache` を再実行する。
  - `git ls-files` で対象文書が表示されることを確認し、Gate を再検収する。

## 8. 再検収証跡

2026-06-03 に、staged 済みの仕様書群と Birdseye capsule を対象に再検収した。

| check | result | evidence |
|---|---|---|
| `manual-bb-test-harness` 出力順 | pass | 本記録が Intake Status、根拠付き観点、リスク、優先度、手動テストケース、工数、Gate 判定、Go/No-Go brief を持つ。 |
| IPO blocker 条件 | pass | DQ 最優先、waiver で DQ 不可、`conditional_go` exit code `2`、approval evidence 分離、Git index 登録を確認した。 |
| `npm run typecheck` | pass | TypeScript contract が compile できる。 |
| schema / Birdseye JSON parse | pass | `schemas/*.json`、`docs/birdseye/index.json`、`docs/birdseye/caps/*.json` が parse できる。 |
| `npm pack --dry-run --cache ./.npm-cache` | pass | tarball contents に `docs/spec/` と `docs/spec/gate-acceptance-2026-06-03.md` が含まれる。 |
| `git ls-files docs/spec/...` | pass | `docs/spec/acceptance.md`、`docs/spec/evidence-package.md`、`docs/spec/gate-acceptance-2026-06-03.md`、`docs/spec/gate-policy.md`、`docs/spec/index.md`、`docs/spec/retention-immutability.md`、`docs/spec/review-2026-06-03.md`、`docs/spec/waiver-approval.md` が表示される。 |
| code-to-gate analyze | pass | `node C:\Users\ryo-n\Codex_dev\code-to-gate\dist\cli.js analyze . --emit all --out docs\spec\code-to-gate-2026-06-03` が exit 0。findings 0 件、critical 0 件、high 0 件。 |
| code-to-gate readiness | pass | `node C:\Users\ryo-n\Codex_dev\code-to-gate\dist\cli.js readiness . --policy C:\Users\ryo-n\Codex_dev\code-to-gate\.github\ctg-policy.yaml --from docs\spec\code-to-gate-2026-06-03 --out docs\spec\code-to-gate-2026-06-03` が exit 0。`release-readiness.json` は status `passed`、failed conditions 0 件。 |
| code-to-gate export | pass | `manual-bb-export.json` と `state-gate-export.json` を生成し、manual-bb / state-gate 連携用の finding seed が 0 件であることを確認した。 |
| RanD KanoMode audit | pass | `C:\Users\ryo-n\Codex_dev\RanD\research-runtime` の KanoMode `build_audit_artifacts` を使用し、`requirements_audit_packet.json` と `kano.json` を生成した。gate summary は go=5、conditional_go=0、no_go=0、overall `go`。 |

再検収結論:

- 仕様内容 Gate: `go`
- 正式な実装前 Gate: `go`
- 実装着手 Gate: `go`
- IPO controlled release Gate: `no_go`

IPO controlled release Gate を `no_go` に据え置く理由は、release 判定に必要な TypeScript 型、JSON Schema、CLI、fixture 実体、own-output validation、実証済み evidence package が未実装であるため。これは実装前 Gate の失敗ではなく、release Gate の未充足として分離する。

## 9. code-to-gate Gate 証跡

2026-06-03 に `C:\Users\ryo-n\Codex_dev\code-to-gate` v1.4.1 を併用し、QEG repository を静的 Gate として検収した。

| artifact | result | interpretation |
|---|---|---|
| `docs/spec/code-to-gate-2026-06-03/analysis-report.md` | findings 0、critical 0、high 0 | 仕様書追加後の repository static analysis として blocker はない。 |
| `docs/spec/code-to-gate-2026-06-03/release-readiness.json` | status `passed`、failed conditions 0 | code-to-gate policy 上の readiness は通過。 |
| `docs/spec/code-to-gate-2026-06-03/manual-bb-export.json` | findings 0 | manual-bb-test-harness へ渡す追加リスク seed はない。 |
| `docs/spec/code-to-gate-2026-06-03/state-gate-export.json` | findings 0 | state-gate 連携用の追加 block / hold seed はない。 |

この `passed` は code-to-gate の repository static gate 結果であり、QEG の IPO controlled release approval ではない。QEG の IPO controlled release Gate は、型、schema、CLI、fixture、own-output validation、実証済み evidence package が揃うまで `no_go` のままとする。

## 10. RanD KanoMode 監査証跡

2026-06-03 に `C:\Users\ryo-n\Codex_dev\RanD` の KanoMode audit helper を使い、QEG の IPO 統制仕様書 Gate を Kano-inspired requirements audit として再評価した。

| artifact | result | interpretation |
|---|---|---|
| `docs/spec/kano-mode-2026-06-03/qeg-kano-audit-evidence.json` | QEG-KANO-001〜005 | Gate policy、approval separation、evidence package、retention、dual-gate evidence を audit evidence として固定。 |
| `docs/spec/kano-mode-2026-06-03/kano.json` | must_be 3、performance 1、attractive 1 | IPO 統制として落としてはいけない must-be と、競争力を上げる performance / attractive を分離。 |
| `docs/spec/kano-mode-2026-06-03/requirements_audit_packet.json` | go=5、conditional_go=0、no_go=0、overall `go` | 仕様書 Gate の価値妥当性、検収可能性、実装整合性は KanoMode audit 上も Go。 |

この `go` は Kano-inspired audit の結果であり、正式な狩野モデル調査、顧客検証、IPO controlled release approval ではない。IPO controlled release Gate は、型、schema、CLI、fixture、own-output validation、実証済み evidence package が揃うまで `no_go` のままとする。
