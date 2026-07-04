# Quality Evidence Graph

Quality Evidence Graph、略して QEG は、品質判断を「気合い」や「それっぽい報告」から切り離し、根拠を持った Gate 判定へ変えるための仕組みです。

仕様、リスク、変更差分、テスト配置、実行証跡、承認証跡を 1 つのグラフとして扱い、release してよいか、止めるべきか、条件付きなら何を人間が承認すべきかを明確にします。

## 何を解決するのか

従来の QA では、次のような問題が起きがちです。

- テスト結果はあるが、どの要求やリスクを守ったのか分からない。
- リスクは語られるが、Gate 判定にどう効いたのか追えない。
- waiver や人間の承認が、後から監査できる形で残らない。
- 「テストした」「問題ない」という説明が、source-backed ではない。

QEG はこれらを、証跡グラフ、DQ、Gate verdict、evidence package に分解します。

## 基本の考え方

QEG の中心は 4 つです。

- **Quality Evidence Graph**: 要求、リスク、変更、テスト、証跡、判定をつなぐグラフ。
- **Test Placement Plan**: どのリスクや変更を、どのテスト層で見るべきかの配置計画。
- **Gate Verdict**: `go`、`conditional_go`、`no_go`、`disqualified` の判定。
- **Quality Evidence Record**: release 判断のために残す証跡 bundle。

`disqualified` は最優先です。DQ が 1 件でもある場合、waiver で消すことはできません。

## Controlled Governance Profile

QEG は MVP だけでなく、監査・統制を前提にした controlled governance profile を持ちます。

この profile では、次が重要です。

- Gate policy の `policyHash` を照合する。
- waiver は source-backed で、期限、影響範囲、rollback、follow-up owner を持つ。
- approval evidence は QEG verdict と分離して扱う。
- producer / reviewer / approver / waiver approver / release owner を記録する。
- evidence package は retention、tamper evidence、storage classification を持つ。
- silent overwrite 可能な保管だけでは release evidence として扱わない。

つまり QEG は、テスト管理ツールではなく、品質判断の統制レイヤです。

## CLI の使い方

最初に build します。

```sh
npm run build
```

fixture を検証します。

```sh
npm run validate -- fixtures/positive-release-go
```

Gate 判定を JSON で出力します。

```sh
npm run gate -- fixtures/positive-release-go
```

Quality Evidence Record を生成します。

```sh
npm run record -- fixtures/positive-release-go
```

CI では、単発のエラーで止まらず不足している証跡や DQ を累積レポートとして出せます。

```sh
npm run report -- fixtures
npm run report -- --json --out .qeg/qeg-ci-report.json fixtures
npm run report -- --json --github-summary --out .qeg/qeg-ci-report.json fixtures
```

`report` は複数 fixture / target を最後まで評価し、`gate-input.json` 欠落、ingest error、DQ、blocker、residual risk、human review 要求をまとめて表示します。exit code は CLI error があれば `1`、Gate failure があれば `2`、全 target が `go` なら `0` です。

運用補助コマンド:

```sh
npm run explain -- DQ-15
npm run doctor -- fixtures/positive-release-go
npm run schema-check
npm run enum-check
npm run snapshot -- fixtures/positive-release-go
npm run init -- --root ../your-repo
```

`--baseline <path>` は既知 DQ を `baseline_accepted` として扱い、新規 DQ だけを赤にしたい移行期間に使います。`--changed-only` は `QEG_CHANGED_FILES` または git diff から変更に関係する target だけを評価します。

GitHub Actions では `.github/workflows/ci.yml` が `qeg-report-action` 経由で report を実行し、`.qeg/qeg-ci-report.json` を `qeg-ci-report` artifact として保存します。install / typecheck / build / JSON parse / package dry-run / QEG report は完走させ、最後の集約ステップで CI を失敗させます。

他 repo から使う最小例:

```yaml
- uses: RNA4219/quality-evidence-graph/qeg-report-action@v1
  id: qeg_report
  with:
    targets: .qeg
    output-path: .qeg/qeg-ci-report.json
    github-summary: "true"
```

デモは Actions の `CI` workflow を手動実行し、`qeg_report_targets=fixtures/negative-approval-missing` を指定します。job は赤になりますが、Step Summary と `qeg-ci-report` artifact に累積不足が残ります。

## 判定の読み方

- `go`: release 条件を満たす。exit code `0`。
- `conditional_go`: 条件付き。controlled governance では CI success と扱わない。exit code `2`。
- `no_go`: blocker が残る。exit code `2`。
- `disqualified`: DQ により判定資格なし。exit code `2`。

`conditional_go` は「通った」ではありません。人間の review や approval が必要な状態です。

## 開発者・エージェント向け

実装や検収に入る場合は、root の [README.md](README.md) と [docs/agent/HUB.codex.md](docs/agent/HUB.codex.md) を入口にしてください。

重要な正本:

- 要求正本: `docs/requirements.md`
- 統制仕様: `docs/spec/`
- 実装 Gate 証跡: `docs/spec/implementation-gate-2026-06-03.md`
- fixture 契約: `fixtures/README.md`

## 現在の状態

- DQ-01 から DQ-17 まで実装済み。
- 29 fixture で regression を保持。
- Test Placement Plan は `placement_changes[]` により manual→automated の引退、replacement 証跡、policy、revert 条件を監査可能に記録できる。
- `code-to-gate` findings 0 を維持。
- `positive-release-go` は `go / exit 0`。
- negative fixture は原則 `disqualified / exit 2`。

QEG は、品質を「説明」ではなく「証跡と判定契約」に落とすための基盤です。
