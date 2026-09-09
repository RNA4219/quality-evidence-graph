---
intent_id: INT-QEG-REMEDIATION-AUDIT-20260910
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# 改修20項目の受入照合

要求正本第22節を、実装・試験対象・評価範囲ごとに照合する。ローカル実行結果は [追加検証証跡](../evidence/remediation-2026-09-10/audit-validation.json)、GitHub CI結果は [CI検証証跡](../evidence/remediation-2026-09-10/ci-validation.json)、全体の状態は [改修台帳](remediation-2026-09-10.md) を正本とする。実装commit `216cd2f9b18c6b8922ea027ba4aa7aac2e323e16` の3 CI job成功を確認し、以下の範囲で実装受入を完了した。

| 要求 | 実装による充足 | 直接の検証証拠 |
|---|---|---|
| FIX-01 | inputContract型/schemaとinput-contract DQがmode・非空集合・重複・14種を検査 | remediation-gateの明示native、未指定、必須14種の個別欠落試験。schemaのuniqueItemsとruntime集合照合 |
| FIX-02 | initの空graphと不足statusをDQ-01にする | remediation-gateの空init・空graph・status欠落。runtimeの生成schema確認 |
| FIX-03 | policyのevaluationScopeをGate、record、reportへ伝播 | producer-pipelineとremediation-gateのfixture scope検査、record回帰、report/format/textのscope出力 |
| FIX-04 | descriptorの必須集合とoptional artifactのseverityを分離 | runtimeの必須欠落DQ-06／optional warning。追加I/O試験で全profile・strict=falseでも明示必須はfail、通常optionalはwarn、必須集合に追加したoptional adapterはfailを確認 |
| FIX-05 | changedCodeIds→obligationIdで配置を評価 | remediation-gateの2変更に対する1配置、別obligation、blocked/未実行の境界 |
| FIX-06 | graph/planの重複・型付き参照・graphとplanの矛盾をDQ-03にする | remediation-gateの重複node、未解決obligation、graph側placement。producerの未解決ID隔離 |
| FIX-07 | waiverを検証し、選択したreal testの実行を要求 | 期限切れ・無根拠・別risk waiver、mock・未実行・fail。追加でadvisory変更配置、resilience policy欠落／対象外を検査 |
| FIX-08 | recordが全JSONをschema検証してから公開する | 52 fixture recordについてbundle/plan/verdict/record/alias/manifestを個別schema検証 |
| FIX-09 | 不足診断へ入力位置を付ける | 全fixtureのDQ/blocker sourceRefs、参照不整合の配列index、negative record schema検証 |
| FIX-10 | schema-checkが既知出力とhashを再検証。検証完了前に成果物を置換しない | 出力sourceRefs改ざんを失格化。追加試験で不正verdictの書出しを拒否し、既存7成果物のbytes不変を確認 |
| FIX-11 | 固定producer schema/versionでrawを読み、失敗artifactをpartialへ残す | 14 raw artifact、必須kind欠落、未知version、禁止field、不正payload、provenance hash/revisionの試験 |
| FIX-12 | pure buildGraphとCLIを公開。source/assumption/IDを保持 | 公開型とpacked consumer。raw入力順を逆にしたgraphのdeepEqual、入力不変、明示producer間要件参照 |
| FIX-13 | pure placeTestsとCLIがrisk/変更obligation、7層のfit/cost/score/rationaleを生成 | producer-pipelineの7候補と選択、reuse/adapt/add/manual-only/blockedの境界 |
| FIX-14 | 4 JSON、Markdown、record alias、別hash manifestを生成 | producer-pipelineとremediation-gateの全hash再計算・alias一致、fixture record全schema検証 |
| FIX-15 | 配布物だけでraw→graph→plan→gate→recordが動く | package-smokeの隔離install、packed APIでraw fixture生成、packed CLIで全工程と出力検証 |
| FIX-16 | 各FIXと実装・試験・scopeを本表と台帳で対応付ける | 本表、source指紋付き実行ログ、実装commitと3 jobのCI結果。過去の一括完了表記を現在の証拠に使わない |
| FIX-17 | freshness DQ-18、ambiguity DQ-19、版とraw/effectiveの記載を同期 | schema/enum check、既存resilience回帰、v0.3.1原本raw 13・抑制1・effective 12と台帳の照合 |
| FIX-18 | ENOENTだけをabsenceとし、stat/read/realpathの原因とpathを残す | main入力の壊れたJSON診断、optionalText/Stat、追加I/O試験。EACCESをFILE_MISSINGに置換しない |
| FIX-19 | normalizer、formatter、policy、reliability、migrationを分割 | 公開型、runtime/Action、53 fixture、packed consumer。facadeと既存期待verdict/DQ/blockerを維持 |
| FIX-20 | 過去medium 12件の個別対応とaccepted-designのowner/期限を記録 | 台帳の12件表、狭い抑制path・2026-10-10 expiry、code-to-gate再走査。件数差だけを修正証拠にしない |

## 照合で追加修正した点

`requireExecutedTests=true`でresilience testが選択されても、reliabilityPolicyがなければ専用evaluatorが実行されず、実行証跡ゼロをgoにできた。評価schemaとartifact検証がともに成功する入力で確認し、専用evaluatorのdrillDownに対象testが存在することを委譲条件にした。対象severity外も同様にDQ-05とする。専用evaluatorが評価した結果のDQ・失敗・安全性blockerはそのまま用いる。

同じ実行必須設定は、変更に結び付くadvisory/informational obligationでも満たす。evidence verifierがstat例外を一律FILE_MISSINGへ置換する処理を改め、IO_ERRORとして操作・path・原因を保持する。出力検証失敗時の成果物保護は、既存出力を実際に作成してから不正出力を拒否する試験で確認する。

## 完了判断の範囲

ローカルおよびCIのfixture、隔離tarball consumer、隔離Actionのschema障害・復旧が対象。producer実運用、実cluster、実fault injection、Lakda real acceptance、外部release approvalは含めない。Linux Node 20/24およびWindows Node 24のGitHub CIは実装commitで成功した。証跡を記録する後続commitについても、PRのlatest checksで同じ3 jobの成功を確認してからマージする。
