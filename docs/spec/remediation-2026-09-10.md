---
intent_id: INT-QEG-REMEDIATION-20260910
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# 入力・生成・判定・出力の改修仕様

要求正本は `docs/requirements.md` 第22節。2026-09-10の改修提案R01〜R06を実装する。packageは0.4.0へ更新し、追加フィールドを扱えるqegVersion=0.2を維持する。暗黙入力・未設定入力のgoを失格に変えるため、旧consumerには明示的な移行が必要になる。release/tag/publishおよび実環境のfault実行はこの改修の受入範囲外。

## 入力契約

`GatePolicy.inputContract` を追加する。公開型では旧consumerのコンパイルを維持するためoptionalだが、未指定の評価はDQ-01。単なるparse不能とは分け、修正可能な診断を返す。

| field | 内容 |
|---|---|
| mode | `upstream_artifacts` または `native_graph` |
| requiredArtifacts | `{adapter, kind}` の空でない集合。重複不可 |
| evaluationScope | `{kind, target, notEvaluated}`。kindはfixture / isolated_consumer / real_environment、targetは空でない対象名、notEvaluatedは評価しない範囲の配列 |
| requireExecutedTests | trueなら関連するreal testの成功実行証跡まで要求。falseでもobligationとplacementの関連は必須 |
| sourceRefs | 決定したpolicyの根拠、1件以上 |

- upstream_artifactsではRanD 2種、CTG 7種、manual-bb 5種の必須集合を縮小できない。policyは必要な追加artifactを宣言できる。
- native_graphでもrequiredArtifactsの省略・空集合、artifact欠落、空nodesをgoにしない。modeは入力から推測しない。
- 必須集合とmetadata.inputArtifactsをadapter/kindで照合する。必要なproducerのrequiredConnectorStatusが未記載ならDQ-01、contract_violationならDQ-11。native入力のstatusも生成者が明示する。
- schema違反、未知version、必須payloadの不正はDQ-01。列挙された必須artifactのpath/hash実体検証はDQ-06、revision不一致はDQ-12。optionalだけの不足はwarningを維持する。
- policyのscopeをGate結果・report・recordに含める。過去のfixtureのgoはそのscope内の結果であり、release approvalには変換しない。
- initはupstream_artifactsの必要集合と空graphを作る。その状態のgateはDQ-01 / exit 2。

## raw artifactからの生成

`build-graph <target-dir>` は `ingest-manifest.json` を読み、`qeg.bundle.json` と評価用 `gate-input.json` を生成する。manifestはQEGの入力descriptorであり、producerのraw payloadをQEG独自schemaへ置き換えない。

- manifestVersion=`qeg-ingest/v1`、metadata、policy、artifacts、任意のwaivers/evidencePackageを持つ。
- artifacts各項目はArtifactRefのid/adapter/kind/path/schemaId/revisionと、対応するproducer契約versionを持つ。ファイルはtarget-dir以下の相対pathとし、symlinkを含む外部へのescapeを拒否する。
- contentHashは読み取ったbytesからSHA-256を計算する。manifest側にも値がある場合は完全一致を要求する。metadata.headRefとartifact revisionの不一致を隠さない。
- adapterはraw artifactを読み、requirement / acceptance / risk / changed_code / finding / test / execution_evidenceを正規化する。入力sourceRef、assumptions、confidence、元IDを保持する。未写像fieldは原文に保持するが、producer schemaが禁止するfieldは契約違反として拒否する。
- stable IDはproducer prefixとartifact kind、元IDまたはsemantic keyを基に生成する。時刻・runId・入力順はsemantic IDへ混ぜない。
- schema/version不正や未解決の意味的参照はparser failureとしてpartial graphに残す。成功したartifactを保持し、失敗artifactを成功扱いしない。直接gate_policyを含む外部payloadは拒否し、proposalは提案として保持する。
- requirementの同一性は明示ID/参照または同一semantic keyから判定する。異なる要件をLLMや曖昧な類似度で自動融合しない。audit側をreadinessの優先sourceとして使い、元packetもtraceとして残す。
- 公開APIはI/Oを持たない `buildGraph`。CLIがbyte読込・hash検証・書出しを担う。

producer固有の対応fieldと確認した契約versionは実装と同時に `docs/spec/producer-adapters.md` に固定する。contract試験には実producerの出力構造に従うraw fixtureを使い、canonical graphの手書きを正常系の代用にしない。

## テスト配置とGate

`place-tests <target-dir>` はgate-input内のgraphからplanを生成し、`test-placement-plan.json` とgate-inputを更新する。pure APIは `placeTests`。

- riskごと、およびriskと結び付いていないchanged_codeごとにobligationを作る。requirementIds/riskIds/failureModeIds/changedCodeIdsは実在nodeへ解決する。
- unit / integration / system / e2e / manual-scripted / manual-exploratory / spec-clarificationの7候補を評価する。oracle fit、change proximity、interaction fit、business fidelity、observability、stability、reuse gainとsetup/runtime/flake penaltyを出し、同点は固定layer順で解決する。
- producerのsuggestedLevelは候補情報。oracle欠落はspec-clarificationまたはmanual-exploratoryへ配置し、未反証リスクを消さない。
- 選択した自動testがすべて既存ならreuse、既存testと追加候補の組合せならadapt、すべて新規候補ならadd、manualならmanual-only、oracle等が不足して必要条件を満たせないときblockedとする。adaptは既存suiteへの追加が必要という計画であり、testコードの変更を実行しない。
- DQ-05は各changed_codeからobligation.changedCodeIdsを経てplacement.obligationIdへjoinする。別変更の配置、存在しないobligation、blocked配置は代用にならない。
- graph node/edgeおよびplanのID重複・未解決参照はDQ-03。testIdだけで判定する既存resilience joinは変更せず、存在するevidenced_byの矛盾検出を維持する。
- waiverはvalidateWaiverの結果とlinkedRiskIdsを使い、対象changed_codeにつながるriskを持つことを要求する。valid入力フラグや別対象のwaiverで不足を解消しない。
- requireExecutedTests=trueでは、選択されたreal testに対応する成功execution_evidenceが必要。未実行はDQ、実行失敗はno_go要因とし、mockを成功数に含めない。計画作成だけで実行済みと主張しない。
- 変更に紐づくobligationはadvisory/informationalでも実行必須設定を満たす。resilience testの実行資格は専用evaluatorへ委譲するが、policy欠落・対象severity外などで実際に評価されなかったtestはDQ-05。最新証跡・signal・安全性の既存DQ/blockerは維持する。

## 出力・検証

- recordはqeg.bundle.json、test-placement-plan.json、gate-verdict.json、quality-evidence-record.json、quality-evidence-record.mdを生成する。output-record.jsonはquality-evidence-record.jsonと同じ内容の互換alias。
- 全JSONを対応schemaで検証してから成功を表示する。JSON.parseのみの検証を廃止する。
- record.exportsはbundle、plan、verdict、MarkdownのSHA-256を持つ。record自身のhashを自身へ埋め込む循環は作らない。生成物のhash一覧は別manifestへ保存する。
- 全生成物を一時領域で検証後に公開し、検証失敗で成功結果を上書きしない。I/O失敗はtargetと操作を診断しexit 1。Gate failureはschema-validな診断成果物を残してexit 2。
- DQに根拠nodeのsourceRefsがない場合は、不足しているinputのJSON位置をsourceRefとして記録する。原因となる空sourceRefsを捏造された証拠で置き換えるのではなく、不足の位置を示す。
- schema-checkは入力だけでなく存在する既知出力も検証する。negative入力でも診断recordはschema-validであることをfixture回帰で確認する。

## 保守性・互換性

- 任意ファイルのENOENTはabsenceとして扱い、EACCES・不正JSON・その他I/O failureは対象pathと操作を報告する。
- evidence verifierのstat/read/realpath失敗はIO_ERRORとして原因を保持し、必須artifactはDQ-06、optional artifactはwarningへ渡す。権限エラーをFILE_MISSINGへ置換しない。
- inputContractに明示した必須artifactはlean/standardを含む全profileでfailとし、診断のstrict=falseでもwarningへ弱めない。通常optionalのadapterを明示的な必須集合へ追加した場合も同じ扱いとする。
- evidence-normalize、report formatter、policy lint、reliability helpers、migration scriptは責務に応じて分割する。CLI/API facadeと出力契約を維持する。
- 静的解析はraw/effective/severity/抑制を分ける。accepted-designの抑制は対象・理由・owner・短期expiry・再確認条件を持つ。migration専用とruntimeのリスクを分離する。
- 旧fixtureは明示したnative policyへ移行する。期待値の更新は受入条件の変更理由と一緒に記録し、任意の新結果を自動承認する更新コマンドを作らない。
- initのworkflowは `.qeg/runtime/qeg-report-action` を参照し、インストールされた配布物からCLI・schema・licenseをコピーする。旧版Actionや未公開tagを暗黙に参照しない。runtimeを更新する際は生成差分を確認して既存の `--force` を使う。
- 既存DQ番号、disqualified優先、waiverでDQを消さない、optional-only warning、mock非算入、approval/retention/職務分掌の境界を維持する。

## 受入

要求第22節の修正IDごとに、公開型・schema・runtime・CLI・packed consumer・on-disk fixtureの証拠を対応付ける。3 producerのraw artifactからbuild-graph → place-tests → gate → recordを実行し、正常系だけでなく欠落・未解決参照・未知version・不正output・未実行・mock・失敗証跡を検証する。実clusterや外部approvalの完了は主張しない。
