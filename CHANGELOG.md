# Changelog

## 0.3.0 - 2026-07-20

Reliability / Resilience contract と公開型を追加する pre-1.0 minor release。

- resilience test / evidence、Reliability policy、signal manifest、drill-down accountingを公開。
- DQ-18〜DQ-21、BLK-REL-01〜04、risk/test双方へscopeされたwaiverを追加。
- evaluatorをtyped stageへ分割し、semantic validation、artifact revision分類、stable sortをfail-closedに統一。
- Lakda、Toxiproxy、shell、CIのevidence normalizerとpath / symlink / atomic-write hardeningを追加。
- 存在する`evidenced_by` edgeがevidenceの`testId`と矛盾または複数testを指す場合、DQ-18として拒否。
- 53 fixture（Reliability / Resilience 22件）、public source / packed type contract、Node 20 / 24 CIで回帰検証。
- package / CLI / external Actionを0.3.0へ更新。graph wire contractは`qegVersion=0.2`を維持。

Breaking: Reliabilityを有効化するconsumerには完全Git SHA、SHA-256 policy hash、profile / policy identity一致、artifact verification reportが必要。legacy reliability-disabled graphは引き続き受理する。

## 0.2.0

破壊的な pre-1.0 minor release。

- 共通preflight、runtime schema、実ファイルのhash/revision検証を追加。
- qeg-ci-report-v2 とfail-closedな changed-only を導入。
- Gate、schema、evidence検証をLibrary APIとして公開。
- 31 fixtureをmanifestで管理し、全snapshotを回帰検証。
- Actionを0.2.0へ固定し、既定enforce trueへ変更。

Breaking: qegVersionは0.2。必須schema不適合はDQ-01、差分検出不能はexit 1。
