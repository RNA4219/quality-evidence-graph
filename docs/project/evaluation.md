---
intent_id: INT-QEG-EVAL-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-07-04
next_review_due: 2026-08-04
---

# Evaluation

## Acceptance Criteria

- `docs/requirements.md`、`docs/project/blueprint.md`、`README.md`、`docs/project/runbook.md`、`docs/project/guardrails.md`、`docs/agent/HUB.codex.md` が矛盾しないこと。
- `src/types.ts` の `GateProfile` / `DisqualificationCode` と schema enum が一致すること。
- `docs/requirements.md` が Git 管理対象かつ package 配布対象であること。
- `docs/birdseye/index.json` と `docs/birdseye/caps/*.json` が主要ファイルを指すこと。
- `ipo_controlled` profile、DQ-15〜DQ-17、waiver governance、evidence immutability が要件に明記されていること。
- `conditional_go` の exit code policy が profile 依存として定義されていること。
- `docs/project/tasks.codex.md` が TASK-01〜TASK-10 の実装順、対象、受入条件を固定していること。
- `fixtures/README.md` が minimal / negative fixture の期待 verdict / DQ を固定していること。
- `docs/control-mapping.md` と `docs/ipo-controlled-profile.md` が IPO 統制実装準備の最小契約を固定していること。
- `docs/spec/` が Gate policy、waiver、approval evidence、evidence package、retention、immutability、仕様書検収を章別に固定していること。
- `docs/requirements.md`、`docs/control-mapping.md`、`docs/ipo-controlled-profile.md`、`docs/spec/*.md` の verdict 定義と DQ 優先順位が矛盾しないこと。
- `docs/spec/review-2026-06-03.md` が仕様書見直し結果、修正方針、残リスク、Gate 判定を記録していること。
- `docs/spec/gate-acceptance-2026-06-03.md` が manual-bb-test-harness の順序で実装前 Gate を厳格に判定していること。
- `docs/spec/code-to-gate-2026-06-03/` が code-to-gate による repository static gate 証跡を保持し、release approval と混同されないこと。
- `docs/spec/kano-mode-2026-06-03/` が RanD KanoMode による requirements audit 証跡を保持し、正式な狩野調査または release approval と混同されないこと。
- `docs/spec/implementation-gate-2026-06-03.md` が実装完了範囲、未実装 DQ code、IPO controlled release Gate `no_go` 維持理由を記録していること。
- `docs/implementation-prep-gate-2026-06-02.md` が implementation preparation Go と IPO controlled release No-Go を分離していること。
- CI 用 `report` コマンドが複数 target を最後まで評価し、CLI error / DQ / blocker / residual risk / human review を累積表示できること。
- `.github/workflows/ci.yml` が QEG report artifact を保存し、各診断 step を完走させてから最終判定で job を落とすこと。

## Test Outline

- TypeScript:
  - `npm run typecheck`
- JSON:
  - `schemas/*.json` の parse
  - `package.json` の parse
- Release dry-run:
  - `npm pack --dry-run --cache ./.npm-cache`
- CI cumulative report:
  - `npm run report -- fixtures/positive-release-go`
  - `npm run report -- --json fixtures/positive-release-go`
- GitHub Actions workflow:
  - `.github/workflows/ci.yml` が `.qeg/qeg-ci-report.json` を upload artifact 対象にしている
  - `Final CI verdict` が install / typecheck / build / JSON parse / package dry-run / QEG report の outcome を集約している
  - `workflow_dispatch` の `qeg_report_targets` で failing demo target を指定できる
  - `QEG cumulative report` step が QEG exit code を output に退避し、step 自体は成功終了する
- IPO control specs:
  - `git ls-files docs/spec/index.md docs/spec/gate-policy.md docs/spec/waiver-approval.md docs/spec/evidence-package.md docs/spec/retention-immutability.md docs/spec/acceptance.md docs/spec/review-2026-06-03.md docs/spec/gate-acceptance-2026-06-03.md`
- code-to-gate:
  - `node C:\Users\ryo-n\Codex_dev\code-to-gate\dist\cli.js analyze . --emit all --out docs\spec\code-to-gate-2026-06-03`
  - `node C:\Users\ryo-n\Codex_dev\code-to-gate\dist\cli.js readiness . --policy C:\Users\ryo-n\Codex_dev\code-to-gate\.github\ctg-policy.yaml --from docs\spec\code-to-gate-2026-06-03 --out docs\spec\code-to-gate-2026-06-03`
- RanD KanoMode:
  - `docs/spec/kano-mode-2026-06-03/requirements_audit_packet.json` の `gate_summary.overall_assessment` が `go`
- Implementation Gate:
  - `docs/spec/implementation-gate-2026-06-03.md` の implementation completion Gate と IPO controlled release Gate を確認する
- Birdseye:
  - `docs/birdseye/index.json` の parse
  - index が主要 docs / schemas / src を参照していること

## Verification Checklist

- [ ] `npm run typecheck` が成功した
- [ ] schema JSON parse が成功した
- [ ] `npm pack --dry-run --cache ./.npm-cache` が成功した
- [ ] `npm run report -- fixtures/positive-release-go` が成功した
- [ ] `npm run report -- --json fixtures/positive-release-go` が成功し、`summary.totalTargets` と `targets[]` を出力した
- [ ] `.github/workflows/ci.yml` が QEG report artifact を `if: always()` で upload する
- [ ] `.github/workflows/ci.yml` が manual demo 用 `workflow_dispatch.inputs.qeg_report_targets` を持つ
- [ ] `.github/workflows/ci.yml` が QEG report の非 0 exit を直接 shell failure にせず、`Final CI verdict` へ集約する
- [ ] tarball contents に `docs/requirements.md` が含まれる
- [ ] Birdseye index と capsule が主要ファイルを指す
- [ ] IPO controlled profile の統制要件が requirements / README / BLUEPRINT に同期している
- [ ] TASK 台帳、fixture 契約、control mapping、IPO profile、実装準備 Gate record が package に含まれる
- [ ] `docs/spec/` が package に含まれ、TASK-09 / TASK-10 の実装判断が閉じている
- [ ] `docs/spec/review-2026-06-03.md` が package に含まれ、仕様書 review Gate が Go である
- [ ] `docs/spec/gate-acceptance-2026-06-03.md` が package に含まれ、実装前 Gate の No-Go / Go 理由が traceable である
- [ ] code-to-gate の `release-readiness.json` が status `passed` を示し、その `passed` が IPO controlled release approval ではないと Gate 記録に明記されている
- [ ] RanD KanoMode の `requirements_audit_packet.json` が overall `go` を示し、その `go` が正式な狩野調査または IPO controlled release approval ではないと Gate 記録に明記されている
- [ ] 実装 Gate 記録が DQ-02/04/05/06/08/09/10/11/12/13/14 の未実装を release blocker として明記している
