---
title: QEG v0.3.1 GitHub-only Release Acceptance
status: release_candidate
date: 2026-07-20
version: 0.3.1
qegVersion: "0.2"
latestCodeBearingCommit: pending
latestCodeCI: pending
latestDocsCI: pending
decision: conditional_go
---

# QEG v0.3.1 GitHub-only Release Acceptance

## 1. 判定対象と境界

対象は、npm registryに依存しないGitHub Action bundle、GitHub Release tarball、およびその配布物を使うrelease lifecycle acceptanceである。QEGはdeploy orchestratorではないため、core graphへdeployment nodeは追加しない。deploymentは対象revisionとenvironmentを結び付けた外部control evidenceとして記録する。

実cluster、実サービスへのfault injection、Lakda real acceptance、consumer組織のpublish approvalは本判定に含めない。

## 2. 8段階の証拠連鎖

| 段階 | 実行・証拠 | 合格条件 |
| --- | --- | --- |
| 変更 | v0.3.1 Action bundle、npm-free既定command、private package | bundle単体で `--version` が0.3.1 |
| リスク | bundle欠落、schema欠落、復旧後の証拠欠落をrisk ID付きで記録 | 全riskにtest/checkを割当 |
| テスト | runtime、package smoke、lifecycle、Node 20/24、Windows 24 | required checkが全成功 |
| デプロイ | bundleとschemaを隔離release directoryへ複製しfresh consumerへinit | source revisionと配置先を記録 |
| 観測 | version、positive report、各commandのexit codeと時刻を記録 | steady stateがexit 0 |
| 障害 | 配置済み `gate-input.schema.json` を意図的に破損 | schema-checkがexit 1 |
| 復旧 | 同一bundle sourceからschemaを復元 | schema-check/reportがexit 0 |
| 新しい証拠 | before/fault/recovered reportとevidence.jsonを新規生成 | SHA-256、revision、観測列が揃う |

## 3. Grounded viewpoints

- 要求: GitHub-onlyで運用でき、単なるversion bumpではなく障害と復旧まで再現できること。
- 実装: `qeg-report-action/dist/cli.mjs`、`tools/action-lifecycle-acceptance.mjs`、strict evidence schema。
- CI: Linux Node 20/24とWindows Node 24でbundle起動、runtime、lifecycle evidenceを検証する。
- 運用: tag固定、release asset hash、workflow artifactをsource revisionへ結び付ける。
- 制約: 実clusterと実サービスのresilienceは未評価であり、repository release acceptanceへ昇格しない。

## 4. リスク

尺度はImpact、Likelihood、Detectability、Control gap、Cross-boundary exposure、Audit gapを各1〜5とし、合計で優先度を決める。

| ID | Failure mode | I/L/D/C/X/A | Score | Priority | Control |
| --- | --- | --- | ---: | --- | --- |
| R-V031-01 | tagのActionにCLI bundleがなく起動できない | 5/3/2/4/5/4 | 23 | P0 | bundle version、package smoke、Action contract |
| R-V031-02 | 配置後にschemaが欠落・破損しても成功扱いになる | 5/2/2/4/4/4 | 21 | P0 | 意図的schema破損とexit 1観測 |
| R-V031-03 | 復旧しても新しい証拠が残らず監査不能 | 4/3/3/4/4/5 | 23 | P0 | recovery後reportとSHA-256 evidence |
| R-V031-04 | LF/CRLF差でartifact hashがOS依存になる | 4/3/2/3/4/4 | 20 | P1 | gitattributesとWindows CI |
| R-V031-05 | npm未公開のままActionがregistry packageを要求する | 5/4/1/4/5/4 | 23 | P0 | npm/npx禁止contract test、bundled default |

## 5. 手動ブラックボックスケース

| Case | 前提 | 操作 | Oracle | 優先度 |
| --- | --- | --- | --- | --- |
| BB-V031-01 | checkout済み | bundleへ `node ... --version` | 0.3.1、exit 0 | P0 |
| BB-V031-02 | fresh consumer | init後にpositive report | parse可能なreport、exit 0 | P0 |
| BB-V031-03 | 隔離配置済み | schemaを破損しschema-check | exit 1、fault observation生成 | P0 |
| BB-V031-04 | BB-V031-03後 | schemaを復元しcheck/report | 両方exit 0、新しいhash付き証拠 | P0 |
| BB-V031-05 | Action利用repo | `report-command`を省略 | npm accessなしでbundle実行 | P0 |
| BB-V031-06 | override利用repo | 明示commandを指定 | 従来overrideが実行される | P1 |

工数は自動lifecycle 5〜10分、GitHub matrix 10〜20分、release tag/asset検証5〜10分を見込む。実cluster受入は別見積りとする。

## 6. Five-tool validation chain

| Stage | 状態 | Evidence boundary |
| --- | --- | --- |
| RanD | historical/ran | 既存Kano-inspired requirements audit。正式市場調査ではない |
| code-to-gate | ran/passed | run `ctg-202607201158-local`。raw 12、accepted-design 1、effective high/critical 0、readiness failed conditions 0。中優先度12件は保守性候補として可視化 |
| HATE | degraded | HATE producerは今回実行せず、lifecycle harnessの実行証跡を直接QEGへ渡す |
| manual-bb | ran | 本書のrisk、case、oracle、Gateで検収 |
| QEG | pending | local全Gate、PR CI、main/tag workflowで最終判断 |

HATEをdegradedとするため、実fault injectionの成功を主張しない。今回の障害は配布済みschema破損という制御されたrelease artifact faultである。

## 7. Gate

現時点は `conditional_go`。以下を満たした時点で `go`へ更新する。

- ローカル全Gateとlifecycle acceptanceが成功する。
- code-bearing commitのLinux Node 20/24、Windows Node 24が成功しartifactを残す。
- docs-only証跡commitの最新CIも成功する。
- mainへ統合後、tag `v0.3.1` とGitHub Release assetが同一commitへ結び付く。
- tag上のworkflow_dispatchでAction bundleとlifecycle evidenceが再検証される。

## 8. Go/No-Go brief

機能の追加量ではなく、配布物が壊れた場合に検知し、復元し、復旧後の新しい証拠を残せることをrelease条件とする。npm registryは条件から除外する。上記Gate完了前はNo-Go、完了後はGitHub-only v0.3.1としてGoとする。
