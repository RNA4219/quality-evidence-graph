---
intent_id: INT-QEG-OPERATIONS-CLI-001
owner: quality-evidence-graph
status: active
profile: ipo_controlled
last_reviewed_at: 2026-07-04
next_review_due: 2026-08-04
---

# Operational CLI Extensions

## 1. 目的

この仕様は、QEG を実運用の CI に組み込んだときの作業性と安定性を高めるための CLI / GitHub Actions contract を定義する。

特に、CI のクリーン環境では証跡が存在しない状態が自然に起きる。そのため、QEG は最初の 1 件で停止せず、実行可能な target を最後まで評価し、足りない証跡、DQ、blocker、human review を累積で提示しなければならない。

## 2. コマンド contract

| Command | 目的 | 成功条件 |
|---|---|---|
| `qeg report` | 複数 target の累積 Gate report を作る | target を最後まで評価し、`qeg-ci-report-v2` を出力する |
| `qeg report --github-summary` | GitHub Actions Step Summary へ人間向け要約を書く | `GITHUB_STEP_SUMMARY` がある場合に Markdown summary を追記する |
| `qeg report --baseline <path>` | 既知 DQ を baseline として受理する | すべての current DQ が baseline で覆われ、他の failure がない場合だけ `baseline_accepted` にする |
| `qeg report --changed-only` | 変更に関係する target だけを評価する | `QEG_CHANGED_FILES` または git diff で target を絞り込む |
| `qeg report --diff <previous-report.json>` | 前回 report との差分を作る | DQ を `new` / `resolved` / `unchanged` に分類する |
| `qeg baseline audit` | baseline の寿命を管理する | 期限切れ、owner 未設定、存在しない target、解消済み DQ を検出する |
| `qeg doctor` | 導入環境を診断する | Node version、`dist/cli.js`、schema compile、workflow、target artifact を検査する |
| `qeg explain <DQ>` | DQ の直し方を説明する | 意味、原因、必要証跡、最小修正、参照仕様を表示する |
| `qeg schema-check` | schema compile と fixture validation を行う | schema 破損と fixture/schema drift を item 別に報告する |
| `qeg enum-check` | 型と schema enum の drift を検出する | `GateProfile`、`GateVerdict`、`DisqualificationCode` の差分を報告する |
| `qeg evidence verify` | 証跡実体を高速検証する | artifact path、hash、revision、retention、storageClassification を検査する |
| `qeg policy lint` | GatePolicy を検査する | `policyHash`、`sourceRefs`、`exitCodePolicy`、`dqScope`、profile の矛盾を検出する |
| `qeg repro-bundle` | CI failure の再現 bundle を作る | report、doctor、schema inventory、package version、workflow、gate-input を redaction 付きでまとめる |
| `qeg check` | ローカル総合確認を行う | schema-check、enum-check、doctor、evidence verify、policy lint、snapshot、report をまとめて実行する |
| `qeg snapshot` | report の golden snapshot を検証する | `generatedAt` と絶対 path を正規化して比較する |
| `qeg init` | 他 repo へ最小構成を導入する | `.qeg/` と GitHub Actions workflow の starter を生成する |

## 3. Exit code

`report` の exit code は次の通り固定する。

- `0`: CLI error も Gate failure もない。
- `1`: target 評価中に CLI error が 1 件以上ある。
- `2`: CLI error はないが、Gate failure が 1 件以上ある。

`baseline_accepted` は `0` 扱いにできるが、summary では `passed` と分けて数える。

`schema-check` と `enum-check` は検査対象の drift を検出した場合 `2` を返す。これは QEG 自体の実行不能ではなく、契約不一致として扱う。

`doctor` は hard failure がある場合だけ `1` を返す。warning は導入改善のために表示するが、CI の smoke check を止めない。

`baseline audit`、`evidence verify`、`policy lint`、`check` は hard failure がある場合 `1` を返す。warning は表示するが exit `0` を許す。

## 4. Baseline

baseline file は次の最小形式を持つ。

```json
{
  "entries": [
    {
      "target": "fixtures/negative-approval-missing",
      "code": "DQ-15",
      "nodeIds": ["qeg:approval:missing"],
      "owner": "quality-owner",
      "expiresAt": "2099-01-01T00:00:00.000Z"
    }
  ]
}
```

baseline は既知 DQ の移行補助であり、DQ を削除する仕組みではない。次の場合 baseline は適用しない。

- current DQ の一部しか baseline に存在しない。
- blocker、residual risk、required human review が残っている。
- expected verdict / expected DQ との比較に失敗している。
- baseline の target、code、message、nodeIds が current DQ と一致しない。
- `baseline audit` で owner 未設定、期限切れ、target 消失、解消済み DQ と判定された。

## 4.1 Report diff

`report --diff <previous-report.json>` は前回 CI report と current report を比較し、`diff` field に次を出力する。

- `new`: current report にだけ存在する DQ。
- `resolved`: previous report にだけ存在する DQ。
- `unchanged`: 両方に存在する DQ。

比較 key は target、DQ code、message、nodeIds とする。absolute path は repo root を `<repo>` に正規化する。

## 5. Changed-only

`--changed-only` は次の順に変更ファイルを取得する。

1. `QEG_CHANGED_FILES`
2. `git diff --name-only --diff-filter=ACMRTUXB origin/main...HEAD`
3. `git diff --name-only --diff-filter=ACMRTUXB HEAD~1...HEAD`
4. `git diff --name-only --diff-filter=ACMRTUXB`

対象 target は、target directory 自体、`metadata.inputArtifacts[].path`、または graph の `changed_code.path` が変更ファイルと一致した場合に評価対象になる。対象が 0 件の場合、空 report を生成し exit `0` とする。

## 6. GitHub Action

`qeg-report-action` は composite action として提供する。

必須 contract:

- Node.js helper step は Node 24 を既定にする。
- install / build step は optional input とし、既存 CI では空にできる。
- report step は QEG exit code を `exit_code` output に保存し、step 自体は成功終了する。
- `.qeg/qeg-ci-report.json` を artifact として保存できる。
- `--github-summary` により Step Summary に累積レポートを書ける。
- `exit_code`、`gate_failed`、`cli_errors`、`dq_count`、`report_path`、`summary_markdown_path` を output として返す。
- job を赤にする最終判断は呼び出し側の final verdict step に委ねる。

これにより、GitHub Actions の表示が `Process completed with exit code 1` だけで終わることを避け、修正対象を artifact と summary から読めるようにする。

## 7. Acceptance

最小検収コマンド:

```sh
npm run typecheck
npm run build
npm run schema-check
npm run enum-check
npm run explain -- DQ-15
npm run doctor -- fixtures/positive-release-go
npm run evidence -- verify fixtures/positive-release-go
npm run policy -- lint fixtures/positive-release-go
npm run check -- fixtures/positive-release-go
npm run report -- --json --out .qeg/qeg-ci-report.json fixtures/positive-release-go
npm run report -- --json --diff .qeg/qeg-ci-report.json --out .qeg/qeg-ci-report-diff.json fixtures/positive-release-go
npm run snapshot -- fixtures/positive-release-go
npm pack --dry-run --cache ./.npm-cache
```

GitHub Actions では、manual demo target として `fixtures/negative-approval-missing` を指定し、job が最終的に赤でも `qeg-ci-report` artifact と Step Summary が残ることを検収する。

## 0.2.0 report / Action contract

report JSONはqeg-ci-report-v2とし、selectionとトップレベルerrorsを持つ。Git差分取得成功後の関連targetなしだけno_relevant_changes/exit 0とする。Git未初期化、shallow clone不足、全strategy失敗はdetection_failed/exit 1である。QEG_CHANGED_FILES指定時はGitを参照しない。

checkはschema-check、enum-check、doctor、evidence verify、policy lint、snapshot、reportを集約する。外部Actionは0.2.0 CLIへ固定し、既定enforce trueとする。install/build/report失敗もreport errorとexit 1へ反映し、artifact upload後にfailureを返す。
