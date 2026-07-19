---
intent_id: INT-QEG-REQ-001
owner: quality-evidence-graph
status: draft
last_reviewed_at: 2026-07-04
next_review_due: 2026-08-04
---

# 要件定義

## 1. 目的

`Quality Evidence Graph` は、`RanD`、`code-to-gate`、`manual-bb-test-harness` の 3 つを必須接続先として、要件、実装差分、リスク、テスト配置、実行証跡、Gate 判定を単一の再現可能な artifact に統合する。

本 repo の価値は、artifact を横並びに集めることではない。3 接続先が持つ別々の判断材料を canonical graph に写像し、どのリスクをどのテスト層で反証するべきか、判定に足る証跡があるか、根拠のない claim が混入していないかを機械的に判定できる状態にすることである。

初期実装は「万能 QA 実行基盤」ではなく、既存 artifact を壊さずに `join and decide` を行う local-first な中核として成立させる。

この文書では「要求」は実現したい能力、「受入条件」は実装完了を判定する観測可能な条件として扱う。MVP では、接続先の全機能を再現するのではなく、3 接続先から最小 fixture を取り込み、graph / placement / gate / record の一連の判定が再現できることを優先する。

IPO レベルの利用では、本 repo は単なる開発支援ツールではなく、変更管理、品質判定、証跡保全、例外承認を説明する統制補助システムとして扱う。そのため、要件正本、schema、fixture、Gate policy、waiver、release record は版管理、承認、追跡、再検証できなければならない。

## 2. 成功条件

| ID | 成功条件 | 受入条件 |
|---|---|---|
| S-01 | 3 接続先の artifact を同一 run に取り込める | RanD / code-to-gate / manual-bb の必須 artifact が `inputArtifacts` として記録される |
| S-02 | risk-to-test-layer を説明できる | 各 test obligation が risk / requirement / changed_code / sourceRefs に逆引きできる |
| S-03 | Gate 判定が再現できる | 同一 input / policy / revision で同一 stable ID、同一 placement、同一 verdict になる |
| S-04 | 判定不能を判定失敗と混同しない | artifact 不備や根拠欠落は `disqualified`、品質上の blocker は `no_go` として出力される |
| S-05 | 自分の出力を検証できる | 出力 JSON は schema validation を通り、validation 失敗時は成功 artifact として扱わない |
| S-06 | 説明不能な自動判断を避ける | placement / verdict / disqualification は source-backed な node、edge、artifact へ辿れる |
| S-07 | 手動 QA の検収観点を失わない | flow / state / rule / data / role / regression の観点を manual case または exploratory charter へ辿れる |
| S-08 | 統制監査へ説明できる | 要件、policy、fixture、waiver、Gate 結果、証跡 bundle の変更履歴を Git または同等の管理下で追跡できる |
| S-09 | 例外承認を統制できる | waiver / conditional_go / human review は承認者、期限、根拠、影響範囲、再確認条件を持つ |
| S-10 | 証跡の信頼性を評価できる | evidence は作成元、取得時刻、hash、revision、保管先、改ざん検知方法を保持できる |

## 3. 設計原則

| ID | 原則 | 内容 |
|---|---|---|
| P-01 | 必須 3 接続 | QEG の必須 ingest adapter は `RanD`、`code-to-gate`、`manual-bb-test-harness` に限定する |
| P-02 | workflow support only | `workflow-cookbook` は Birdseye / Capsule / Task Seed の型と運用パターンだけを補助利用する |
| P-03 | no memx | `memx` / memory store / journal 連携は対象外にする |
| P-04 | schema-first | 入出力 artifact は JSON Schema と TypeScript 型の両方で表現する |
| P-05 | traceability-first | Gate reason、placement rationale、disqualification は `sourceRefs` を持つ |
| P-06 | no unsupported certainty | 根拠のない claim を Gate 判定に使わない |
| P-07 | adapter boundary | 接続先 artifact を破壊、改名、再定義せず adapter で正規化する |
| P-08 | deterministic core | graph build、placement、gate は pure function としてテストできる |
| P-09 | CLI first | MVP の統合境界は CLI と JSON artifact に寄せる |
| P-10 | fail closed | 判定資格が壊れた場合は成功側に倒さない |
| P-11 | controlled source of truth | 要件正本と Gate policy は Git 管理または同等の監査可能な版管理に置く |
| P-12 | separation of duties | 生成者、レビュー者、承認者、例外承認者を同一人物前提にしない |
| P-13 | evidence immutability | release 判定に使った証跡は後から silent overwrite できない |
| P-14 | QEG policy authority | Gate policy の正本は QEG のみとし、外部 artifact の policy 相当情報は proposal として扱う |
| P-15 | namespaced identity | cross-repo join に使う ID は `<producer>:<local-id>` を標準とする |
| P-16 | mock evidence exclusion | `testExecutionMode=mock` の test node は graph に監査記録として残すが、Gate 証跡の件数・強度・連続 green 回数・risk coverage には算入しない |
| P-17 | resilience execution boundary | QEG は障害注入を実行せず、外部 producer が作成した resilience evidence を検証・会計・判定する |
| P-18 | resilience evidence qualification | resilience Gate に使う evidence は real execution、current revision、freshness、signal、safety の条件を fail closed で満たす |

## 4. スコープ

### 4.1 対象

- RanD / code-to-gate / manual-bb-test-harness artifact の ingest 契約
- canonical graph の node / edge / traceability / completeness 契約
- risk ごとの test obligation と test placement plan
- `go / conditional_go / no_go / disqualified` の Gate 判定
- `qeg.bundle.json`、`test-placement-plan.json`、`gate-verdict.json`、`quality-evidence-record.json` の schema-first 出力
- schema validation、adapter contract test、minimal fixture
- invalid / incomplete fixture による negative contract test
- JUnit / Coverage / SARIF / git diff など optional evidence の ingest 境界
- 要件正本、Gate policy、waiver、release record の governance contract
- 内部統制、変更管理、リリース承認に対する control mapping

### 4.2 対象外

- `memx` / memory store / journal / archive 連携
- `workflow-cookbook` の governance / acceptance gate を QEG の必須入力にすること
- Playwright、Jest、pytest などテスト実行フレームワーク本体の実装
- 外部 SaaS の本番設定
- 組織固有の承認フロー正本化
- LLM provider の必須化
- upstream artifact の schema 変更や正本化
- upstream tool の実行や orchestration
- 手動テストケース自体の工数最適化や担当割当の正本化
- 法務、監査法人、主幹事証券、取引所による正式審査の代替

## 5. 必須接続先

| ID | 接続先 | 役割 | 必須 artifact | 主な写像先 |
|---|---|---|---|---|
| CONN-01 | `RanD` | 要件発見、要件監査、要件 readiness | `requirements_packet`, `requirements_audit_packet` | requirement, acceptance_criteria, risk, gate input |
| CONN-02 | `code-to-gate` | 実装差分、repo graph、finding、test seed、release readiness | `normalized-repo-graph`, `diff-analysis`, `findings`, `risk-register`, `test-seeds`, `release-readiness`, `audit` | changed_code, finding, risk, test, execution_evidence |
| CONN-03 | `manual-bb-test-harness` | 仕様起点の手動 QA、oracle gap、manual case、release brief | `feature_spec`, `risk_register`, `manual_case_set`, `gate_decision`, `execution_evidence` | acceptance_criteria, risk, test, execution_evidence, gate input |

受入条件:

- 必須 artifact が 1 つでも欠ける run は DQ-01 として `disqualified` にする。
- adapter は upstream artifact のフィールドを canonical 型へ写像するだけにし、upstream の意味を上書きしない。
- artifact ごとに `path`、`schemaId`、`contentHash`、`revision` を保持できる。
- adapter が未知フィールドを見つけても、それだけで失格にしない。必須フィールド欠落、型不一致、判定に必要な根拠欠落だけを失格候補にする。
- 必須 artifact が schema valid でも、Gate 関連の `sourceRefs` が空なら根拠欠落として扱う。
- upstream artifact 名に hyphen がある場合でも、QEG 内部の `ArtifactKind` は snake_case に正規化する。例: `diff-analysis` は `diff_analysis`、`release-readiness` は `release_readiness`、`git-diff` は `git_diff`。

## 6. 補助として使うもの

| ID | 対象 | 扱い | 禁止事項 |
|---|---|---|---|
| SUP-01 | `workflow-cookbook` Birdseye index | docs / schema / source の読み順と影響範囲を整理する参照型として使う | QEG の Gate 判定入力にしない |
| SUP-02 | `workflow-cookbook` Capsule | 必要な周辺文書だけを読むための軽量 context bundle として使う | 必須 artifact にしない |
| SUP-03 | `workflow-cookbook` Task Seed | 実装タスク分割と受入条件整理のテンプレートとして使う | QEG の acceptance record と混同しない |

受入条件:

- workflow refs は `metadata.workflowRefs` にのみ記録し、`inputArtifacts` の必須接続先として扱わない。
- workflow refs が欠落しても QEG run は失格にしない。
- workflow refs 由来の情報だけで Gate verdict を良化させない。
- workflow refs を承認証跡として使う場合は、QEG の Gate input ではなく external control evidence として分離する。

## 7. 入力契約

### 7.1 RanD adapter

| Artifact | 必須度 | 期待フィールド | QEG での扱い |
|---|---|---|---|
| `requirements_packet` | 必須 | requirements, kpi, acceptance, risks, confidence, downstream_hooks, gatePolicyProposal | requirement / acceptance_criteria / risk の初期 source。policy proposal は QEG policy 正本ではない |
| `requirements_audit_packet` | 必須 | requirements, testability, implementation_alignment, issues, suggested_action, gate_verdict, gate_summary, source_refs, assumptions | requirement readiness と oracle gap の source |

受入条件:

- `requirement_id` は stable ID の seed として使える。
- `requirement_id` は ingest 時に `rand:<local-id>` へ正規化する。prefix なしは互換期間中 warning 付きで受理する。
- `confidence`、`source_refs`、`assumptions` が欠ける場合は unsupported claim 候補として扱う。
- `gate_verdict=no_go` の requirement は QEG の Gate で少なくとも blocker 候補になる。
- `requirements_packet` と `requirements_audit_packet` の同一 requirement が矛盾する場合は、audit 側を readiness 判定の優先 source とし、packet 側の情報は requirement 内容の source として保持する。
- `requirements_packet` が `gate_policy` または `gatePolicy` を直接持つ場合は DQ または validation error として拒否する。`gatePolicyProposal` として明示された場合のみ受理し、verdict には直接影響させない。

### 7.2 code-to-gate adapter

| Artifact | 必須度 | 期待フィールド | QEG での扱い |
|---|---|---|---|
| `normalized-repo-graph` | 必須 | file, symbol, dependency, entrypoint | changed_code と blast radius の補助 source |
| `diff-analysis` | 必須 | base_ref, head_ref, changed paths, hunks | changed_code の主 source |
| `findings` | 必須 | finding id, rule id, severity, evidence | finding / risk の source |
| `risk-register` | 必須 | risk id, severity, likelihood, evidence | risk の source |
| `test-seeds` | 必須 | sourceRiskIds, sourceFindingIds, suggestedLevel, evidence | test obligation / placement candidate の source |
| `release-readiness` | 必須 | status, blockers, risks | Gate input |
| `audit` | 必須 | input hashes, policy hash, LLM request/response hash | reproducibility / stale evidence 判定 |

受入条件:

- `base_ref` / `head_ref` と artifact revision / producer check head SHA の不一致は DQ-12 にする。
- producer check の conclusion が producer artifact の readiness status と矛盾する場合は DQ-12 にする。
- changed path が 1 件以上ある場合、test obligation または accepted waiver が必要。
- `test-seeds.suggestedLevel` は候補として扱い、最終 placement は QEG が決める。
- `release-readiness=blocked_input` 相当の状態は QEG Gate で `disqualified` 候補にする。
- `findings` / `risk-register` / `test-seeds` の参照 ID が解決できない場合は parser failure に記録し、Gate 関連なら DQ-03 または DQ-11 の候補にする。

### 7.3 manual-bb-test-harness adapter

| Artifact | 必須度 | 期待フィールド | QEG での扱い |
|---|---|---|---|
| `phase_contract` | 任意 | readiness, open_questions, spec_gaps, technical_risks, source_refs | upstream readiness / spec gap の補助 source |
| `feature_spec` | 必須 | acceptance_criteria, business_rules, changed_areas, source_refs, assumptions | acceptance_criteria / requirement 補助 source |
| `test_model` | 任意 | flow, state, rule, data, role, regression coverage items | coverage surface / obligation 補助 source |
| `observation_set` | 任意 | observations, techniques, rationale, source_refs | risk / failure_mode / manual placement 補助 source |
| `risk_register` | 必須 | risk id, severity, likelihood, mitigation, source_refs | risk の source |
| `manual_case_set` | 必須 | scripted cases, exploratory charters, platform_matrix, role_matrix, oracle refs | manual-scripted / manual-exploratory の source |
| `effort_plan` | 任意 | execution order, estimate, buffer, owner hint | Markdown record の補助情報 |
| `gate_decision` | 必須 | go / conditional_go / no_go, reasons, assumptions, source_refs | Gate input |
| `release_brief` | 任意 | summary, risks, evidence, recommendation | Markdown record の補助情報 |
| `execution_evidence` | 必須 | executed cases, result, evidence refs | execution_evidence の source |

受入条件:

- manual test case に expected result / oracle / traceability がない場合は DQ-08 にする。
- oracle gap は `spec-clarification` または `manual-exploratory` obligation として表現する。
- manual-bb の Gate は最終判定ではなく QEG Gate への入力として扱う。
- `execution_evidence` が未実行または部分実行の場合は、manual case の存在だけで risk を反証済みにしない。
- `phase_contract` / `test_model` / `observation_set` がある場合は、manual case の traceability と spec gap 判定を補強する。欠落しても MVP では DQ-01 にしない。
- `effort_plan` / `release_brief` は QEG Gate を良化させる根拠にしない。

### 7.4 Optional evidence adapter

| Artifact | 必須度 | 期待フィールド | QEG での扱い |
|---|---|---|---|
| `junit` | 任意 | test name, result, duration, failure | execution_evidence の補助 source |
| `coverage` | 任意 | covered files, lines, branches, summary | placement / residual risk の補助 source |
| `sarif` | 任意 | rule id, location, severity, result | finding / risk の補助 source |
| `git-diff` | 任意 | base_ref, head_ref, changed paths, hunks | code-to-gate diff 欠落時の補助 source |

受入条件:

- optional evidence は必須 3 接続先の欠落を埋めるために使わない。
- optional evidence の schema invalid は parser failure に記録し、必須 artifact の失格とは分ける。
- optional evidence だけで Gate verdict を良化させない。必須 3 接続先の source-backed な判断材料を補強する場合だけ使える。

## 8. Canonical Graph 要件

| ID | 要件 | 受入条件 |
|---|---|---|
| G-01 | node は stable ID を持つ | 同一 adapter / artifact kind / source ref / revision / semantic key では同一 ID になる |
| G-02 | edge は意味付き relation を持つ | `derives_from`, `risks`, `requires_test`, `placed_at`, `evidenced_by`, `decides` などで逆引きできる |
| G-03 | traceability は必須 | node / edge / placement / gate reason は `sourceRefs`, `assumptions`, `confidence` を持つ |
| G-04 | graph completeness を持つ | score, partial flag, parser failures, unsupported claims を保持する |
| G-05 | duplicate requirement を join できる | RanD と manual-bb の要件が同一または近接する場合、source を失わず 1 つの requirement cluster にできる |
| G-06 | stale evidence を検出できる | sourceRef revision / artifact revision / metadata headRef の矛盾を失格候補として扱う |
| G-07 | unsupported claim を隔離できる | Gate に関係する unsupported claim は DQ-03、非 Gate 関連は completeness 低下として扱う |
| G-08 | graph は部分構築できる | parser failure があっても失敗内容を completeness に保持し、成功 artifact と誤認させない |
| G-09 | deterministic field を区別する | stable ID / placement / verdict は deterministic とし、`runId` / `createdAt` / output path は run 固有値として扱う |
| G-10 | producer namespace を持つ | graph node / edge / obligation / evidence join ID は `<producer>:<local-id>` 形式を標準とし、予約 prefix は `rand` / `ctg` / `mbb` / `hate` / `qeg` とする |

traceability の受入条件:

- Gate 関連 node / edge / placement / disqualification / blocker は `sourceRefs` を 1 件以上持つ。
- prefix なし ID は deprecation warning 付きで受理するが、未知 prefix は validation error にする。
- `assumptions` は空配列でもよいが、判定に影響する assumption は requiredHumanReview または blocker へ昇格する。
- `confidence=low` の claim は、単独では blocking risk の反証 evidence にできない。

## 9. Test Placement 要件

| ID | 要件 | 受入条件 |
|---|---|---|
| T-01 | risk ごとに obligation を作る | requirementIds, riskIds, failureModeIds, changedCodeIds を持つ |
| T-02 | layer 候補を評価する | `unit / integration / system / e2e / manual-scripted / manual-exploratory / spec-clarification` を扱える |
| T-03 | reuse / adapt / add を区別する | 既存テスト資産と不足テスト要求を混同しない |
| T-04 | manual layer を first-class に扱う | oracle gap、UX、device、role matrix は manual 層へ配置できる |
| T-05 | code-to-gate の suggestedLevel を尊重しつつ再判定する | suggestedLevel は evidence の一部であり、QEG の final placement を拘束しない |
| T-06 | placement rationale を残す | 候補 layer ごとに eligible / score / rationale / sourceRefs を出力できる |
| T-07 | blocking obligation を表現できる | 必要な oracle や環境が欠ける場合、placement disposition を `blocked` にできる |
| T-08 | manual coverage dimension を保持する | manual 由来の obligation は flow / state / rule / data / role / regression のいずれかへ分類できる |
| T-09 | oracle type を区別する | specified / derived / implicit / human の oracle 種別を rationale または traceability に残せる |
| T-10 | manual から automated への re-placement を記録できる | `placement_changes[]` は `subject_id`, `from_layer`, `to_layer`, `replacement_ids[]`, `evidence_refs[]`, `policy_ref`, `decided_by`, `decided_at`, `reversible=true`, `revert_condition` を持つ |
| T-11 | manual case の引退 criteria を policy として扱う | 引退可否のしきい値は `GatePolicy.placementRetirementPolicy` に置き、QEG は `evidenceStrength`, 直近 green 回数, risk coverage を評価する |
| T-12 | 引退後も risk coverage を逆引きできる | 引退済み manual case の risk は `replacement_ids[]` の自動 test node から `coveredRiskIds` と `replaced_by` edge で automated coverage として辿れる |
| T-13 | 引退は可逆イベントとして扱う | replacement test の削除、`evidenceStrength` 低下、green 回数不足、risk coverage 欠落が起き、manual case が復帰していなければ revert 候補として DQ-14 にする |
| T-14 | manual case の単純消失を検出する | `manual_case_inventory.previous_subject_ids` から消えた case が `current_subject_ids` にも `placement_changes[].subject_id` にも無い場合、無断消失として DQ-14 にする |
| T-15 | mock test を Gate 証跡から除外する | test node は `testExecutionMode=real|mock` を必須とし、`mock` は placement retirement の `evidenceStrength`、直近 green 回数、risk coverage を満たさない。除外 ID と理由は Gate 出力に残す |

placement score は MVP では次の入力を使う。

- oracle fit
- change proximity
- interaction fit
- business fidelity
- observability
- stability
- reuse gain
- setup / runtime / flake cost penalty

MVP では score の重みを policy として外出ししなくてよい。既定値を固定し、`profile` は Gate threshold の切り替えにだけ使う。

manual-scripted に配置するには specified または derived oracle を原則必須にする。implicit oracle は補助 evidence に限定し、human oracle は reviewer または requiredHumanReview を必要とする。

manual case の引退は waiver ではなく placement の変更として記録する。引退は risk node の削除を伴わず、risk は automated layer の replacement test によりカバー中として辿れる必要がある。引退 criteria の値は policy 側に固定し、QEG は policy を読んで判定する。waiver は例外承認、placement_change はテスト配置の変更履歴であり、互いに代替しない。

## 10. Gate 要件

| ID | 要件 | 受入条件 |
|---|---|---|
| V-01 | Gate verdict を出力する | `go / conditional_go / no_go / disqualified` の 4 値を返す |
| V-02 | disqualified を no_go と混同しない | 判定資格が壊れている場合は release 可否ではなく `disqualified` を返す |
| V-03 | Gate reason は source-backed にする | `reasons` は独立した根拠文ではなく、sourceRefs を持つ disqualification / blocker / residual risk / human review の要約として生成する |
| V-04 | 必須 3 接続先の Gate input を統合する | RanD audit、code-to-gate readiness、manual-bb gate を入力として QEG Gate を計算する |
| V-05 | safe fallback を持つ | graph completeness が壊れた場合は `disqualified` または `no_go` に倒れる |
| V-06 | profile を持つ | `lean / standard / strict` の GateProfile で threshold を切り替えられる |
| V-07 | human review を明示できる | 自動判定だけで閉じない blocker は `requiredHumanReview` に node id を列挙する |
| V-08 | waiver を扱える | accepted waiver は risk / approver / reason / expiry / sourceRefs を持つ場合だけ有効にできる |
| V-09 | 判定優先順位を固定する | DQ が 1 件以上あれば `disqualified` を最優先し、次に blocking risk で `no_go`、次に residual risk / valid waiver で `conditional_go`、最後に `go` とする |
| V-10 | conditional_go の責務を固定する | valid waiver、owner、期限、rollback / containment、follow-up のいずれかを source-backed に持つ |
| V-11 | IPO profile を持つ | `ipo_controlled` profile では conditional_go を CI success として扱わず、waiver / human review / approval evidence を必須にする |
| V-12 | Gate policy を版管理する | Gate threshold、profile、DQ 有効範囲、exit code policy は policyId / policyHash / sourceRefs を持つ |
| V-13 | QEG policy 正本を一元化する | 外部 policy は proposal としてだけ受理し、採用時は QEG policyHash と approval evidence policyHash を照合する |

verdict の既定:

- `disqualified`: artifact 欠落、schema invalid、根拠欠落、revision 矛盾などで判定資格が壊れている。
- `no_go`: 判定資格はあるが、blocking risk、未反証の P0/P1 risk、失敗 evidence がある。
- `conditional_go`: residual risk または期限付き waiver があり、人間の承認や follow-up が必要。
- `go`: blocking risk、失格条件、期限切れ waiver、required human review が残っていない。

Gate profile の既定は `standard` とする。`strict` は認証、決済、個人情報、不可逆操作、広範囲 shared asset 変更で使う。`lean` は小さな hotfix など blast radius が狭い場合に限る。IPO レベルの運用では `ipo_controlled` を既定とし、`lean` は使わない。

## 11. 失格条件

| ID | 条件 |
|---|---|
| DQ-01 | 必須 artifact が欠落または schema invalid |
| DQ-02 | final Gate reason が source-backed な disqualification / blocker / residual risk / human review に紐づかない |
| DQ-03 | gate-relevant path に unsupported claim がある |
| DQ-04 | P0/P1 risk の oracle gap を事実扱いしている |
| DQ-05 | changed_code が 1 件以上あるのに test obligation または accepted waiver がない |
| DQ-06 | evidence の path / line / hash が実体と一致しない |
| DQ-07 | partial graph の completeness が明示されていない |
| DQ-08 | manual test case に expected result / oracle / traceability がない |
| DQ-09 | secret / token / PII を unredacted で artifact に保存した |
| DQ-10 | benchmark mode で hidden oracle に candidate がアクセスした |
| DQ-11 | 必須 3 接続先の契約違反を成功扱いした |
| DQ-12 | base_ref / head_ref と artifact revision / producer check head SHA / producer readiness verdict が不一致 |
| DQ-13 | Gate 関連 node / edge / placement / blocker / disqualification の sourceRefs が空 |
| DQ-14 | manual-scripted placement が acceptable oracle を持たない、または manual→automated の replacement が mock test 証跡だけで成立している |
| DQ-15 | Gate policy / waiver / approval evidence が版管理または source-backed でない |
| DQ-16 | release 判定に使った evidence が silent overwrite 可能な保管先だけに存在する |
| DQ-17 | producer / reviewer / approver / waiver approver の職務分掌が記録されていない |
| DQ-18 | 必須 risk に matching real resilience evidence がない、mock-only、wrong scenario / environment、または selected status が error / timeout / skipped |
| DQ-19 | resilience evidence が stale、envelope timestamp が未来・逆順、または latest evidence の選択が曖昧 |
| DQ-20 | required observed / signal が存在しない、phase / metric / resolvable hash-backed EvidenceRef と結び付かない、または observed summary と一致しない |
| DQ-21 | required な steady state、fault、abort、recovery、actual target / duration の field または時系列が欠落・矛盾する |

DQ-13 は schema だけでは全 Gate 関連 node / edge / placement を完全に識別できないため、MVP では evaluator で判定する。ただし `gate-verdict.json` の `disqualifications[].sourceRefs` と `blockers[].sourceRefs` は schema 上も空配列を許さない。

## 12. 出力 artifact 要件

| ID | Artifact | 内容 | 受入条件 |
|---|---|---|---|
| O-01 | `qeg.bundle.json` | canonical graph、metadata、completeness | node / edge / sourceArtifactIds が schema validation を通る |
| O-02 | `test-placement-plan.json` | obligations、placements、candidate scores | 全 blocking risk に placement または accepted waiver がある |
| O-03 | `gate-verdict.json` | verdict、reasons、disqualifications、blockers、residualRisks、requiredHumanReview、testEvidenceAccounting | verdict と reasons が source-backed な判定材料へ逆引きでき、mock test の非算入を監査できる |
| O-04 | `quality-evidence-record.json` | run 全体の最終 record | metadata、graph、placementPlan、gate、exports を含む |
| O-05 | Markdown record | 人間向け要約 | verdict、主要 blocker、placement summary、証跡参照を含む |

Markdown record は次の順で要約する。

1. Gate 判定
2. No-Go / disqualified 理由
3. P0/P1 risk と placement
4. manual-scripted / manual-exploratory / spec-clarification の未解決項目
5. optional evidence の補助状況
6. requiredHumanReview と follow-up

## 13. CLI / 処理フロー要件

MVP は CLI first とし、最低限次の処理単位を持つ。

| ID | Command | 目的 | 受入条件 |
|---|---|---|---|
| C-01 | `validate` | 入力 artifact と QEG 出力 schema を検証する | invalid artifact を DQ-01 候補として報告できる |
| C-02 | `build-graph` | adapter 出力から canonical graph を作る | fixture から deterministic な nodes / edges を生成できる |
| C-03 | `place-tests` | risk ごとの obligation と placement を作る | placement rationale と candidate scores を出力できる |
| C-04 | `gate` | Gate verdict を計算する | DQ / blocker / residual risk / human review を区別できる |
| C-05 | `record` | Quality Evidence Record を生成する | 4 JSON artifact と Markdown summary を束ねられる |
| C-06 | `report` | CI で複数 target を最後まで評価し、不足証跡と Gate failure を累積表示する | `gate-input.json` 欠落、ingest error、DQ、blocker、residual risk、human review を target 別 / DQ 別に出力し、CI artifact として保存できる |
| C-07 | `doctor` | ローカル環境、build 出力、schema、CI workflow、target artifact の不足を事前診断する | hard failure と warning を分け、warning だけなら exit code `0` にする |
| C-08 | `explain <DQ>` | DQ code の意味、原因、必要証跡、最小修正、参照仕様を説明する | 例: `DQ-15` の approval / policy / waiver 証跡不足を人間が直せる粒度で表示できる |
| C-09 | `schema-check` | JSON Schema の compile と fixture 内 artifact の schema validation を行う | schema 自体の破損と fixture/schema drift を分けて報告できる |
| C-10 | `enum-check` | TypeScript 型と JSON Schema enum の drift を検出する | `GateProfile`、`GateVerdict`、`DisqualificationCode` の差分を列挙できる |
| C-11 | `snapshot` | CI report の golden snapshot を fixture ごとに検証する | `generatedAt` と absolute path を正規化し、差分を安定して検出できる |
| C-12 | `init` | 他 repo へ最小 QEG 設定を導入する | `.qeg/gate-input.json`、`.qeg/qeg-baseline.json`、GitHub Actions workflow を生成できる |
| C-13 | `report --github-summary` | GitHub Actions Job Summary に人間向け累積レポートを書く | CI log の末尾だけに依存せず、DQ 別 / target 別の不足を Step Summary で読める |
| C-14 | `report --baseline` | 既知の DQ を baseline として受理し、新規 DQ だけを赤にする | baseline が全 current DQ を覆い、blocker / residual risk / human review / expected mismatch がない場合だけ pass 扱いにできる |
| C-15 | `report --changed-only` | 変更に関係する target だけを評価する | `QEG_CHANGED_FILES` または git diff から対象を絞り、対象なしの場合は空 report / exit `0` にできる |
| C-16 | `qeg-report-action` | OSS 利用者が GitHub Actions へ QEG report を組み込みやすくする | report step 自体は成功終了し、`exit_code` output、artifact、Step Summary を残してから呼び出し側の final verdict で失敗させられる |
| C-17 | `baseline audit` | baseline の放置を防ぐ | 期限切れ、owner 未設定、存在しない target、すでに解消済みの DQ を検出できる |
| C-18 | `report --diff <previous-report.json>` | 前回 CI との差分を表示する | DQ を `new` / `resolved` / `unchanged` に分類し、今回増えた不足と解消した不足を読める |
| C-19 | `repro-bundle` | CI 失敗の再現材料をまとめる | report、doctor、schema inventory、package version、workflow、対象 `gate-input.json` を secret redaction 付きで bundle 化できる |
| C-20 | `evidence verify` | Gate 前に証跡実体だけを高速検証する | artifact path、hash、revision、retention、storageClassification の不足や矛盾を Gate 全体より前に切り分けられる |
| C-21 | `policy lint` | GatePolicy 正本の矛盾を検査する | `policyHash`、`sourceRefs`、`exitCodePolicy`、`dqScope`、profile 設定の不整合を検出できる |
| C-22 | `check` | ローカル総合確認入口を提供する | schema-check、enum-check、doctor、snapshot、report を一括実行し、導入者が最初に見るコマンドにできる |
| C-23 | Action outputs 拡充 | workflow 側の条件分岐を容易にする | `exit_code` に加え、`gate_failed`、`cli_errors`、`dq_count`、`report_path`、`summary_markdown_path` を出力できる |
| C-24 | `evidence normalize --adapter <kind>` | 外部 resilience evidence を canonical node へ非破壊変換する | local raw JSON を読み、provenance と hash を保持した qeg-resilience-evidence-v1 を出力し、外部環境を操作しない |

CLI の exit code は MVP では最小限にする。

- `0`: artifact 生成と validation が成功した。
- `1`: validation、parse、判定計算、出力のいずれかで処理エラーが起きた。
- `2`: QEG としては正常に判定したが、verdict が `no_go` または `disqualified` だった。

`conditional_go` の exit code は `profile` で切り替える。MVP の `standard` では `0` を許容するが、`strict` と `ipo_controlled` では `2` にする。

`report` は target を最後まで評価してから exit code を返す。CLI error が 1 件でもある場合は `1`、CLI error がなく Gate failure が 1 件でもある場合は `2`、全 target が `go` の場合は `0` とする。

GitHub Actions では、QEG report の非 0 exit を shell step の即時 failure として扱わず、artifact / Step Summary / exit code output を保存してから最終判定 step で job を失敗させる。これにより `Process completed with exit code 1` だけで原因が読めない状態を避ける。

baseline は DQ を消す仕組みではなく、既知の不足を明示して「新規不足だけを赤にする」ための移行補助である。baseline が適用された target は report 上 `baseline_accepted` として数え、通常の `passed` と区別する。

baseline は owner と期限を持つ運用証跡として扱う。owner 未設定、期限切れ、target 消失、現在の report に存在しない DQ は `baseline audit` で検出し、永久免罪符化を防ぐ。

`report --diff` は DQ 単位で前回 report と比較する。比較 key は target、DQ code、message、nodeIds とし、今回だけ存在するものを `new`、前回だけ存在するものを `resolved`、両方に存在するものを `unchanged` とする。

## 14. Governance / Control 要件

| ID | 要件 | 受入条件 |
|---|---|---|
| CRTL-01 | 要件正本を版管理する | `docs/requirements.md` は Git または同等の監査可能な管理下にあり、変更差分を追える |
| CRTL-02 | policy 正本を版管理する | Gate policy は policyId / policyHash / effective date / approver を持つ |
| CRTL-03 | 職務分掌を記録する | producer / reviewer / approver / waiver approver / release owner を metadata または external control evidence に記録する |
| CRTL-04 | waiver を統制する | waiver は linked risk、承認者、承認権限、理由、期限、影響範囲、再確認条件、sourceRefs を持つ |
| CRTL-05 | 承認証跡を分離する | QEG が生成した判断材料と、人間が承認した release decision を混同しない |
| CRTL-06 | evidence package を出力できる | external reviewer が入力 artifact、policy、hash、Gate verdict、waiver、manual evidence を辿れる bundle を生成できる |
| CRTL-07 | control mapping を持つ | 変更管理、品質判定、例外承認、証跡保全、アクセス管理、リリース承認への対応表を文書化する |
| CRTL-08 | schema drift を統制する | schema 変更は migration note、互換性影響、fixture 更新、承認者を持つ |
| CRTL-09 | 監査用 retention を定義する | release 判定に使った evidence、policy、Gate verdict、waiver、record の保管期間と保管先を定義する |
| CRTL-10 | tamper evidence を持つ | release 判定後の evidence 変更、削除、再生成を hash / revision / immutable storage で検知できる |

## 15. Security / Privacy / LLM 要件

| ID | 要件 | 受入条件 |
|---|---|---|
| SEC-01 | secret safe | secret / token / PII は unredacted で artifact に保存しない |
| SEC-02 | data classification | artifact / evidence / markdown record は public / internal / confidential / restricted の分類を持てる |
| SEC-03 | access control | restricted evidence は読み取り権限、承認者、保管先を記録できる |
| SEC-04 | audit logging | Gate 実行、policy 変更、waiver 作成、record 生成は actor / timestamp / command / input hash を記録できる |
| SEC-05 | LLM optional governance | LLM を使う場合は model id、prompt hash、input redaction、output review、human approval、再現不能時の扱いを記録する |
| SEC-06 | external transmission control | source code、PII、restricted evidence を外部 provider へ送る場合は明示的な policy と approval を必要にする |

## 16. Schema Hardening 要件

| ID | 要件 | 受入条件 |
|---|---|---|
| SH-01 | MVP schema と strict schema を分ける | MVP では緩い schema を許すが、`ipo_controlled` profile では strict schema を要求できる |
| SH-02 | additionalProperties を縮小する | IPO レベルでは gate-relevant artifact の `additionalProperties: true` を段階的に廃止する |
| SH-03 | empty evidence を禁止する | Gate 関連 disqualification / blocker / placement rationale は空 sourceRefs を許さない |
| SH-04 | migration path を持つ | schema strict 化は breaking change として扱い、fixture と compatibility note を更新する |
| SH-05 | typed contract を優先する | TypeScript 型、JSON Schema、fixture、requirements のいずれかが矛盾したら release 判定を止める |

## 17. 非機能要件

| ID | 要件 | 受入条件 |
|---|---|---|
| N-01 | local-first | source code を外部へ送らなくても動作する |
| N-02 | deterministic | 同一 input / policy / revision で同一 ID と同一 Gate を返す |
| N-03 | schema-first | 出力 artifact は JSON Schema で検証できる |
| N-04 | own-output validation | QEG が出した artifact は自分で schema validation できる |
| N-05 | adapter contract test | 必須 3 adapter は fixture で契約テストできる |
| N-06 | minimal extensibility | optional evidence は追加できるが、必須 3 接続先の責務を薄めない |
| N-07 | secret safe | secret / token / PII は出力 artifact に unredacted で保存しない |
| N-08 | audit friendly | input hash、policy hash、artifact revision、runId を保持する |
| N-09 | fixture driven | 正常系と失格系の fixture で adapter / graph / placement / gate を検収できる |
| N-10 | controlled docs | 要件、policy、schema、fixture は release 対象 artifact として扱う |
| N-11 | reproducible audit package | release 判定の再確認に必要な入力、出力、policy、hash、承認証跡を bundle 化できる |

## 18. MVP 受入条件

MVP は次を満たしたら完了とする。

- `docs/requirements.md` が必須 3 接続先、workflow support、memx 対象外を明記している
- `src/types.ts` に `RequiredAdapterKind`、`WorkflowCookbookRef`、adapter input interfaces がある
- `schemas/*.schema.json` が JSON として parse できる
- `qeg.bundle.schema.json`, `test-placement-plan.schema.json`, `gate-verdict.schema.json`, `quality-evidence-record.schema.json` が存在する
- RanD / code-to-gate / manual-bb の adapter contract test 用 fixture 方針が文書化されている
- minimal fixture から graph、placement plan、gate verdict を生成できる
- `disqualified` と `no_go` の違いが Gate 要件に明記されている
- DQ-01 / DQ-02 / DQ-03 / DQ-05 / DQ-12 / DQ-13 / DQ-14 を評価できる
- QEG が生成した artifact を own-output validation できる
- negative fixture として、必須 artifact 欠落、sourceRefs 欠落、revision 不一致、manual oracle 欠落を最低 1 件ずつ持つ
- manual-bb の optional artifact が存在する fixture と欠落する fixture の両方で、MVP の Gate 判定が壊れない
- optional evidence が invalid な fixture で、必須 3 接続先の DQ と optional parser failure を区別できる
- `ipo_controlled` profile の要求は MVP 完了条件ではなく V1 control hardening の対象として文書化されている

## 19. 実装ロードマップ

| Phase | 内容 | 完了条件 |
|---|---|---|
| MVP-1 | 契約固定 | requirements、types、schemas、fixture 方針が揃う |
| MVP-2 | Adapter skeleton | 必須 3 adapter の入力型と normalizer が fixture で動く |
| MVP-3 | Graph builder | deterministic stable ID で node / edge / completeness を生成できる |
| MVP-4 | Placement engine | risk obligation と placement rationale を生成できる |
| MVP-5 | Gate evaluator | DQ、blocker、residual risk、human review を区別して verdict を返せる |
| MVP-6 | Record / CLI | 4 JSON artifact、Markdown summary、exit code を生成できる |
| V1-control | Governance hardening | `ipo_controlled` profile、control mapping、waiver governance、audit package を用意する |
| V1-schema | Schema hardening | gate-relevant artifact の strict schema、migration note、fixture 更新を用意する |
| V1-export | Export / CI integration | GraphML / SARIF 拡張点、CI template、policy profile 拡張を用意する |

## 20. 実装準備タスク

| Task | 内容 | 完了条件 |
|---|---|---|
| TASK-01 | 必須 3 adapter の入力型を細分化する | `src/types.ts` に adapter input interfaces がある |
| TASK-02 | schema validation CLI を追加する | MVP 4 schema を検証できる |
| TASK-03 | minimal fixture を追加する | RanD / code-to-gate / manual-bb のサンプル artifact がある |
| TASK-04 | graph builder の pure function を追加する | fixture から node / edge を生成できる |
| TASK-05 | placement engine skeleton を追加する | obligation と candidate score を生成できる |
| TASK-06 | Gate evaluator skeleton を追加する | DQ-01 / DQ-02 / DQ-03 / DQ-05 / DQ-12 / DQ-13 / DQ-14 を評価できる |
| TASK-07 | Quality Evidence Record を追加する | 4 JSON artifact と Markdown summary を生成できる |
| TASK-08 | negative fixture を追加する | 欠落、根拠空、revision 不一致、manual oracle 欠落、optional evidence invalid を検収できる |
| TASK-09 | control mapping を追加する | 変更管理、例外承認、証跡保全、リリース承認への対応表がある |
| TASK-10 | `ipo_controlled` profile を設計する | conditional_go exit code、waiver 必須項目、approval evidence、retention 方針が定義される |

## 21. 0.2.0 fail-closed追加要件

- 全判定CLIはgate-input.schema.jsonを起点とする共通preflightを使用する。
- unreadable JSON/envelope欠落はexit 1、parse可能な必須schema不適合はDQ-01/exit 2とする。
- ipo_controlledの必須evidenceは実体path、SHA-256、revisionを照合する。
- qeg-ci-report-v2はselectionとreport-level errorsを保持し、changed-onlyの差分検出失敗をexit 1とする。
- 外部Actionはartifact upload後に既定でenforceし、自repoの集約CIだけdiagnostic-onlyとする。
- fixtureの一覧と期待結果はfixtures/manifest.jsonを正本とする。

## 22. Reliability / Resilience 拡張要件

| ID | 要件 | 受入条件 |
|---|---|---|
| REL-01 | QEG は resilience experiment を実行しない | QEG CLI は外部 adapter が出力した local artifact の正規化、検証、会計、判定だけを行う |
| REL-02 | resilience test を識別する | testType=resilience の test は scenario、coveredRiskIds、traceability を持つ |
| REL-03 | resilience evidence を識別する | evidenceType=resilience の execution_evidence は adapter provenance、revision、actual fault、lifecycle、observed、hash 付き signal manifest を持つ |
| REL-04 | real evidence を要求する | required risk の mock-only evidence は coverage に算入せず DQ-18 とする |
| REL-05 | freshness と revision を検証する | targetRevision 不一致は DQ-12、stale または不正 timestamp は DQ-19 とする |
| REL-06 | observability を証明する | latency、traffic、errors、saturation と副作用 / data integrity は hash 付き signal artifact と測定情報により検証できる |
| REL-07 | 実測 safety を検証する | actual target、duration、environment が policy 上限を超えた場合は blocker とする |
| REL-08 | report を再現可能にする | risk 別 coverage、pass rate の分母、recovery time、DQ、blocker、excluded mock を出力する |
| REL-09 | 評価時計を固定する | freshness と waiver expiry は metadata.createdAt だけを使い、wall clock によって verdict を変えない |
| REL-10 | evidence 選択を決定的にする | 最新 evidence を選び、同時刻競合は DQ-19、最新失敗時の旧 pass fallback は禁止する |
| REL-11 | production 実験を Gate 対象外にする | MVP の forbidProduction は true 固定で、waiver による解除を許さない |
| REL-12 | risk coverage と pass rate を分離する | riskCoverageRate は risk 単位、resiliencePassRate は selected execution 単位で計算する |
| REL-13 | revision anchor を必須化する | reliabilityPolicy 有効時は metadata.headRef に完全な Git object ID を要求する |
| REL-14 | selected evidence を一意にする | non-deleted required resilience test ごとに current revision の latest 1 件だけを選び、複数 test はすべて必須として評価する |
| REL-15 | policy provenance を固定する | reliabilityPolicy 有効時は input policy、top-level metadata、graph.metadata の policyId / policyHash が一致する |
| REL-16 | abort を実測 signal で裏付ける | abortRecord は構造化 condition と hash-backed signal entry の値・window・operator に一致する |
| REL-17 | resilience branch を strict にする | discriminator 付き test / evidence は既知 field だけを受理し、legacy branch の互換性は維持する |

詳細な field、判定優先順位、fixture、実装写像は docs/spec/reliability-extension.md を正本とする。
