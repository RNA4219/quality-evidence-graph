---
intent_id: INT-QEG-RUNBOOK-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-07-20
next_review_due: 2026-10-20
---

# Runbook

## Environments

- Local: Node.js 20 以上
- CI: Node.js 20 / 24、public type contract、runtime / fixture、package、Birdseye、JSON parse、QEG cumulative report を必須確認にする
- Release dry-run: `npm pack --dry-run --cache ./.npm-cache`

## Execute

### 1. 準備

```sh
npm ci
```

依存が既にある場合は省略できる。

### 2. 型検証

```sh
npm run typecheck
```

期待結果:

- TypeScript contract が compile できる
- `src/types.ts` と schema enum の不整合がない

### 3. JSON schema parse

```sh
node -e "const fs=require('fs'); for (const f of fs.readdirSync('schemas').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('schemas/'+f,'utf8')); console.log('schemas ok')"
```

期待結果:

- `schemas/*.json` が JSON として parse できる

### 3.5 schema / enum drift check

```sh
npm run schema-check
npm run enum-check
```

期待結果:

- `schemas/*.schema.json` が Ajv で compile できる
- `GateProfile`、`GateVerdict`、`DisqualificationCode` が TypeScript 型と JSON Schema enum で一致する
- test node の `testExecutionMode=real|mock` が schema/type で一致し、mock test が `testEvidenceAccounting.excludedMockTests` に記録される

### 4. CI cumulative report

```sh
npm run build
npm run report -- --json --out .qeg/qeg-ci-report.json fixtures
```

期待結果:

- `report` が対象 fixture / target を最後まで評価する
- `gate-input.json` 欠落、ingest error、DQ、blocker、residual risk、human review が累積レポートに出る
- `--github-summary` 指定時は GitHub Step Summary に人間向け要約を追記する
- `--baseline <path>` 指定時は既知 DQ を `baseline_accepted` として通常 pass と分けて数える
- `--changed-only` 指定時は変更に関係する target だけを評価する
- CLI error がある場合は exit code `1`
- Gate failure だけの場合は exit code `2`
- 全 target が `go` の場合は exit code `0`
- CI では `.qeg/qeg-ci-report.json` を artifact として保存する

GitHub Actions の標準 workflow は `.github/workflows/ci.yml` とし、report 生成は `qeg-report-action` へ寄せる。

- install、typecheck、build、JSON parse、package dry-run、QEG report は `continue-on-error` で完走させる
- `QEG_REPORT_TARGETS` の既定値は repo self-check 用の `fixtures/positive-release-go`
- 実運用 repo では `QEG_REPORT_TARGETS` を実際の QEG target path に差し替える
- manual demo では Actions の `CI` workflow を `qeg_report_targets=fixtures/negative-approval-missing` で実行し、赤 job でも report artifact が保存されることを確認する
- `.qeg/qeg-ci-report.json` を `qeg-ci-report` artifact として保存する
- `qeg-report-action` は QEG の exit code を `exit_code` step output に退避して成功終了し、GitHub の汎用 `Process completed with exit code ...` 表示を避ける
- 最後の `Final CI verdict` step だけが各 step outcome を集約して job を失敗させる

### 4.5 運用補助コマンド

```sh
npm run explain -- DQ-15
npm run doctor -- fixtures/positive-release-go
npm run check -- fixtures/positive-release-go
npm run evidence -- verify fixtures/positive-release-go
npm run policy -- lint fixtures/positive-release-go
npm run baseline -- audit .qeg/qeg-baseline.json fixtures
npm run snapshot -- fixtures/positive-release-go
```

期待結果:

- `explain` が DQ の意味、原因、必要証跡、最小修正、参照仕様を表示する
- `doctor` が Node version、`dist/cli.js`、schema compile、workflow、target artifact を診断する
- `check` が schema-check、enum-check、doctor、snapshot、report を一括実行する
- `evidence verify` が artifact path、hash、revision、retention、storageClassification を Gate 前に検査する
- `policy lint` が GatePolicy の hash、sourceRefs、exitCodePolicy、dqScope、profile を検査する
- `baseline audit` が owner 未設定、期限切れ、解消済み DQ、存在しない target を検出する
- `snapshot` が `expected-report.json` と現在の report を比較する

### 5. Release dry-run

```sh
npm pack --dry-run --cache ./.npm-cache
```

期待結果:

- `docs/requirements.md` が tarball contents に含まれる
- `schemas/` が tarball contents に含まれる
- `README.md`、`docs/project/blueprint.md`、`docs/project/runbook.md`、`docs/project/evaluation.md`、`docs/project/guardrails.md`、`docs/agent/HUB.codex.md` が配布対象に含まれる
- `docs/project/tasks.codex.md`、`fixtures/README.md`、`docs/control-mapping.md`、`docs/ipo-controlled-profile.md`、`docs/implementation-prep-gate-2026-06-02.md` が配布対象に含まれる
- `docs/spec/` が配布対象に含まれる
- `qeg-report-action/` が配布対象に含まれる

### 5.5. 0.3.0 publish（履歴・v0.3.1では使用禁止）

公開は、release branchとmainの全Gateが緑になった後に実行する。

```sh
git switch main
git pull --ff-only origin main
npm ci
npm run build
npm pack --json --pack-destination <release-artifact-dir>
git tag -a v0.3.0 -m "Quality Evidence Graph v0.3.0"
git push origin v0.3.0
npm publish <release-artifact-dir>/quality-harness-quality-evidence-graph-0.3.0.tgz --access public
gh release create v0.3.0 <release-artifact-dir>/quality-harness-quality-evidence-graph-0.3.0.tgz --title "Quality Evidence Graph v0.3.0" --notes-file docs/release-notes/2026-07-20-v0.3.0.md
```

公開条件:

- tag target、GitHub Release target、npm tarball sourceは同一main commitとする。
- 既存tagを移動・再利用しない。
- npm publish前にtarball install、`qeg --version`、library import、schema-checkを実行する。
- npm publish後にregistry metadataとfresh installを再確認する。
- tag、GitHub Release、npm packageのいずれかが失敗した場合、既に公開済みのimmutable artifactは変更せず、原因を直して同一versionの未完了操作だけを再試行する。

### 6. IPO 統制仕様書確認

```sh
git ls-files docs/spec/index.md docs/spec/gate-policy.md docs/spec/waiver-approval.md docs/spec/evidence-package.md docs/spec/retention-immutability.md docs/spec/acceptance.md docs/spec/review-2026-06-03.md docs/spec/gate-acceptance-2026-06-03.md
```

期待結果:

- `docs/spec/*.md` が Git 管理対象である
- `docs/spec/index.md` から Gate policy、waiver / approval、evidence package、retention / immutability、仕様書検収へ辿れる
- `docs/spec/review-2026-06-03.md` が仕様書 review Gate と残リスクを記録している
- `docs/spec/gate-acceptance-2026-06-03.md` が実装前 Gate の Go/No-Go 判定を記録している

### 7. code-to-gate Gate 証跡

```sh
node C:\Users\ryo-n\Codex_dev\code-to-gate\dist\cli.js analyze . --emit all --out docs\spec\code-to-gate-2026-06-03
node C:\Users\ryo-n\Codex_dev\code-to-gate\dist\cli.js readiness . --policy C:\Users\ryo-n\Codex_dev\code-to-gate\.github\ctg-policy.yaml --from docs\spec\code-to-gate-2026-06-03 --out docs\spec\code-to-gate-2026-06-03
node C:\Users\ryo-n\Codex_dev\code-to-gate\dist\cli.js export manual-bb --from docs\spec\code-to-gate-2026-06-03 --out docs\spec\code-to-gate-2026-06-03\manual-bb-export.json
node C:\Users\ryo-n\Codex_dev\code-to-gate\dist\cli.js export state-gate --from docs\spec\code-to-gate-2026-06-03 --out docs\spec\code-to-gate-2026-06-03\state-gate-export.json
```

期待結果:

- `analysis-report.md` が findings 0 件、critical 0 件、high 0 件を示す
- `release-readiness.json` が status `passed`、failed conditions 0 件を示す
- code-to-gate の `passed` は repository static gate の証跡であり、IPO controlled release approval ではない

### 8. RanD KanoMode 監査証跡

```sh
cd C:\Users\ryo-n\Codex_dev\RanD\research-runtime
uv run python -c "import json, sys; from pathlib import Path; sys.path.insert(0, r'C:\Users\ryo-n\Codex_dev\RanD\research-runtime\src'); from rand_research.fetchers import parse_audit_fixture_json; from rand_research.kano import build_audit_artifacts; q=Path(r'C:\Users\ryo-n\Codex_dev\quality-evidence-graph'); evidence=q/'docs/spec/kano-mode-2026-06-03/qeg-kano-audit-evidence.json'; out=q/'docs/spec/kano-mode-2026-06-03'; items=parse_audit_fixture_json({'name':'qeg_kano_audit'}, evidence, 20); preset={'audit_topic':'Quality Evidence Graph IPO Control Spec Kano Audit','audit_document_id':'QEG-IPO-SPEC-GATE-2026-06-03','audit_document_ref':'docs://quality-evidence-graph/docs/spec/gate-acceptance-2026-06-03.md','persona_modes':['researcher','gatekeeper','product'],'freshness_window_days':30,'audit_assumptions':['KanoMode output is a Kano-inspired audit hypothesis, not formal Kano survey result.','Audited evidence is the staged QEG spec gate documentation and generated gate artifacts.','QEG release approval remains separated from requirement/specification gate outcomes.']}; artifacts=build_audit_artifacts(items,preset,'qeg-ipo-spec-gate-2026-06-03','QEG-IPO-SPEC-GATE-2026-06-03'); out.mkdir(parents=True, exist_ok=True); (out/'kano.json').write_text(json.dumps(artifacts['kano'],ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); (out/'requirements_audit_packet.json').write_text(json.dumps(artifacts['requirements_audit_packet'],ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(artifacts['requirements_audit_packet']['gate_summary'],ensure_ascii=False))"
```

期待結果:

- `requirements_audit_packet.json.gate_summary.overall_assessment` が `go`
- go=5、conditional_go=0、no_go=0
- KanoMode の `go` は Kano-inspired requirements audit の証跡であり、正式な狩野調査または IPO controlled release approval ではない

### 9. Repository completion Gate

```sh
npm run test:types
npm run test:runtime
npm run test:fixtures
npm run test:package
npm run birdseye-check
node tools/json-check.mjs
```

期待結果:

- 53 fixture（Reliability / Resilience 22件）のmanifest contractとsnapshotがPASS
- public source型とpacked tarball consumer型がPASS
- `negative-resilience-evidenced-by-conflict`がDQ-18 / exit 2
- `docs/release/acceptance-2026-07-20-v0.3.1.md`がrepository完成、外部実環境未評価、publish別判断を分離する

### 10. v0.3.1 GitHub-only release

v0.3.1ではnpm registryへpublishしない。packageは`private: true`とし、GitHub Release tarballとtag固定Actionを正規配布物とする。

```sh
npm ci
npm run build
npm run test:release-lifecycle -- --out .qeg/action-lifecycle/evidence.json
npm run test:package
npm pack --json --pack-destination <release-artifact-dir>
git tag -a v0.3.1 -m "Quality Evidence Graph v0.3.1"
git push origin v0.3.1
gh release create v0.3.1 <release-artifact-dir>/quality-harness-quality-evidence-graph-0.3.1.tgz .qeg/action-lifecycle/evidence.json .qeg/action-lifecycle/before-report.json .qeg/action-lifecycle/fault-observation.json .qeg/action-lifecycle/recovered-report.json --title "Quality Evidence Graph v0.3.1" --notes-file docs/release-notes/2026-07-20-v0.3.1.md
```

release条件:

- tag target、GitHub Release target、tarball source revisionが同一commitである。
- Action bundleを省略時の既定commandで実行でき、npm accessを要求しない。
- Linux Node 20/24とWindows Node 24でrelease lifecycle acceptanceが成功する。
- 障害時のexit 1、復旧時のexit 0、新しいhash付きevidenceが同一runに残る。
- tag上のworkflow_dispatchをpositive targetで再実行し、release artifactを回収する。
- npm publishは実行しない。

## Confirm

- `docs/requirements.md` が Git 管理対象である
- `GateProfile` と schema の `gateProfile` enum が一致する
- `DisqualificationCode` と `gate-verdict.schema.json` の DQ enum が一致する
- `ipo_controlled` profile の要件が `docs/requirements.md`、`README.md`、`docs/project/blueprint.md` に同期されている
- Birdseye index と capsule が変更対象を指している
- mock test は placement retirement の `evidenceStrength`、連続 green 回数、risk coverage に算入されず DQ-14 になる
- `qeg-report-action/action.yml` が Node.js 24 action を使い、`exit_code`、`gate_failed`、`cli_errors`、`dq_count`、`report_path`、`summary_markdown_path` output を持つ
- `docs/spec/operational-cli-extensions.md` が report / baseline audit / doctor / explain / schema-check / enum-check / evidence verify / policy lint / repro-bundle / check / snapshot / init / Action の contract を固定している
- `docs/project/tasks.codex.md` が完了済みTASK-01〜TASK-10の履歴としてsupersededになっている
- `fixtures/README.md` が expected verdict / DQ を固定している
- `docs/control-mapping.md` と `docs/ipo-controlled-profile.md` が IPO 統制実装準備を固定している
- `docs/spec/` が TASK-09 / TASK-10 の実装判断に必要な Gate policy、waiver、approval evidence、retention、immutability、evidence package を固定している
- `docs/spec/review-2026-06-03.md` が仕様書見直し結果、修正方針、残リスクを固定している
- `docs/spec/gate-acceptance-2026-06-03.md` が仕様書 Gate、実装着手 Gate、IPO release Gate を分離している
- `docs/spec/code-to-gate-2026-06-03/` が code-to-gate による静的 Gate 証跡を保持している
- `docs/spec/kano-mode-2026-06-03/` が RanD KanoMode による要求価値監査証跡を保持している
- `docs/spec/implementation-gate-2026-06-03.md` が実装 Gate と release Gate を分離している
- `docs/release/acceptance-2026-07-20-v0.3.1.md` が現行の総合完成判定とrelease境界を記録している

## Rollback / Retry

### ロールバック判断

- schema parse が失敗した
- TypeScript typecheck が失敗した
- `docs/requirements.md` が package から落ちた
- `docs/spec/` が package から落ちた
- `conditional_go` / `ipo_controlled` / DQ enum の契約が requirements / types / schema で不一致
- code-to-gate の `passed` を IPO controlled release approval と誤読する導線がある
- KanoMode の `go` を正式な狩野調査または IPO controlled release approval と誤読する導線がある
- 実装 Gate の `conditional_go` を IPO controlled release Go と誤読する導線がある

### 復旧手順

1. 直近変更ファイルを確認する。
2. `docs/birdseye/index.json` から関連 capsule を読む。
3. requirements / types / schema / README / BLUEPRINT のどれが正本と矛盾したかを特定する。
4. 最小差分で修正する。
5. Execute の 2〜9 を再実行する。

## Observability

- release 判定に使った command、input hash、policy hash、artifact revision、actor、timestamp を `quality-evidence-record.json` または external control evidence に残す。
- IPO controlled profile では silent overwrite 可能な evidence だけを release 判定に使わない。
