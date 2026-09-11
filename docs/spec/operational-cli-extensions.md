---
intent_id: INT-QEG-OPERATIONS-CLI-001
owner: quality-evidence-graph
status: active
profile: ipo_controlled
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
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
| `qeg report --changed-only` | 変更に関係する target だけを評価する | 削除・rename両端を含めて絞り込み、読取り失敗や不正入力は通常評価へ回す |
| `qeg report --diff <previous-report.json>` | 前回 report との差分を作る | DQ を `new` / `resolved` / `unchanged` に分類する |
| `qeg baseline audit` | baseline の寿命を管理する | 期限切れ、owner 未設定、存在しない target、解消済み DQ を検出する |
| `qeg doctor` | 導入環境を診断する | Node version、`dist/cli.js`、schema compile、workflow、target artifact を検査する |
| `qeg explain <DQ>` | DQ の直し方を説明する | 意味、原因、必要証跡、最小修正、参照仕様を表示する |
| `qeg schema-check` | schema compile と fixture validation を行う | schema 破損と fixture/schema drift を item 別に報告する |
| `qeg enum-check` | 型と schema enum の drift を検出する | Gate / DQ に加え、EvidenceKind、test type、resilience adapter・fault・signal enum の差分を報告する |
| `qeg evidence verify` | 証跡実体を高速検証する | artifact path、hash、revision、retention、storageClassification を検査する |
| `qeg evidence normalize --adapter <kind> --input <raw.json> --context <context.json> --out <evidence.json> [--base-dir <dir>] [--force]` | 外部 resilience evidence を canonical node へ変換する | base-dir containment、raw/context conflict、schema validation、atomic output を実施し、provenance と hash を保持した qeg-resilience-evidence-v1 を出力する |
| `qeg policy lint` | GatePolicy を検査する | `policyHash`、`sourceRefs`、`exitCodePolicy`、`dqScope`、profile の矛盾を検出する |
| `qeg repro-bundle` | CI failure の再現 bundle を作る | redaction、target別の一意な入力名、取得失敗の明示、全fileのhashと完了世代を検証する |
| `qeg check` | ローカル総合確認を行う | schema-check、enum-check、doctor、evidence verify、policy lint、snapshot、report をまとめて実行する |
| `qeg snapshot` | report の golden snapshot を検証する | 新形式はreportのgeneratedAtとtarget欄のみを正規化。旧形式は保存target基準で読み取り互換を維持する |
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
- schema不正、owner未設定/空白、期限切れ、不正日付、target消失がある。reportとauditは共通の適用資格判定を用いる。

baselineは`report-baseline.schema.json`に従う。target省略だけを全対象への明示許容とし、指定時はcwdを基準に絶対pathへ正規化して完全一致させる。suffix一致は行わない。expiry省略はwarning、評価時点は読取り開始時の時計を使う。現在のDQと一致しない項目はaudit warningであり、reportでも何も許容しない。不適格baselineはreport-level `BASELINE_INVALID` / exit 1を返し、targetの評価と診断出力は継続する。

## 4.1 Report diff

`report --diff <previous-report.json>` は前回 CI report と current report を比較し、`diff` field に次を出力する。

- `new`: current report にだけ存在する DQ。
- `resolved`: 今回評価できた同じtargetで消えたDQ。入力DQ-01を含むtargetは解消の証明にしない。
- `unchanged`: 両方に存在する DQ。
- `unverified`: 前回DQのうち、targetが未選択なら`not_evaluated`、CLI error・verdict欠落・入力DQ-01なら`evaluation_failed`として解消未確認を記録する。

JSON/text/GitHub SummaryとActionのsummary artifactでunverifiedを表示する。旧qeg-ci-report-v2にunverifiedがなくても読める。未選択targetを評価済みに昇格しない。

比較 key は target、DQ code、message、nodeIds とする。absolute path は repo root を `<repo>` に正規化する。

## 5. Changed-only

`--changed-only` は次の順に変更ファイルを取得する。

1. `QEG_CHANGED_FILES`
2. `git diff --name-only -z --no-relative --no-renames --diff-filter=ACDMRTUXB origin/main...HEAD`
3. `git diff --name-only -z --no-relative --no-renames --diff-filter=ACDMRTUXB HEAD~1...HEAD`
4. `git status --porcelain=v1 -z --untracked-files=all`（履歴を取得できない場合）

Git取得pathは`git rev-parse --show-toplevel`を基準とし、QEG_CHANGED_FILESはcwd相対または絶対pathとする。targetはcwd相対または絶対path。絶対pathへ正規化して比較し、Windowsでは大文字小文字を同一視する。target相対artifact参照と既存workspace相対参照を保守的に照合する。

変更選択・baseline・差分比較では、junction/symlinkやWindowsの短縮名を実体pathへ揃える。削除済みpathは最寄りの存在する祖先を解決して残りの相対部分を接続し、変更対象から落とさない。別々の実体directoryは同名でも一致させない。

親指定のtarget discoveryはgate-input/expected verdictに加え、ingest-manifest、qeg.bundle、test-placement-plan、output-manifest、quality-evidence-record、migration-reportをconsumer markerとする。入力が欠落/ディレクトリでもmarkerがある子は評価へ渡し、無関係な子folderだけを除く。すべての識別markerを削除したfolderは自動識別できないため、その場合はtargetを明示する。

対象 target は、target directory 自体、`metadata.inputArtifacts[].path`、または graph の `changed_code.path` が変更ファイルと一致した場合に評価対象になる。Gitの削除Dを含め、renameは旧pathの削除と新pathの追加として両端を収集する。NUL区切りを使い、空白・日本語・Gitのpath quotingで対応が失われることを防ぐ。

入力は世代排他とschema検証を通して読む。欠落・不正JSON・schema違反・公開中・中断状態などで関連性を確定できない場合、そのtargetを通常評価へ回し、CLI errorまたはDQを累積する。正常に読み取れて無関係なtargetだけを除外する。確実に対象が0件なら空report / exit `0`。履歴も変更を含むworktreeも取得できなければ`detection_failed` / exit `1`。

### 配布物とconsumer workspace

QEG自身のCLI/schema/バージョン/Node要件は配布物の位置から解決し、workflowと実入力はconsumer側を調べる。build-actionは型のunionから`qeg-report-action/runtime-metadata.json`を生成し、package情報とenum検査データを同梱する。enum-checkはこの型由来データと同梱schemaを比較し、双方の空集合も失敗にする。srcを含まないtarballと、initがコピーしたruntimeでもdoctor/enum-check/check/repro-bundleが動作する。consumerの同名package.json/schemasはQEGの検査データとして使わない。

### Repro bundle の完全性

`qeg-repro-bundle-v1`のmanifestを維持し、入力の`files[]`へ`sourceTarget`、取得できなかった入力へ`inputErrors: [{target, error}]`を追加する。入力の保存名はtargetの完全pathのSHA-256から作る。同じbasenameの別targetも別ファイルとなり、入力順を変えて再実行しても対応付けを維持する。利用者はmanifestの`files`を参照し、古いfileをglobで取り込まない。

全JSONをメモリ上で組み立て、入力・report・診断本文へredactionを適用してからhashを記録する。manifestの構造path・sourceTarget・hashは対応関係を維持するためそのまま保持し、保存先名にsecret等の語があっても参照を壊さない。`manifest.json`を含めて世代公開し、正式読取り・全file hash照合まで同じlease内で行う。書込み失敗を入力欠落として握りつぶさない。入力欠落・不正JSON等の取得失敗は`inputErrors`とCLI出力へ明示する。診断bundle生成のexit `0`は対象のGate合格を意味しない。

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

## report / Action contract（0.4.0）

report JSONはqeg-ci-report-v2とし、selectionとトップレベルerrorsを持つ。Git差分取得成功後の関連targetなしだけno_relevant_changes/exit 0とする。Git未初期化、shallow clone不足、全strategy失敗はdetection_failed/exit 1である。QEG_CHANGED_FILES指定時はGitを参照しない。

checkはschema-check、enum-check、doctor、evidence verify、policy lint、snapshot、reportを集約する。initは同じ配布物のAction・CLI・schema・licenseを `.qeg/runtime` にコピーし、workflowでlocal Actionを参照する。npm registryや未公開tagへ依存しない。既定enforceはtrueとする。install/build/report失敗もreport errorとexit 1へ反映し、artifact upload後にfailureを返す。report-command overrideは互換用に維持する。release lifecycle acceptanceは空initの失格を確認後、明示したnative fixtureで隔離配置、schema破損、復旧、新しいhash付き証跡を検証する。実clusterの障害注入を示すものではない。
