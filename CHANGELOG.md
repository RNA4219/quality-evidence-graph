# Changelog

## 0.4.0 - Unreleased

- 明示的な入力mode・必須artifact・評価範囲を追加。旧native入力にもinputContractを要求し、空入力のgoを廃止。
- changed_code→obligation→placementの対応、ID重複、参照切れ、有効waiver、real/mock/未実行/失敗証跡を検証。
- RanD・code-to-gate・manual-bbのraw adapter、pure buildGraph/placeTests、対応CLIを実装。
- 4 JSON＋Markdown、互換alias、hash manifestを生成し、失格recordもschema検証。
- initを同梱local Actionへ統一し、旧Actionへの参照を除去。
- normalizer、formatter、policy lint、reliability、fixture migrationを分割し、I/O失敗を診断。
- 過去の一括完成表記と静的解析件数を訂正。wire契約は0.2、release/tag/publishは未実施。

## 0.3.1 - 2026-07-20

GitHub-only distributionとrelease lifecycle evidenceを固めるpatch release。

- ActionへCLI bundleを同梱し、既定実行からnpm registry / npx依存を除去。
- packageをprivate化し、誤publishを防止。
- 変更、リスク、テスト、隔離デプロイ、観測、障害、復旧、新しい証拠を検証するacceptance harnessを追加。
- Linux Node 20/24とWindows Node 24でlifecycle evidence artifactを生成。
- hash-backed fixtureのLFを固定し、OS間のSHA-256再現性を確保。
- graph wire contractは`qegVersion=0.2`を維持。

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
