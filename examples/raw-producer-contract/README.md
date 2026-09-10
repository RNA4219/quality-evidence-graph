# 3 producerのraw入力からGateまで

このディレクトリは契約試験用のfixtureです。RanD 2種、code-to-gate 7種、manual-bb-test-harness 5種の合計14 artifactを、それぞれのproducer形式で保持します。実producerを実行して収集した受入証拠ではありません。実行結果のpassもfixtureの値です。

リポジトリrootでbuild後、入力例を作業用ディレクトリへコピーして実行します。

```powershell
npm run build
New-Item -ItemType Directory -Path .qeg -Force | Out-Null
Copy-Item -LiteralPath examples/raw-producer-contract -Destination .qeg/raw-demo -Recurse
node dist/cli.js build-graph .qeg/raw-demo
node dist/cli.js place-tests .qeg/raw-demo
node dist/cli.js gate .qeg/raw-demo
node dist/cli.js record .qeg/raw-demo
node dist/cli.js schema-check .qeg/raw-demo
```

コピー先が既に存在する場合は別名を使ってください。`ingest-manifest.json` に入力mode、必須集合、producer契約version、相対path、revision、SHA-256、評価scopeを明示しています。rawを書き換える場合は内容に対応するhashをmanifestへ反映します。誤ったhashやrevisionは失格になります。

通常実行の受入では`executionPolicy`と`build-binding.json`でproject/build/revision/environmentの対応を指定し、manual descriptorの`executionContext`を明記します。この例の有効期間24時間、project/environment、producerVersionは合成fixture用の設定です。実環境の既定値ではありません。時計はmetadata.createdAtで固定し、未来実行や対象違いをDQとします。

`build-graph` はbundleとgate-input、`place-tests` は配置計画を生成します。配置前のgateは証拠不足でexit 2、全工程後はfixture scope内でgoになります。`record` は4種のJSON、Markdown、互換alias、6出力のhash manifestを生成し、全JSONをschema検証します。

APIでは `buildGraph(manifest, loadedArtifacts)` と `placeTests(graph, policy)` が同じ処理を提供します。ファイル読込・hash検証はCLI側の責務です。tarballにも本例と固定producer schemaが含まれ、producer repoへの参照なしに動作します。

対応field・version・licenseは [producer仕様](../../docs/spec/producer-adapters.md)、今回の受入結果は [改修台帳](../../docs/project/remediation-2026-09-10.md) を参照してください。fixtureのgoを実環境やrelease approvalへ転用しないでください。
