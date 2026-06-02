# Quality Evidence Graph

<!-- LLM-BOOTSTRAP v1 -->
読む順番:
1. `HUB.codex.md` …… repo 内ドキュメントの入口とタスク分解ルール
2. `docs/birdseye/index.json` …… ノード一覧・隣接関係
3. `docs/birdseye/caps/*.json` …… 必要ノードだけ point read
4. `BLUEPRINT.md` / `docs/requirements.md` / `RUNBOOK.md` / `EVALUATION.md`

フォーカス手順:
- 直近変更ファイル±2hopのノードIDを `docs/birdseye/index.json` から取得
- 対応する `docs/birdseye/caps/*.json` のみ読み込む
- Birdseye の世代や capsule が不整合なら、暫定読みに留めて再生成を要求する
<!-- /LLM-BOOTSTRAP -->

`Quality Evidence Graph` は、仕様、実装差分、リスク、テスト配置、実行証跡、Gate 判定を単一の証跡グラフとして扱う local-first な品質ゲート基盤です。

初期 MVP は `RanD`、`code-to-gate`、`manual-bb-test-harness` の artifact を必須入力として取り込み、次の 4 つの契約を出力します。

- `qeg.bundle.json`
- `test-placement-plan.json`
- `gate-verdict.json`
- `quality-evidence-record.json`

## 開発入口

```sh
npm run typecheck
npm run build
```

## 現在の実装範囲

- TypeScript の canonical 型定義
- MVP artifact の JSON Schema 初期版
- `go / conditional_go / no_go / disqualified` の Gate 契約
- `unit / integration / system / e2e / manual-scripted / manual-exploratory / spec-clarification` の配置層契約
- `workflow-cookbook` の Birdseye / Capsule / Task Seed 型を作業準備用参照として扱う契約

## 方針

- 根拠のない claim を Gate 判定に使わない
- `sourceRefs`, `assumptions`, `confidence` を traceability の最小単位にする
- 必須接続先は `RanD`、`code-to-gate`、`manual-bb-test-harness` の 3 つに限定する
- `workflow-cookbook` は adapter ではなく、実装準備と文書構造化の補助契約として使う
- schema validation を通らない出力は判定不能として扱う
- IPO レベルの運用では `ipo_controlled` profile、版管理された Gate policy、waiver governance、監査用 evidence package を必須化する
