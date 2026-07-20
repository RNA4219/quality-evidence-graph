# Changelog

## 0.2.0

破壊的な pre-1.0 minor release。

- 共通preflight、runtime schema、実ファイルのhash/revision検証を追加。
- qeg-ci-report-v2 とfail-closedな changed-only を導入。
- Gate、schema、evidence検証をLibrary APIとして公開。
- 53 fixture（Reliability / Resilience 22件）をmanifestで管理し、全snapshotを回帰検証。
- Actionを0.2.0へ固定し、既定enforce trueへ変更。
- test node に `testExecutionMode=real|mock` を必須化し、mock test を Gate 証跡の件数・強度・green 回数・risk coverage から除外。除外結果は `testEvidenceAccounting` に記録。
- resilience test / evidence、DQ-18〜DQ-21、BLK-REL-01〜04、waiver、normalizer、artifact / signal verificationを追加。
- 存在する`evidenced_by` edgeがevidenceの`testId`と矛盾または複数testを指す場合、DQ-18としてfail-closedにする。

Breaking: qegVersionは0.2。必須schema不適合はDQ-01、差分検出不能はexit 1。
