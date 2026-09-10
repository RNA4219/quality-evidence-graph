---
intent_id: INT-QEG-PRODUCER-ADAPTERS-20260910
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# Producer adapter契約

実producerのYAML、短縮revisionの明示解決、source ID対応、microsecondを保持する時刻処理は[追加契約](output-publication-and-migration.md#実producer互換)を参照。保存した実出力の再生とproducer再実行は[受入台帳](../project/evidence-acceptance-status.md)で区別する。

rawの意味・schemaはproducerが所有する。QEGは2026-09-10に確認した以下の契約を読取対応する。manifestのcontractVersionは、versionフィールドを持たないupstreamにも対応契約を明示するためのdescriptorであり、rawを書き換えるものではない。

| producer | manifest contractVersion | raw識別 | 確認元 |
|---|---|---|---|
| RanD | `rand-kano/1.0` | schema_version=`1.0` | research-runtime/src/rand_research/kano.py、models.py、tests/test_kano.py |
| code-to-gate | `ctg-artifacts/v1` | artifact=`<hyphen-name>`、schema=`<hyphen-name>@v1` | schemas/{normalized-repo-graph,diff-analysis,findings,risk-register,test-seeds,release-readiness,audit}.schema.json |
| manual-bb-test-harness | `manual-bb/v1` | 各schemaのfeature_id等。rawにversionを追加しない | schemas/{feature_spec,risk_register,manual_case_set,gate_decision,execution_evidence}.schema.json、examples/artifacts |

未知versionはparser failure。CTG/manual-bbは固定した上流schemaで正規化前に検証し、許可されないfieldはproducer契約違反として扱う。schemaが許容する未写像fieldは原文artifactとcontentHashに保持する。RanDは1.0 packetの識別子と写像対象の必須fieldを検証する。実行されたという情報を持たないtest seedを実行証跡へ昇格しない。

固定schemaのrevisionと各file hashは `producer-schema-provenance.json`、内容は `src/adapters/producer-schemas.json` に保存する。上流の作業中の変更とは混在させず、commitから取得する。licenseとNOTICEは `docs/third-party/` とActionの `licenses/` に保持する。

| raw artifact | 主な写像 |
|---|---|
| RanD requirements_packet | requirements[].requirement_id/title/statement/priority/confidence、acceptance_criteria、risks、evidence_refs、packet assumptionsをrequirement/acceptance/riskへ |
| RanD requirements_audit_packet | 同じrequirement_idへaudit traceを追加。original_textは補助内容、gate_verdict/testability/issuesをreadinessとoracle不足へ。packetの内容を失わずaudit側のreadinessを優先 |
| CTG normalized-repo-graph | files/symbols/relations/entrypointsは変更周辺のsource。testsは既存test候補。診断error/partialをcompletenessへ |
| CTG diff-analysis | changed_files[].path/hunksをchanged_codeへ。blastRadiusはblast_radius.affectedFilesの件数。repo.base_ref/head_refはmanifest metadataと照合し、不一致はDQ-12 |
| CTG findings | findings[].id/title/severity/confidence/evidence、source pathからfinding→changed_codeを連結。unsupported_claimsを隔離 |
| CTG risk-register | risks[].id/title/severity/likelihood/evidence/sourceFindingIdsをriskとfinding/変更とのedgeへ |
| CTG test-seeds | seeds[].id/title/sourceRiskIds/sourceFindingIds/suggestedLevel/evidenceを未実行のtest候補へ。oracle_gapsはspec-clarification候補 |
| CTG release-readiness | passed / passed_with_risk / needs_review / blocked_input / failedをQEG入力用gate_verdictに写像。blocked_inputはDQ。上流passだけでQEG goにしない |
| CTG audit | inputs/policy/exitをprovenanceとして保持。外部policyはQEG policy正本へ採用しない |
| manual-bb feature_spec | feature_id/title/acceptance_criteria/business_rules/changed_areas/source_refs/assumptionsをrequirement/acceptanceと変更関連へ |
| manual-bb risk_register | risks[].id/scenario/impact/likelihood/priority/trace_toをriskとcaseへの関係へ。1〜5の尺度は0〜1へ写像 |
| manual-bb manual_case_set | manual_cases[].tc_id/title/priority/expected_results/oracle/trace_to、exploratory_chartersをmanual test候補へ |
| manual-bb gate_decision | status/reasons/blocking_risks/unmet_conditionsをQEG入力用gate_verdictへ。外部waiverは自動承認しない |
| manual-bb execution_evidence | run_id、tc_idまたはcharter_id、build_id/timestamp/expected/actual/result/attachmentsをexecution_evidenceへ。1ファイル1実行、複数artifactを許容 |

semantic IDは既知producer prefixを維持し、prefixのない元IDはproducer:kind:encoded-local-idへ正規化する。manual-bbのローカルIDは`[projectId,featureId,localId]`をJSON化してencodeし、別機能の同じTC/risk IDを分離する。path由来IDはslash表記を統一する。同一requirement IDはpacket/auditのtraceをunionする。異なるproducer間の一致は明示ID/参照のみでjoinし、類似文章だけを同一要件としない。

manual-bb descriptorには`executionContext={projectId,environmentId,producerVersion}`を必須指定する。producer raw schemaは変更しない。通常実行に用いる`policy.executionPolicy`、build対応原本、実体検証、時刻・最新実行の規則は[execution-qualification.md](execution-qualification.md)を参照。`contractVersion`と`executionContext`はingest専用で、metadataのArtifactRefへ未定義fieldとしてコピーしない。必要な実行文脈はtest/executionへ保持する。

metadata.inputArtifactsには全descriptorと実hashを保持する。sourceRefsにはrawのファイル位置と元の参照情報を残す。rawがconfidenceを持たない場合の既定値と、推定した関連にはassumptionsを付ける。upstreamのstatus=no_go/failedはblocker、conditional_go/needs_reviewは人間の確認、disqualified/blocked_inputはDQとして伝播する。

任意のJUnit/Coverage/SARIF/git diffは別optional evidence契約に従う。今回の生成APIはまず必須3producerを扱い、HATEは既存optional evidence境界を維持する。resilience normalizationの4 adapter契約は変更しない。
