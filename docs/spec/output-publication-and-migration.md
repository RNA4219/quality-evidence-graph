---
intent_id: INT-QEG-EAC-COMPLETION-001
owner: quality-evidence-graph
status: implemented
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# 出力公開・復旧・consumer移行

EAC-08〜10を一つの改修単位として扱う。受入証拠は[台帳](../project/evidence-acceptance-status.md)へ集約する。

## 完全な世代の読取り

`record`は従来の7ファイルを維持し、`.qeg-generations/<UUID>/`へ不変の一式と`generation.json`を保存する。各fileをsyncし、互換用の直下fileを一時fileのrenameで更新した後、`.qeg-current.json`をatomic renameで確定する。世代manifestはfile hash、pointerはmanifest hashを保持し、previous pointerで完了した履歴を結ぶ。中断したstageは診断用に保持し、自動で成功世代に昇格しない。

alias更新前に、今回上書きする全fileの更新前bytes（未存在も含む）をstage内の`.qeg-rollback/`とhash付き`.qeg-transaction.json`へ保存し、`.qeg-pending.json`を確定する。前世代と今回のfile集合が異なっても、`record → migrate`の中断で新しい`gate-input.json`だけが残ることを防ぐ。pointer確定前のpendingがあれば、Gate・配置・record・migration dry-run・schema-check・正式出力読取りは判定や更新を進めない。pointer確定後のpendingは完了済みとして扱い、次の公開または復旧で片付ける。

正式な利用者は`readPublishedOutputs(directory)`または`qeg outputs read <directory>`を使う。同じ世代のhashと直下aliasの一致を確認したスナップショットを返す。`schema-check`も世代を検証する。公開中、pointer欠損、alias改変、manifest破損は明示エラーであり、直下のJSONを個別に読むだけでは完了確認にならない。旧形式のfixtureは従来のoutput-manifest検証を維持するが、世代保存が始まった出力でpointerが消えた場合は旧形式にfallbackしない。

書込み・正式読取り・復旧は同一canonical pathのOS排他を使う。Windowsは名前付きpipe、Linuxはabstract socketを使い、プロセス終了時にOSが解放する。残存PIDファイルの削除競合や期限によるlock奪取はない。同時実行は`Output busy or lease unavailable`で拒否する。他OSではexclusive loopback portを利用し、衝突や利用不能はエラーになる。プロセス中断と同時実行をWindows/Linuxで受入対象とし、電源断・filesystem故障・network filesystemの耐久性は今回の保証範囲に含めない。

`build-graph`・`place-tests`・`record`・`migrate`は入力読取りから公開完了まで排他を保持する。Gate評価とschema-checkも対象の読取り全体を排他内で実行する。内部の逐次呼出しは同じleaseを再利用し、入力読取りと公開の間に別の移行を挟まない。pendingのないnative入力は従来どおり明示編集できる。OS排他を使わない外部editorによる同時書込みは管理対象外。

```sh
qeg outputs read ./consumer
qeg outputs recover ./consumer
qeg record ./consumer
```

`recover`は未完了journalの全hashとpointer対応を検証し、今回の全fileを更新前へ戻してから、pointerが指す検証済み世代の出力aliasを修復する。通常のalias修復は`gate-input.json`を上書きしない。native入力はcommand間で明示編集できるため、journalで戻した入力や利用者の編集を古い世代へ巻き戻さない。

前世代が`migrate`・`build-graph`・`place-tests`等でgate-inputを含み、現在の入力と一致しない場合、入力を保護したまま`recover`と正式読取りはexit 1を返す。メッセージは入力の確認とproducer再実行を要求する。繰り返しrecoverしても古い入力へ戻らない。入力を修正してproducerを再実行するか、`record`で再評価し、一致する新しい世代を作る。新しい合格や承認を復旧処理が生成することはない。

復旧自身が中断してもjournalを残し、再実行できる。初回公開に完了pointerがない場合も元入力を復元するが、完了世代がない旨をexit 1で返す。journal・pointer・世代本体が破損していれば自動上書きを止める。`build-graph`/`place-tests`/`migrate`や診断用`repro-bundle`の世代は完了recordと区別する。履歴と中断stageの自動GCは行わない。

## wire 0.2 consumerの明示移行

```sh
qeg migrate ./consumer --dry-run
qeg migrate ./consumer --config ./migration-config.json --dry-run
qeg migrate ./consumer --config ./migration-config.json --apply
```

設定は`schemas/consumer-migration.schema.json`に従い、`migrationVersion: qeg-consumer-migration/v1`、dry-runが返した`expectedInputHash`、完全な`policy`を渡す。`inputContract`は必須。実行を要求する場合は対象project/build/revision/environment、有効期間、buildBindingRef、sourceRefsを持つ`executionPolicy`も必須。既存policyを複製して必要な契約と新しいpolicyHashを明示する。buildや期限を推測せず、`requireExecutedTests=false`へ自動変更しない。

dry-runはfile/backup/receipt/directoryを作らず、不足、JSON pointer単位の差分、適用後のGate previewを返す。`expectedInputHash`が異なる変更入力には適用しない。profile、DQ範囲、exit規則、reliability/引退policyの変更はこの移行では拒否する。metadata、graph metadata、placement metadataのpolicy識別を同期し、graph node/edge、実行履歴、waiver、evidencePackage、approval/retentionの原本を保持する。

previewは実CLIと同じschema・ID prefix・ingest契約の前処理を通す。例えば未定義prefixの`team:review-policy`はschemaに適合しても移行をblockedとし、Gate previewや適用成功を返さない。CLIでDQになるparser failureもpreviewへ伝播する。

新しいpolicyに対して既存approvalの条件が成立しなくなれば、Gate previewも不合格を示す。承認を移行ツールが発行したり、過去のevidencePackage内policyを新policyへ書換えたりはしない。`ipo_controlled`でも同じ原則を適用する。

適用は`migration-original.json`、`migration-report.json`、新`gate-input.json`を世代として公開する。同設定の再適用は無変更で、後続recordがあっても完了履歴で確認する。中断した移行はjournalの元入力と明示configを先に検証し、readyの場合のみrollbackして再適用する。不一致configで復旧を進めない。他commandの中断は先に`outputs recover`が必要。移行成功とGate成功は別で、`record`の再評価が必要。より古いwire全体の変換や、欠けた実行原本の生成は行わない。

終了codeは、migration ready/unchanged/appliedが0、設定不足/不適合dry-runが2、適用拒否・I/O・競合・復旧エラーが1。Gate verdictの既存0/2規則は維持する。

## 実producer互換

code-to-gateの`risk-register.yaml`を原本のbytesでhash検証してからYAMLとして読む。YAML対応はこのkindのみで、duplicate keyとaliasを拒否する。正規化後も上流schemaを適用する。

`repo.revision`が短縮Git SHAの場合はdescriptorの`reportedRevision`で明示解決する。12桁以上のhexで、rawの値と一致し、評価する完全revisionのprefixであることが必要。収集側では実Gitで一意に解決し、receiptに完全revisionを保存する。`repo.dirty=true`や不一致はDQ-12。原本にrevisionがないartifactも、descriptorと共通build bindingを必須とする。

manual-bbの`MD-spec`等のsource IDは、feature_spec descriptorの`sourceRefMappings: [{sourceId, requirementId}]`で実在する要求へ結ぶ。rawに存在しないsource、存在しない要求、重複source、不適切なartifactへの指定はDQ-01。producerのJSON自体は編集しない。

`buildGraph(manifest, loaded)`はid/pathが一致するmanifest descriptorを全正規化・要求edge生成で使用する。payload読込み後にmanifestを複製・変更し、`loaded[].ref`が古い別objectを指していても、最新の明示mappingがAPIとCLIに同じ形で適用される。

実行時刻は小数秒1〜9桁を保持し、UTC基準の整数nanosecondで最新順・同時刻・未来・期限を比較する。Pythonのmicrosecondをmillisecondへ丸めて、異なる実行を同時刻にしたり未来を許容したりしない。

`tools/interop/live-producers.mjs`は固定source lockを実行前後に照合し、RanD API、code-to-gate CLI、manual-bb ingest/gate CLIを共通の隔離CLI対象へ実行する。manualのrisk/caseは明示した設計入力、executionは実subprocessの観測から生成する。固定再生データと実再実行を別に記録し、source/version/revision/build/run/raw hashを保存する。

今回の実データは上流のpartialと未被覆の要求仮説を含み、期待する最終判定は`disqualified`。これは接続・拒否伝播の受入であり、当該対象のrelease承認ではない。CTGが0件のriskをpartialとする既存仕様やmanual側の不足を、QEGで成功へ変換しない。合成正常系は別のproducer-pipeline/packed testで検証する。
