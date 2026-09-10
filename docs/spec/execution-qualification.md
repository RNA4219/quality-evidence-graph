---
intent_id: INT-QEG-EXECUTION-QUALIFICATION-001
owner: quality-evidence-graph
status: implemented
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# 通常テストの実行資格・最新結果の実装契約

要求はEAC-01〜07/11/12、意味的な基準は [共通受入基準](evidence-acceptance-standard.md)。本実装は証跡判定の受入単位を扱う。出力復旧、実producer再実行、consumer移行の追加受入は別単位のまま保持する。

## 型と入力

- `GatePolicy.executionPolicy`：`target={projectId, buildId, revision, environmentId}`、正で有限な`maxEvidenceAgeHours`、hash/revision必須の`buildBindingRef`、非空sourceRefs。
- build対応原本は`{bindingVersion:"qeg-build/v1", target}`のJSON。policyのtargetと完全一致を実体検証する。revisionは40桁または64桁のGit object IDで、metadata.headRef/graph.metadata.headRefとも一致する。
- 通常testの`executionIdentity={producer,projectId,featureId,caseId}`を明示する。
- 通常execution nodeの`execution`にversion=`qeg-execution/v1`、testId、上記identity、producerVersion、runId、target、completedAt、status、executionMode、rawArtifactRefを保持する。`passed`がある場合はstatusのpass/failと矛盾しないこと。
- `execution.historySourceRefs`がある記録は明示履歴。空配列を認めず、採用しない。対象不一致の現在入力を自動で履歴へ変更しない。
- manual rawへ独自fieldを追加しない。`IngestArtifact.executionContext={projectId,environmentId,producerVersion}`を明示し、rawのbuild_id/feature_id/case/run/timestamp/resultを正規化する。rawにenvがある場合はdescriptorと一致させる。case/risk IDにはproject/featureの文脈を含める。
- 通常testの実行を必須とする、正規化済みexecutionを与える、または通常testの成功指標をGate根拠に使う場合に資格判定する。policyや適格証跡がない成功指標で引退条件を充足させない。

`evidenceStrength`自体の算出式は本変更で新設しない。引退には既存のsource-backed strength閾値に加え、適格な最新passと実測連続成功数を要求する。集計値`recentGreenRuns`が大きくても、実測数が不足すればDQ-14となる。

## 判定と診断

DQ-01はpolicy/構造/必須identity不足、DQ-03はtest/feature/case/producer参照矛盾・実行identity競合、DQ-05は未来/不正時刻/期限切れ/曖昧な最新実行/未実行・非成功、DQ-06は未検証または不正な実体、DQ-12はbuild/revision/environment/project不一致。既存resilienceのDQ-18〜21の意味は維持する。messageにEAC IDと理由を付け、sourceRefsを保持する。

対象・参照・現在時刻を検証してから最新完了時刻で選択する。同一identityで異なるraw/hash/結果はDQ。完全重複は1件にまとめ、別run同時刻は両方passでもDQ。最新failはblocker、skip/blocked/cancelled/unknown/runningはDQ。未来許容0、有効期間の上限は含む。古いfailは履歴に残すが最新成功を単独で妨げない。上流no_goや独立blockerは維持する。

waiverは不足するobligationの扱いを変更できても、供給された現在証跡の資格違反を消さない。profile/strict=falseで資格を弱めない。

## 実体検証と公開API

pure `evaluateGate`はI/Oを行わない。通常の実行受入では`verifyEvidenceArtifacts`が返したreportを渡す。reportは対象・policy・評価時計・通常test/実行/参照の指紋を持ち、別入力へ再利用できない。CLIは共通preflightから実体検証を実行する。rawと正規化後の対象/run/結果/日時を照合し、JSON/hashだけの成功では受入しない。

native producerは`{executionVersion:"qeg-execution/v1", ...executionの意味field}`のrawを使う。rawArtifactRefとhistorySourceRefsはraw外のQEG descriptorであり、rawには含めない。通常の参照先もcontained pathとhashを検証する。明示履歴の別revisionは保持するが現在coverageには算入しない。

## 出力・互換性

`GateResult.executionAccounting`は評価した場合だけ出力し、target/T、testごとの採用evidence/run/status、除外ID/理由、実測した連続成功数を記録する。report JSON、text/GitHub summary、recordにも伝播する。既存の計画fixtureには不要な出力fieldを追加しない。

既存の型上のoptional fieldは維持するが、実行必須の旧入力は明示したpolicy/identity/証跡へ移行する。packageは未公開0.4.0、wireは0.2を維持する。更新したfixtureは合成証跡であることを明示し、期待verdict/DQ/blockerを新出力から自動採用しない。

```ts
const evidenceVerification = await verifyEvidenceArtifacts(input, { baseDir });
const gate = evaluateGate({ ...input, waivers: input.waivers ?? [], evidenceVerification });
```

検証後に対象やnodeを変更した場合は再検証が必要。reportは呼出元の信頼境界内で扱う。指紋は取り違えの検出であり、第三者の署名やreport発行者の認証ではない。`strict:false`でも実行受入の必須証跡検証を警告へ弱めない。

`ipo_controlled`のwaiver、approval、retention契約は変更しない。waiverは入力資格DQを免除せず、成功率やprofileでも相殺しない。小数秒1〜9桁を保持する時刻比較、出力の中断復旧・排他、実producer収集、consumer移行は[統合実装契約](output-publication-and-migration.md)を参照する。
