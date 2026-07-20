---
title: QEG v0.3.1 GitHub-only Release Acceptance
status: released_verified
date: 2026-07-20
version: 0.3.1
qegVersion: "0.2"
latestCodeBearingCommit: cd056f02a8033dfc7b2559e084b343d7155eecbb
latestCodeCI: https://github.com/RNA4219/quality-evidence-graph/actions/runs/29750676199
latestDocsCI: https://github.com/RNA4219/quality-evidence-graph/actions/runs/29751221363
mainMergeCommit: ba46ce20b629c49162a930f2173088f8bc5068da
mainCI: https://github.com/RNA4219/quality-evidence-graph/actions/runs/29752243853
tagWorkflowCI: https://github.com/RNA4219/quality-evidence-graph/actions/runs/29752772714
releaseURL: https://github.com/RNA4219/quality-evidence-graph/releases/tag/v0.3.1
decision: go
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
| QEG | ran/passed | local全Gate、PR run 29750676199、main run 29752243853、tag run 29752772714のLinux Node 20/24・Windows Node 24とlifecycle artifactsが成功 |

HATEをdegradedとするため、実fault injectionの成功を主張しない。今回の障害は配布済みschema破損という制御されたrelease artifact faultである。

## 7. Gate

リリース実行Gateは `go`。code-bearing commit `cd056f02a8033dfc7b2559e084b343d7155eecbb` はPR run [29750676199](https://github.com/RNA4219/quality-evidence-graph/actions/runs/29750676199)で `quality (20)`、`quality (24)`、`portability (windows-24)` がすべて成功し、各jobのlifecycle evidence artifactも保存された。証跡commitはrun [29751221363](https://github.com/RNA4219/quality-evidence-graph/actions/runs/29751221363)で同じ3ジョブが成功した。

- ローカル全Gateとlifecycle acceptance: pass
- code-bearing commitのLinux Node 20/24、Windows Node 24とartifact: pass
- docs-only証跡commitの最新CI: pass

公開Gateも `pass` として閉じた。

- main merge、annotated tag `v0.3.1`、GitHub Release targetはすべて `ba46ce20b629c49162a930f2173088f8bc5068da` と一致した。
- tag上のworkflow_dispatch run 29752772714でAction bundleとlifecycle evidenceを再検証し、3ジョブが成功した。
- GitHub Release公開後、5 assetを再取得し、GitHub側SHA-256とローカル値の一致を確認した。

## 8. Post-release verification

| Evidence | Result |
| --- | --- |
| main CI | run [29752243853](https://github.com/RNA4219/quality-evidence-graph/actions/runs/29752243853)、3ジョブSUCCESS |
| tag CI | run [29752772714](https://github.com/RNA4219/quality-evidence-graph/actions/runs/29752772714)、3ジョブSUCCESS |
| lifecycle provenance | Linux 20/24・Windows 24の全evidenceがsourceRevision `ba46ce20b629c49162a930f2173088f8bc5068da`、fault exit 1、recovery exit 0、verdict `go` |
| tag | annotated tag `v0.3.1` が同じmerge commitを参照 |
| Release | [QEG v0.3.1](https://github.com/RNA4219/quality-evidence-graph/releases/tag/v0.3.1)、draft=false、prerelease=false |
| package asset | `quality-harness-quality-evidence-graph-0.3.1.tgz` — SHA-256 `721c8b110bdea84699395ca6f48e85d46904bc098e1ddef9916e5ca4b62bcde8` |
| Linux Node 20 evidence | SHA-256 `6ea45c4a2b0298879c577eec70918fd9e8ddd78ab11d9bc6bf1841acd810cbde` |
| Linux Node 24 evidence | SHA-256 `0387a49bbd837998528dfac9b7758fbb9197df463e0b6609f9690956ff315c5a` |
| Windows Node 24 evidence | SHA-256 `0bb8b9f92ec9ee3bd5f78bbf0b3e2bc3661d1aa6c729796148920de22af4f020` |

## 9. Go/No-Go brief

GitHub-only v0.3.1は `go`。配布物の変更、risk control、test、隔離deploy、観測、制御されたfault、復旧、復旧後の新証拠までをtag commitへ結び付けて確認した。npm registryは運用・完了条件から除外し、npm publishは行っていない。実clusterと実サービスのresilience acceptanceは別Gateである。
