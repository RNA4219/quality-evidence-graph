# Changelog

## 0.2.0

破壊的な pre-1.0 minor release。

- 共通preflight、runtime schema、実ファイルのhash/revision検証を追加。
- qeg-ci-report-v2 とfail-closedな changed-only を導入。
- Gate、schema、evidence検証をLibrary APIとして公開。
- 31 fixtureをmanifestで管理し、全snapshotを回帰検証。
- Actionを0.2.0へ固定し、既定enforce trueへ変更。

Breaking: qegVersionは0.2。必須schema不適合はDQ-01、差分検出不能はexit 1。
