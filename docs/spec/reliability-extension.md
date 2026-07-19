---
intent_id: INT-QEG-RELIABILITY-001
owner: quality-evidence-graph
status: active
profile: standard,strict,ipo_controlled
last_reviewed_at: 2026-07-19
next_review_due: 2026-10-19
---

# Reliability / Resilience 拡張仕様

## 1. 目的と固定判断

この仕様は、外部の障害注入・実験基盤が作成した resilience evidence を QEG が検証、会計、Gate 判定するための contract を定義する。

QEG は fault 注入、Kubernetes / Docker Compose 操作、環境払い出し、secret 管理、deployment、rollback を実行してはならない。Lakda、Toxiproxy、Chaos Mesh、LitmusChaos、CI、shell script などは evidence producer であり、QEG は validator、accountant、judge に限定する。

この仕様では、次を固定する。

- resilience test と resilience evidence は明示的な discriminator を持つ。
- resilience evidence は実行対象 revision、実際の fault、実測した blast radius、steady state、recovery、観測 signal を結び付ける。
- Gate policy が freshness、実行モード、signal、しきい値、安全上限を決める。
- 判定資格の不足は DQ、測定済みの品質または安全上限の違反は blocker とする。
- mock 実行は監査記録として残すが、resilience coverage に計上しない。
- freshness と waiver expiry の評価時刻は metadata.createdAt に固定し、同一入力から同一 verdict を再現する。
- JSON Schema は単一 object の構造を検証し、node 間、policy 間、時系列、集計の整合は evaluator が検証する。

用語の MUST、MUST NOT、SHOULD は規範的な要件を表す。

## 2. 適用範囲と互換性

### 2.1 対象

- kind が test で testType が resilience の test node
- 上記 test node に紐付く kind が execution_evidence で evidenceType が resilience の node
- GatePolicy の任意 field である reliabilityPolicy
- resilience coverage、pass rate、recovery time を含む Gate report

### 2.2 対象外

- 実験の起動、停止、再実行、環境制御
- external observability backend の検索、保存、アクセス制御
- raw trace や raw log の QEG 内への無制限な取り込み
- producer 固有の実験定義の再定義

### 2.3 後方互換

- reliabilityPolicy がない既存 policy では resilience 判定を有効化しない。
- testType がない既存 test node は legacy test として扱い、既存の testExecutionMode accounting を変更しない。
- evidenceType がない既存 execution_evidence は legacy evidence として扱い、本仕様の resilience 必須項目を要求しない。
- resilience evidence では status を正本とする。既存の passed を併記する場合は、status が pass のときだけ true、それ以外は false でなければならない。不一致は schema invalid とし DQ-01 とする。

reliabilityPolicy を有効にする policy は、DQ-18 から DQ-21 を dqScope に含めなければならない。

### 2.4 Validation boundary

schema validation は、discriminator、型、enum、必須の識別・provenance field、単一 object 内の if / then を検証する。schema validation に失敗した入力は DQ-01 とし、resilience evaluator を実行しない。

次は複数 node または policy を参照するため evaluator で判定する。

- risk、failure mode、test、execution evidence の join
- policy severity と required environment の適用
- targetRevision、freshness、signal artifact revision の一致
- steady state、fault、abort、recovery の時系列
- signal summary と observed の一致
- DQ、blocker、coverage、pass rate の計算

policy 条件により必要になる field は schema 上で省略可能でもよい。その field が実際の判定で不足した場合は DQ-18〜DQ-21 を使い、汎用の DQ-01 に置き換えない。

reliabilityPolicy が存在する gate input は、top-level metadata.headRef、policyId、policyHash を必須とする。headRef は完全な lower-case Git SHA-1 または SHA-256、policyHash は sha256: に続く lower-case 64 桁 hex とする。この条件は gate-input schema の if / then で検証し、欠落または形式不正は DQ-01 とする。

判定時刻と revision の正本は top-level metadata、policy の正本は gate input の policy とする。input.policy の policyId / policyHash、top-level metadata の policyId / policyHash、graph.metadata の policyId / policyHash は 3 者で一致しなければならない。input.policy.profile、top-level metadata.profile、graph.metadata.profile も一致しなければならず、reliabilityPolicy を使える profile は standard、strict、ipo_controlled に限定する。top-level gate input 自体の required / format 違反は前段 schema preflight の DQ-01 とする。schema-valid な input に対し、graph metadata を含む完全 SHA、SHA-256 policyHash、policyId、profile の cross-object 欠落・形式不正・不一致、または reliabilityPolicy 有効時に policy.dqScope が DQ-18〜DQ-21 をすべて含まない場合は DQ-21 とする。個別 evidence の targetRevision / rawArtifactRef / signal EvidenceRef revision が headRef と異なる場合は DQ-12 とする。

## 3. Graph contract

### 3.1 Resilience test node

testType が resilience の test node は、既存の node 共通必須 field に加え、次を持たなければならない。

| Field | Required | Rule |
|---|---|---|
| testType | yes | 値は resilience。 |
| testExecutionMode | yes | resilience Gate に計上する execution は real のみ。 |
| resilienceScenario | yes | 3.2 の contract を満たす。 |
| coveredRiskIds | yes | 1 件以上。risk node と同一 ID を使う。 |
| sourceArtifactIds | yes | scenario 定義を含む入力 artifact を指す。 |
| traceability.sourceRefs | yes | scenario の根拠を 1 件以上持つ。 |

risk coverage は test.coveredRiskIds の risk ID によって成立する。MVP は既存 graph との互換性を優先し、requires_test / evidenced_by edge を追加必須にはしない。required risk に対し coveredRiskIds を含む non-deleted、testType=resilience、testExecutionMode=real の test を required resilience test と呼ぶ。該当する test はすべて必須であり、いずれか 1 件を代替選択する OR 条件にはしない。required resilience test が 1 件もない、または mock-only の場合は DQ-18 とする。

execution evidence は evidence.testId により test に結び付ける。edge は監査上の追加 provenance として受理するが、この MVP の selection 前提ではない。

### 3.2 resilienceScenario

resilienceScenario は次を必須とする。

| Field | Required | Rule |
|---|---|---|
| faultModel | yes | dependency_timeout、dependency_http_error、network_latency、packet_loss、process_crash、container_restart、pod_kill、duplicate_event、out_of_order_event、resource_pressure、custom のいずれか。 |
| steadyState.slos | yes | 1 件以上。各 SLO は name、metricName、semanticRole、aggregation、unit、evaluationPhases、target を持つ。 |
| steadyState.requiredMetrics | yes | 1 件以上の metricName。signal manifest で証明可能でなければならない。 |
| steadyState.requiredTraces | yes | boolean。 |
| steadyState.requiredLogs | yes | boolean。 |
| blastRadius | yes | planned environment、allowedTargets、maxTargets、maxDurationSeconds を持つ。 |
| abortConditions | yes | 1 件以上。id、source、signal、aggregation、operator、threshold、unit を持つ。 |

SLO target は次のいずれかで表す。

| targetType | Required value | Meaning |
|---|---|---|
| max | value | 観測値が value 以下であること。 |
| min | value | 観測値が value 以上であること。 |
| range | min と max | 観測値が閉区間内であること。 |

range に単一の target 値を使ってはならない。

aggregation は latest、min、max、avg、p50、p95、p99、rate、count のいずれかとする。SLO の semanticRole は 3.4 の metric semanticRole と同じ enum を使い、custom の場合は customSemanticRoleName を必須とする。SLO の name は scenario 内で一意とし、metricName、semanticRole、aggregation、unit の組も一意とする。steadyState.requiredMetrics は重複を許さず、すべての SLO の metricName を含まなければならない。

SLO の evaluationPhases は steady_state、fault、recovery の重複しない 1 件以上の配列とし、steady_state を必須とする。requireRecoveryObservation=true の policy では recovery も含めなければならず、含まない scenario は policy 不適合として DQ-18 とする。fault を含む SLO 違反は BLK-REL-01、recovery を含む SLO の未回復は BLK-REL-02 とする。steadyStateConfirmed が true でない、または steady-state signal が不足する場合は DQ-18 または DQ-20 とする。

abort condition の source は metric、trace_count、log_count のいずれか、operator は gt、gte、lt、lte、eq、ne のいずれかとする。source=metric の signal は metricName、trace_count または log_count の signal は signalManifest entry の signalName と一致しなければならない。QEG は自由記述の式を実行または評価してはならない。

faultModel=custom の場合は customFaultModelName を必須とする。その他の faultModel で customFaultModelName を使ってはならない。

resilienceScenario とその下位 object は additionalProperties=false とする。resilienceScenario が存在する test は testType=resilience でなければならず、他の testType で resilienceScenario を持ってはならない。

testType=resilience の discriminator branch は QegNodeBase、既存 TestNode field、本仕様の resilience field を列挙し、branch 全体を additionalProperties=false とする。testType がない legacy test branch の受理範囲は変更しない。

testType を持つ場合の enum は functional、security、performance、resilience とする。testType がない legacy test は互換受理する。

### 3.3 Resilience execution evidence node

resilience evidence は evidenceType を resilience とする。次は schema 上の必須 field とする。

| Field | Required | Rule |
|---|---|---|
| evidenceType | yes | 値は resilience。 |
| testId | yes | testType=resilience の test node を指す stable ID。 |
| adapter | yes | lakda、toxiproxy、chaos-mesh、litmus-chaos、docker-compose、shell、ci、custom のいずれか。 |
| adapterVersion | yes | producer または adapter の version。空文字不可。 |
| normalizationVersion | yes | MVP では qeg-resilience-evidence-v1 固定。 |
| experimentId | yes | producer run を一意に識別する stable ID。 |
| attempt | yes | experiment 内の 1 以上の整数。 |
| rawArtifactRef | yes | id、path、contentHash、revision を持つ。 |
| targetRevision | yes | 実験対象の immutable revision。metadata.headRef と一致する。 |
| environment | yes | local、ci、staging、preprod、production のいずれか。 |
| environmentId | yes | 実験対象を特定する非 secret の識別子。 |
| startedAt、endedAt | yes | ISO date-time。endedAt は startedAt 以後。 |
| status | yes | pass、fail、aborted、error、timeout、skipped のいずれか。 |
| evidenceRefs | yes | 1 件以上。signalManifest.evidenceRefId が指す参照をすべて含む。 |

status が pass、fail、aborted の場合、次を Gate qualification の必須 field とする。policy との横断条件があるため、これらの不足は evaluator が判定する。

| Field | Required condition | Rule |
|---|---|---|
| steadyStateConfirmed | pass / fail / aborted | fault 注入前に scenario SLO を確認できたか。 |
| fault | pass / fail / aborted | type、parameters、faultStartedAt、faultEndedAt、actualTargetIds、appliedDurationMs を持つ。 |
| abortRecord | status=aborted | conditionId、signalEntryId、triggeredAt、observedValue、unit を持つ。 |
| recovered | requireRecoveryObservation=true | recovery の有無。 |
| recoveryConfirmedAt | recovered=true | steady state 回復を確認した時刻。 |
| recoveryDurationMs | recovered=true | faultEndedAt から recoveryConfirmedAt までの 0 以上の整数 millisecond。 |
| observed | pass / fail / aborted | requestCount、errorRate、latencyP95Ms、saturationPct、duplicateSideEffects、dataInconsistencies を持つ。 |
| signalManifest | pass / fail / aborted | 3.4 の contract を満たす。 |

qualification field は schema で型と object shape を検証するが、policy と status をまたぐ必須性は evaluator で判定する。steadyStateConfirmed、fault、abort lifecycle の不足は DQ-18、observed または signalManifest の不足は DQ-20 とする。recovery 観測が必要な実行で `recovered=false` または recovery field が不足する場合は BLK-REL-02 とし、存在する recovery field の時系列または再計算値が矛盾する場合は DQ-18 とする。

fault.actualTargetIds は 1 件以上とし、scenario.blastRadius.allowedTargets の部分集合でなければならない。fault.appliedDurationMs は 1 以上の整数とし、faultEndedAt - faultStartedAt の millisecond 値と一致しなければならない。

recoveryDurationMs は recoveryConfirmedAt - faultEndedAt の millisecond 値と一致しなければならない。steady state、fault、abort、recovery の timestamp が startedAt から endedAt の範囲外、または順序矛盾する場合は DQ-18 とする。

abortRecord.conditionId は scenario.abortConditions の id、signalEntryId は signalManifest 内の entry id と一致しなければならない。entry の source、signalName または metricName、aggregation、unit は abort condition と一致し、triggeredAt は entry の window 内かつ faultStartedAt から faultEndedAt の範囲内でなければならない。metric entry の observedValue、trace / log entry の matchedCount は abortRecord.observedValue と一致し、operator を適用した結果が true でなければならない。不一致は DQ-18 とする。status=aborted 以外で abortRecord を持ってはならない。

environment は scenario.blastRadius.environment および policy.requiredEnvironment と一致しなければならない。fault.type が scenario.faultModel と一致しない evidence は、その test の matching evidence として数えない。

adapter=custom の場合は customAdapterName を必須とする。その他の adapter で customAdapterName を使ってはならない。

adapter、experimentId、attempt、targetRevision の組は graph 内で一意とする。同じ組に異なる evidence node または rawArtifactRef.contentHash が存在する場合は selection_ambiguous として DQ-19 とする。

rawArtifactRef.contentHash は sha256: に続く lower-case 64 桁 hex とする。rawArtifactRef.path は gate-input.json を含む Gate target directory からの相対 path とし、absolute path と parent traversal を許可しない。fixture 実行時は fixture directory が Gate target directory である。rawArtifactRef.revision は targetRevision と一致しなければならない。必須 field または形式の不正は DQ-01、実体 hash 不一致は DQ-06、revision 不一致は DQ-12 とする。

targetRevision は branch 名、tag 名、短縮 SHA を許可しない。Git object ID を使う場合は lower-case の完全な SHA-1 または SHA-256 とする。QEG は metadata.headRef と targetRevision を文字列完全一致で比較する。不一致は既存の DQ-12 とする。

passed を併記する場合、status=pass のときだけ true、それ以外は false とする。この条件は JSON Schema の if / then で検証する。

resilience 専用 field は execution_evidence node 直下に置く。evidenceType=resilience の discriminator branch は QegNodeBase、既存 ExecutionEvidenceNode field、本仕様の resilience field を列挙し、branch 全体を additionalProperties=false とする。evidenceType=resilience 以外の node は resilience 専用 field を持ってはならず、evidenceType がない legacy execution_evidence branch の受理範囲は変更しない。

### 3.4 Signal manifest

signalManifest は、観測値と実体 artifact を一対一に結び付ける。

| Signal | Required condition | Minimum contract |
|---|---|---|
| metrics | policy または scenario が要求する場合 | id、phase、metricName、semanticRole、aggregation、windowStart、windowEnd、observedValue、unit、evidenceRefId。 |
| traces | policy または scenario が要求する場合 | id、signalName、phase、query / filter の redacted summary、matchedCount、windowStart、windowEnd、evidenceRefId。 |
| logs | policy または scenario が要求する場合 | id、signalName、phase、redacted query summary、matchedCount、windowStart、windowEnd、evidenceRefId。 |

entry id は signalManifest 内で一意とする。phase は steady_state、fault、recovery、experiment のいずれかとする。evidenceRefId は同じ execution evidence node の evidenceRefs 内にある一意な ID を指す。trace / log の signalName は scenario の abort condition から参照できる非 secret の論理名とする。

signal 用 EvidenceRef は既存 EvidenceRef を拡張し、id、path、contentHash、evidenceKind、capturedAt、revision を必須とする。metrics、traces、logs の evidenceKind はそれぞれ observability_metric、observability_trace、observability_log を使う。contentHash は sha256: に続く lower-case 64 桁 hex とする。

signal EvidenceRef.path は Gate target directory からの相対 path とし、absolute path と parent traversal を許可しない。revision は targetRevision と一致し、capturedAt は該当 windowEnd 以後かつ metadata.createdAt 以前でなければならない。path、contentHash、revision の実体照合に失敗した場合は DQ-06、不一致 revision は DQ-12 とする。

signal EvidenceRef 自体の必須 field 欠落または型不正は DQ-01、evidenceRefId が evidenceRefs 内の signal EvidenceRef に解決できない場合は DQ-20、解決後の実体 hash 不一致は DQ-06 とする。

steadyState.requiredMetrics の各 metricName は steady_state phase に存在し、SLO.evaluationPhases に fault または recovery が含まれる場合は該当 phase にも存在しなければならない。policy threshold が参照する metric semanticRole は 4.1 と observed mapping が定める phase に存在しなければならない。requiredTraces または requiredLogs が true の場合は fault phase を必須とし、recovery observation が必要なら recovery phase も必須とする。

required trace / log entry の matchedCount は 1 以上とする。0 件の query result は required signal を満たさず DQ-20 とする。

metric semanticRole は traffic_count、error_rate、latency_p95、saturation、duplicate_side_effects、data_inconsistencies、custom のいずれかとする。custom の場合は customSemanticRoleName を必須とする。

metrics には traffic_count、error_rate、latency_p95、saturation、duplicate_side_effects、data_inconsistencies の各 semanticRole を 1 件以上含める。signal window は startedAt から endedAt の範囲内で、windowStart は windowEnd 以前でなければならない。steady_state window は faultStartedAt 以前、fault window は faultStartedAt から faultEndedAt、recovery window は faultEndedAt から recoveryConfirmedAt の範囲内とする。違反は DQ-20 とする。

observed は signalManifest.metrics から導出した summary であり、独立した真実源ではない。次の field は同じ semanticRole と unit の metric に一致しなければならない。

| observed field | phase | semanticRole | Required unit / aggregation |
|---|---|---|---|
| requestCount | fault | traffic_count | count / count |
| errorRate | fault | error_rate | ratio / rate |
| latencyP95Ms | fault | latency_p95 | ms / p95 |
| saturationPct | fault | saturation | percent / max |
| duplicateSideEffects | experiment | duplicate_side_effects | count / count |
| dataInconsistencies | experiment | data_inconsistencies | count / count |

observed と signal manifest の値が JSON number として完全一致しない、または同じ phase、semanticRole、aggregation、unit に複数の異なる値がある場合は DQ-20 とする。MVP では丸め誤差の tolerance を QEG 側に持たず、producer / normalizer が canonical unit と値へ正規化する。名前だけを列挙し、測定値、phase、hash 付き EvidenceRef を持たない状態は signal の存在として数えない。

requestCount、duplicateSideEffects、dataInconsistencies は 0 以上の整数、errorRate は 0 以上 1 以下、latencyP95Ms は 0 以上、saturationPct は 0 以上 100 以下とする。MVP の QEG は unit 変換を行わない。scenario、policy、signal manifest の unit が一致しない場合は DQ-20 とする。

## 4. Gate policy contract

### 4.1 reliabilityPolicy

GatePolicy.reliabilityPolicy は任意 field とする。存在する場合は enabled=true とし、次を必須とする。enabled=false の空 policy は許可しない。無効化は field 自体を省略して表す。

| Field | Rule |
|---|---|
| enabled | true 固定。false による無効化は使わない。 |
| requiredForSeverities | resilience evidence を要求する risk severity。1 件以上、重複不可。 |
| requiredEnvironment | Gate coverage に採用する environment を 1 件指定する。 |
| allowedExecutionModes | MVP では real だけを 1 件持つ。 |
| maxEvidenceAgeHours | endedAt から Gate evaluation 開始時刻までの最大時間。1 以上。 |
| requireRevisionMatch | MVP では true 固定。targetRevision と metadata.headRef の一致を必須化する。 |
| requireSteadyStateBeforeFault | MVP では true 固定。steadyStateConfirmed=true を必須化する。 |
| requireRecoveryObservation | MVP では true 固定。recovered、recoveryConfirmedAt、recoveryDurationMs を評価する。 |
| requiredSignals | metrics、traces、logs の boolean。metrics は MVP で true 固定。 |
| thresholds | minRequestCount、maxErrorRate、maxLatencyP95Ms、maxSaturationPct、maxRecoverySeconds、maxDuplicateSideEffects、maxDataInconsistencies。 |
| safety | allowedEnvironments、forbidProduction、maxBlastRadiusTargets、maxFaultDurationSeconds。 |
| sourceRefs | policy 根拠を 1 件以上持つ。 |

policy は QEG の正本である。外部 adapter が含めた policy 相当情報は gatePolicyProposal としてのみ保存でき、QEG の reliabilityPolicy を直接置換してはならない。

requiredEnvironment は safety.allowedEnvironments に含まれなければならない。MVP では safety.forbidProduction=true を固定し、production を safety.allowedEnvironments または requiredEnvironment に指定してはならない。この矛盾は policy schema invalid、DQ-01 とする。

requireRevisionMatch、requireSteadyStateBeforeFault、requireRecoveryObservation、requiredSignals.metrics を false にする policy は schema invalid、DQ-01 とする。resilience Gate の判定資格を policy で無効化してはならない。

effective required signal は policy.requiredSignals と scenario の要求の OR とする。どちらか一方が metrics、traces、logs を要求すれば、その signal は必須である。scenario.abortConditions に source=trace_count または log_count があれば、対応する signal も要求済みとみなす。profile 名から暗黙の default を補ってはならず、すべて policy に明示する。

reliabilityPolicy とその下位 object は additionalProperties=false とする。thresholds の rate は 0 以上 1 以下、percent は 0 以上 100 以下、時間と latency は 0 以上、max count は 0 以上の整数、minRequestCount は 1 以上の整数とする。allowedEnvironments と requiredForSeverities は uniqueItems=true とする。

threshold の評価 phase は固定する。minRequestCount、maxErrorRate、maxLatencyP95Ms、maxSaturationPct は fault phase、maxDuplicateSideEffects と maxDataInconsistencies は experiment phase、maxRecoverySeconds は faultEndedAt から recoveryConfirmedAt までの lifecycle 値に適用する。

### 4.2 しきい値の優先順位

policy の safety 上限は絶対上限である。scenario の blastRadius が policy より緩い場合でも、effective limit は policy を使う。

同じ semanticRole と同じ evaluation phase を scenario SLO と policy threshold が評価する場合、より厳しい条件を effective threshold とする。max は小さい値、min は大きい値、range は両方を満たす共通範囲を用いる。scenario または policy 単体で min > max なら schema invalid、DQ-01 とする。両者は単体で valid だが共通範囲が空の場合、その scenario は policy に適合しないため DQ-18 とする。

### 4.3 Evaluation clock

Gate evaluationTime は gate input の metadata.createdAt とする。freshness、future timestamp、waiver expiry、report evidenceAgeHours はすべて同じ evaluationTime を使う。

evaluateGate の evaluation clock は常に metadata.createdAt を parse した instant とする。programmatic API は任意の executionTime を受け取らず、CLI も evaluator 内で wall clock の new Date を再取得してはならない。

metadata.createdAt が parse 不能なら DQ-01 とする。evidenceAgeHours は次の式で計算し、小数を保持する。

evidenceAgeHours = (evaluationTime - endedAt) / 3,600,000

同一 gate input、policy、artifact からは、実行日時にかかわらず同じ DQ、blocker、verdict、reliability accounting を返さなければならない。

evidenceAgeHours が 0 未満なら future evidence として DQ-18、maxEvidenceAgeHours を超える場合は stale として DQ-18 とする。上限と等しい evidence は受理する。

## 5. Gate evaluation

### 5.1 評価対象の選択

選択は required resilience test ごとに次の順で行い、selected evidence は test につき最大 1 件とする。

1. requiredForSeverities に該当する risk を required risk とする。
2. 3.1 の定義に従い、non-deleted required resilience test を risk に join する。
3. testId が一致する resilience evidence を linked candidate とする。evidenced_by edge は存在する場合に provenance として監査するが、edge 不在だけで candidate を除外しない。edge が別 test を指すなど明示的に矛盾する場合は既存の graph traceability DQ を適用する。
4. testExecutionMode=real に一致する evidence を base candidate とする。base candidate が 0 件なら DQ-18 とする。scenario、environment、lifecycle の妥当性は selected evidence を対象に DQ-18 で検証する。
5. base candidate のうち targetRevision が metadata.headRef と一致するものを current candidate とする。base candidate はあるが current candidate が 0 件で revision mismatch が検出できる場合は DQ-12 とし、DQ-18 を重ねない。
6. current candidate の endedAt を UTC instant に正規化し、最も新しい 1 件を selected evidence とする。environmentId または experimentId が異なっても別の selected evidence を作らない。

最新 endedAt の instant が同じ current candidate が複数ある場合、node の id、title、traceability、sourceArtifactIds を除く resilience evidence field 全体を、object key は辞書順、array 順序は保持する canonical JSON に変換し、SHA-256 decision fingerprint を作る。fingerprint が異なる場合、QEG は ID の辞書順や status の良否で選ばず、selection_ambiguous として DQ-19 にする。fingerprint が同一の場合に限り重複 evidence として 1 件に畳み、report provenance の代表 ID は辞書順最小に固定する。

selected evidence が DQ になった場合、同じ required resilience test の古い pass へ fallback してはならない。過去の pass を使って最新の fail、aborted、error、timeout、invalid evidence を隠してはならない。

metadata.headRef と異なる evidence は base candidate として認識したうえで DQ-12 にする。revision mismatch の evidence しかない場合、DQ-18 を重ねて出してはならない。

### 5.2 DQ

| Code | 条件 |
|---|---|
| DQ-12 | targetRevision と metadata.headRef が一致しない。既存 DQ を再利用する。 |
| DQ-18 | 必須 risk に real candidate がない、mock-only、stale / future / invalid timestamp、required environment・steady state・fault・abort lifecycle が不整合である。 |
| DQ-19 | 同じ最新 endedAt の current evidence が異なる canonical decision fingerprint を持ち、選択が曖昧である。 |
| DQ-20 | required observed summary / signal が存在しない、phase / metric / resolvable hash-backed EvidenceRef と結び付かない、または observed summary と signal measurement が一致しない。 |
| DQ-21 | schema-valid な reliability input で、graph metadata を含む full revision、SHA-256 policyHash、policyId、profile の cross-object identity が欠落・形式不正・不一致である、または policy.dqScope が DQ-18〜DQ-21 をすべて含まない。top-level gate-input schema 違反は DQ-01 を優先する。 |

mock evidence は単独では DQ にしない。しかし mock しかないため必須 risk を満たせない場合は DQ-18 とする。これは既存の mock evidence exclusion を維持する。

sourceRefs または evidenceRefs 自体が空なら DQ-13、evidence の path、hash、revision の実体照合に失敗したら DQ-06 を先に適用する。

同じ evidence 原因から general DQ と specific DQ を重複生成しない。優先順位は DQ-01、DQ-06、DQ-12、DQ-21、DQ-19、DQ-18、DQ-20 とする。revision mismatch がある evidence に lifecycle / signal DQ を重ねず、lifecycle DQ がある evidence に signal DQ を重ねない。独立した原因が複数ある場合は複数 DQ を保持する。

### 5.3 Blocker

有効な evidence が存在するが次の条件に当たる場合は blocker とし、verdict は no_go とする。

| ID | 条件 |
|---|---|
| BLK-REL-01 | requestCount、error rate、latency、saturation、duplicate side effect、data inconsistency、または SLO が effective threshold に違反する。 |
| BLK-REL-02 | recovery が観測されたが未完了、または recoveryDurationMs が maxRecoverySeconds × 1000 を超える。 |
| BLK-REL-03 | selected evidence の status が pass 以外、または passed が存在して status と矛盾する。passed が未指定であることだけでは blocker にしない。 |
| BLK-REL-04 | actualTargetIds の集合・件数、appliedDurationMs、environment が scenario または safety policy に違反する。 |

status=pass は producer の自己申告であり、QEG は observed と signal manifest により再判定する。status=aborted で abort record が欠ける、または abort condition を満たさない場合は BLK-REL-03 ではなく DQ-18 とする。

steadyStateConfirmed=false は DQ-18 とする。recovered=false、recoveryConfirmedAt または recoveryDurationMs の不足、または recoveryDurationMs の閾値超過は DQ ではなく BLK-REL-02 とする。

BLK-REL-04 は selected evidence だけでなく、current metadata.headRef に紐付くすべての real resilience evidence に対して評価する。安全上限を超えた attempt を後続の安全な pass で隠してはならない。

BLK-REL-01〜04 は rule ID であり、GateBlocker.id へそのまま使わない。実体 ID は `blocker:rel:<nn>:<risk-id>:<test-id>:<evidence-id>` から deterministic に生成し、対象 risk、test、selected evidence、effective policy の sourceRefs を持つ。

### 5.4 Verdict 優先順位

DQ が 1 件でもあれば disqualified とする。DQ がなく blocker が 1 件以上あれば no_go とする。waiver は DQ を除去できない。

BLK-REL-01〜BLK-REL-03 は、既存 waiver contract を満たし、linkedRiskIds と linkedTestIds の双方が対象と一致し、期限と sourceRefs が有効な場合に限り受理候補にできる。GateBlocker は `effective=false` と waiverId を残し、受理後も最大 verdict は conditional_go とする。BLK-REL-04 は safety violation のため waiver 不可とし、verdict は no_go のままにする。

## 6. Report contract

GateResult.reliability と JSON/text report の reliability section は必須である。reliabilityPolicy を持たない legacy input は正確に `{ "enabled": false }` を出力する。policy がある input は `{ "enabled": true, ... }` の accounting object を出力し、少なくとも次を含む。

| Field | Rule |
|---|---|
| requiredRiskCount | policy が resilience evidence を要求する risk 数。 |
| qualifiedRiskCount | required test のすべてが DQ なしの selected evidence を持つ risk 数。 |
| passingRiskCount | required test のすべてが status=pass かつ blocker なしの risk 数。 |
| riskCoverageRate | qualifiedRiskCount / requiredRiskCount。分母が 0 の場合は null。 |
| requiredExecutionCount | required risk に requires_test で紐付く non-deleted resilience test 数。 |
| qualifiedExecutionCount | DQ なしの selected evidence 数。required resilience test ごとに最大 1。fail / aborted / error / timeout / skipped / blocker を含む。 |
| passingExecutionCount | status=pass で、selected evidence または同じ test の attempt に blocker がない selected evidence 数。 |
| resiliencePassRate | passingExecutionCount / qualifiedExecutionCount。分母が 0 の場合は null。 |
| recoverySecondsP50、recoverySecondsP95 | DQ でない selected evidence の recoveryDurationMs を秒へ変換した分位値。0 件なら null。 |
| duplicateSideEffectsCount、dataInconsistenciesCount | 選択 evidence の合計。 |
| evidenceAgeHours | 選択 evidence ごとの age。 |
| excludedMockTests | 既存 testEvidenceAccounting と同じ理由と sourceRefs を持つ。 |
| dqCountByRule | DQ-12、DQ-18〜DQ-21 を code ごとに集計する。 |

report は risk ID、test ID、evidence ID、adapter、experimentId、attempt、targetRevision、environmentId、選択理由を含む drill-down を出力する。DQ、excluded mock、stale evidence は pass rate の分母から除外する。fail、aborted、error、timeout、skipped、threshold blocker、safety blocker は decision-grade execution として分母に含め、分子には含めない。

resiliencePassRate は execution 単位、riskCoverageRate は risk 単位とし、相互に代用してはならない。risk ごとに複数 test が required の場合は test 単位で一度計算し、risk 単位の qualified / passing は required test がすべて条件を満たす場合だけ成立する。

5.3 により selected evidence 以外から BLK-REL-04 が生成された場合も、その blocker が指す test は passing execution として数えず、その test に依存する required risk も passing risk として数えない。後続の安全な selected evidence により safety violation を report 上で隠してはならない。

percentile は recoveryDurationMs が存在する DQ なし selected evidence だけを対象に nearest-rank 法を使う。値を昇順に並べ、p の rank を ceil(p × N) とし、1-origin の rank にある値を返す。recovered=false の evidence は pass-rate 分母には含むが percentile sample には含めない。N=0 は null とし、report は使用した N も出力する。

## 7. Adapter normalization

adapter は raw payload を破壊せず、resilience evidence に正規化する。正規化結果には adapter、adapterVersion、normalizationVersion、experimentId、attempt、rawArtifactRef、targetRevision、sourceRefs を残す。

MVP の adapter boundary は local JSON artifact とする。command は次の固定形とする。

```text
qeg evidence normalize --adapter <kind> --input <raw.json> --context <context.json> --out <evidence.json> [--base-dir <dir>] [--force]
```

input、context、out は base-dir 内の相対 path に限定する。output は同じ directory の一時 file に書き、schema validation 後に atomic rename する。失敗時は exit 1 とし、不完全な output を残さない。context は node base（id、title、traceability、sourceArtifactIds）、testId、environment、environmentId、adapterVersion、targetRevision、任意の lifecycle / observed、hash-backed signal evidenceRefs / signalManifest を持つ strict schema とする。raw と context に同じ値があり異なる場合は exit 1 とする。

MVP で normalize を実装する adapter は Lakda（HATE/v1 manifest の run ID、attempt、commit、artifact）、Toxiproxy（proxy / toxic JSON の fault type と parameters）、shell（qeg-resilience-shell-v1）、CI（qeg-resilience-ci-v1 の provider run、attempt、head SHA、conclusion、artifact）の 4 種である。Chaos Mesh、Litmus Chaos、Docker Compose、custom は canonical evidence を直接入力できるが、MVP normalize では unsupported として exit 1 とする。qeg evidence normalize は JSON の読込、変換、schema validation、出力だけを行ってよい。fault 注入、network 操作、cluster 操作、secret 読込を行ってはならない。

normalizationVersion=qeg-resilience-evidence-v1 の output は evidenceType=resilience の node contract を直接満たす。adapter 固有 field は rawArtifactRef が指す raw artifact に残し、normalized node 直下へ追加してはならない。

adapter が必要な signal または qualification field を生成できない場合、空配列や placeholder を捏造して成功扱いしてはならない。入力に存在する事実だけで schema-valid な evidence を出力できる場合は normalize success としてよいが、後続 Gate では DQ-18 または DQ-20 になり得る。policy identity の不成立は normalize ではなく Gate の DQ-21 とする。

normalize command で raw JSON が unreadable、adapter が unsupported、または normalized output が schema invalid の場合は command failure、exit code 1 とし、不完全な output file を残さない。schema valid な output の Gate 資格不足は normalize failure にせず、後続 Gate の DQ / blocker として扱う。

## 8. Security / privacy

- raw logs、trace attributes、request payload を Gate artifact に保存する前に secret、token、PII を redaction する。
- signal manifest は query の redacted summary と artifact hash を優先し、raw payload の複製を避ける。
- MVP は production resilience evidence を Gate coverage に使用しない。reliabilityPolicy.safety.forbidProduction は true 固定とし、例外承認や waiver で false に変更できない。
- QEG は producer の認証情報を保持しない。artifact の取得に追加権限が必要な場合は、producer が事前に export した local artifact を入力とする。

## 9. Schema、型、CLI への写像

| Layer | Required change |
|---|---|
| schemas/qeg.bundle.schema.json | testType、resilienceScenario、evidenceType、resilience execution evidence の conditional required を追加する。 |
| schemas/gate-policy.schema.json | reliabilityPolicy と enabled policy の strict contract を追加する。 |
| schemas/shared-defs.schema.json | DQ-18〜DQ-21、EvidenceRef.contentHash、observability evidenceKind、必要な enum を追加する。 |
| src/types/evidence.ts | EvidenceRef に contentHash を追加し、signal 用 ref では hash / revision / capturedAt を必須化する。 |
| src/types/graph.ts | ResilienceScenario、ResilienceExecutionEvidence、SignalManifest を追加する。 |
| src/types/gate.ts | ReliabilityPolicy、reliability accounting の型を追加する。 |
| src/types/primitives.ts / src/types/evidence.ts | DisqualificationCode と EvidenceKind の union を更新する。 |
| src/validation/evidence.ts | rawArtifactRef と signal EvidenceRef を Gate target directory 基準で解決し、path containment、SHA-256、revision を検証する。 |
| src/gate | metadata.createdAt を評価時計とする reliability evaluator と DQ / blocker generator を追加する。既存の src/gate を使用し、src/evaluator は新設しない。 |
| src/cli | dq-explain、init、fixture fallback policy、policy-lint、report section を更新する。 |
| fixtures と tests | 10章の fixture と schema / evaluator / report の回帰テストを追加する。 |

DQ code を追加する場合、schema、TypeScript union、policy lint の全 code list、init template、fixture fallback policy、DQ explain、sourceRefs、manifest、snapshot を同じ変更で更新しなければならない。

## 10. Fixture と受入条件

| Fixture | Expected result |
|---|---|
| fixtures/positive-reliability-go | go。real、current revision、fresh、すべての必須 signal と recovery を持つ。 |
| fixtures/negative-resilience-revision-mismatch | disqualified、primary DQ-12。 |
| fixtures/negative-resilience-mock-only | disqualified、primary DQ-18。 |
| fixtures/negative-resilience-stale-evidence | disqualified、primary DQ-18。 |
| fixtures/negative-resilience-signal-missing | disqualified、primary DQ-20。 |
| fixtures/negative-resilience-signal-summary-mismatch | disqualified、primary DQ-20。 |
| fixtures/negative-resilience-lifecycle-missing | disqualified、primary DQ-18。 |
| fixtures/negative-resilience-selection-ambiguous | disqualified、primary DQ-19。 |
| fixtures/negative-resilience-threshold-blocker | no_go、primary BLK-REL-01。 |
| fixtures/negative-resilience-safety-blocker | no_go、primary BLK-REL-04。 |
| fixtures/positive-resilience-legacy-compatible | 既存 verdict を維持し、reliability section は disabled。 |

実装受入時は、次を満たさなければならない。

- legacy fixture は本仕様の field がないことで schema invalid にならない。
- resilience fixture は validate、gate、record、report、evidence verify、policy lint、snapshot を通じて期待 verdict と DQ / blocker を再現する。
- report の resiliencePassRate は分母が 0 のとき null であり、0 または 1 に偽装しない。
- fail / aborted / blocker は pass-rate 分母に入り、DQ / mock / stale は分母に入らない。
- 同一 fixture を異なる wall clock 時刻に実行しても、metadata.createdAt が同じなら同じ freshness 判定になる。
- latest evidence が fail または DQ のとき、古い pass へ fallback しない。
- current revision の safety violation は後続 pass があっても BLK-REL-04 として残る。
- qeg explain DQ-18 から DQ-21 は原因、必要証跡、最小修正、この仕様への参照を出力する。
- schema enum と TypeScript union の drift check が DQ-18 から DQ-21 と observability evidenceKind を検出できる。

## 11. 実装順序

1. requirements、schema、TypeScript 型、DQ code の contract を同時に固定する。
2. positive / negative fixture と schema validation test を追加する。
3. reliability evaluator、DQ、blocker、test accounting を実装する。
4. report と DQ explain を実装する。
5. adapter normalization を追加し、raw payload fixture で non-destructive mapping を検証する。
6. strict / ipo_controlled profile の source-backed policy と retention への影響を検収する。

本仕様の実装は、schema、types、fixtures、CLI、Gate evidence の整合を一つの Gate evidence package として記録するまで完了としない。
