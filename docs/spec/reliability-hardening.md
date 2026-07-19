---
intent_id: INT-QEG-RELIABILITY-HARDENING-001
owner: quality-evidence-graph
status: active
profile: standard,strict,ipo_controlled
last_reviewed_at: 2026-07-19
next_review_due: 2026-10-19
---

# Reliability / Resilience 実装 hardening 仕様

## 1. 位置付け

本書は `docs/spec/reliability-extension.md` に基づく実装を、保守可能性、公開型の安全性、判定の一貫性、end-to-end 回帰証跡の観点で修正するための追加正本である。feature の意味と wire contract は元仕様を維持し、本書は次を規定する。

- DQ-18〜DQ-21 の責務と、元仕様内に残る矛盾の解消
- reliability evaluator の分割境界と stage 間 contract
- schema 検証と evaluator 検証の責務分離
- `QegNode` の公開 TypeScript discriminator contract
- reliability negative fixture matrix と CI 完了条件
- evidence normalizer の fail-closed、determinism、Lakda 境界

正本の優先順位は次のとおりとする。

1. `docs/requirements.md`
2. `docs/spec/reliability-extension.md` と本書
3. `docs/spec/reliability-hardening-checklist.md`
4. 実装、test、fixture、生成済み report

元仕様と本書が競合する場合、本書で「決めきり」と明示した事項を優先する。競合を発見した場合は元仕様も同じ変更で更新し、追加仕様だけに恒久的な差分を残してはならない。

## 2. 目的と非目的

### 2.1 目的

1. 同じ Gate input と artifact から、実行時刻、OS、locale、node 列挙順に依存しない同一 verdict と同一 reliability accounting を生成する。
2. schema-invalid、artifact-unverified、policy identity mismatch、selection ambiguity を fail-closed で扱う。
3. legacy node の入力互換性を維持しながら、`testType` / `evidenceType` による TypeScript narrowing を成立させる。
4. evaluator の各判定を独立して unit test でき、DQ と blocker の出所を追跡できる構造にする。
5. runtime test だけでなく、CLI、artifact verification、record、report を通る fixture で主要な失敗経路を固定する。

### 2.2 非目的

- QEG に fault injection、experiment orchestration、cluster 操作を実装しない。
- 外部環境、実 cluster、実 fault injection、Lakda real acceptance を本作業の完了条件にしない。
- fixture の成功を実環境の resilience 承認へ昇格しない。
- DQ code、BLK-REL rule、`GateResult.reliability` wire shape、`qegVersion` を追加または変更しない。
- release、tag、publish、merge を行わない。

## 3. 決めきり

| ID | 決定 |
|---|---|
| REL-H01 | reliability evaluator は `src/gate/reliability/` 配下へ stage 単位で分割し、`src/gate/reliability.ts` は互換 facade とする。`src/evaluator` は新設しない。 |
| REL-H02 | DQ-19 は選択一意性だけ、DQ-21 は reliability policy identity だけを扱う。timestamp、lifecycle、abort の不整合は DQ-18 とする。 |
| REL-H03 | `testId` を evidence と test の判定用 join key とする。`evidenced_by` edge は provenance 監査に使うが、edge 不在だけで candidate を除外しない。 |
| REL-H04 | `status` を execution outcome の正本とする。`passed` は legacy-compatible な任意 summary であり、存在する場合だけ `status` と一致を要求する。 |
| REL-H05 | non-completing status `error` / `timeout` / `skipped` には fault、observed、signal、recovery を要求しない。revision、timestamp、environment が有効なら decision-grade attempt として BLK-REL-03 にする。 |
| REL-H06 | intra-node の構造・意味制約は schema validation、graph / policy / artifact をまたぐ制約は Gate evaluator が担当する。同一制約を双方で別実装しない。 |
| REL-H07 | public `TestNode` と `ExecutionEvidenceNode` は legacy branch と resilience branch の union とし、discriminator で追加 field へ narrow できるようにする。 |
| REL-H08 | end-to-end fixture を reliability の判定正本とし、runtime mutation test だけで主要 failure mode を証明したことにしない。 |
| REL-H09 | Lakda は HATE/v1 artifact producer に限定する。QEG verdict、policy 採用、実験実行を Lakda adapter に持たせない。 |
| REL-H10 | package version は `0.2.0`、graph の `qegVersion` は `0.2` を維持する。hardening は既存 contract の欠陥修正として扱う。 |

## 4. 判定 contract

### 4.1 DQ の責務

同じ原因に複数 DQ を付与してはならない。独立した原因には複数 DQ を保持してよい。優先順位は元仕様どおり `DQ-01 > DQ-06 > DQ-12 > DQ-21 > DQ-19 > DQ-18 > DQ-20` とする。

| Code | 本仕様での唯一の責務 | 代表条件 |
|---|---|---|
| DQ-01 | input の構造・intra-node semantic 不正 | strict schema 違反、SLO / signal / abort ID 重複、範囲逆転、`status` / `passed` 矛盾 |
| DQ-06 | artifact verification 不成立 | report 不在、path / symlink escape、読込不能、SHA-256 不一致、signal EvidenceRef 未解決 |
| DQ-12 | revision 不一致 | evidence、raw artifact、signal artifact の revision が `metadata.headRef` と不一致 |
| DQ-18 | resilience candidate の資格不成立 | real candidate 不在、mock-only、stale / future / invalid time、environment、steady state、fault、abort、recovery lifecycle 不整合 |
| DQ-19 | evidence 選択の一意性不成立 | 同一 execution identity の競合、または latest instant に異なる decision fingerprint が複数存在 |
| DQ-20 | observed / signal の証拠不成立 | required signal 不足、phase / metric / unit / aggregation 不一致、observed summary と measurement 不一致 |
| DQ-21 | reliability policy identity 不成立 | schema-valid input で graph metadata を含む full revision、SHA-256 policy hash・policy ID・profile の cross-object 欠落・形式不正・3 者不一致、または policy の DQ scope 不足 |

次の条件は DQ-19 または DQ-21 へ分類してはならない。

- `startedAt` / `endedAt` の envelope、freshness、future skew: DQ-18
- `faultStartedAt` / `faultEndedAt` / `recoveryConfirmedAt` / `abortRecord.triggeredAt` の順序: DQ-18
- abort condition と signal entry の condition ID、signal ID、source、name、aggregation、unit、window、値の不一致: DQ-18
- required recovery phase、recovery field、recovery duration の不成立: DQ-18 または BLK-REL-02（下記規則に従う）

### 4.2 schema と cross-object validation

schema validation は 1 node 内だけで確定できる次を担当し、違反は DQ-01 とする。

- discriminator と strict unknown-field rejection
- fixed-true policy、production 禁止、enum、format、path の lexical 制約
- SLO 名、SLO tuple、signal entry ID、abort condition ID の一意性
- min / max、start / end の静的な大小関係
- `passed` が存在する場合の `status` との一致

top-level gate-input の reliability 条件付き required / format も schema validation の責務である。CLI preflight でこれに違反した input は DQ-01 とし、同じ原因の DQ-21 を重ねない。schema preflight を経ず public evaluator を直接呼ぶ場合は、policy identity stage が同等の欠落・形式不正を DQ-21 で fail-closed にする。

Gate evaluator は graph、policy、artifact、複数 node を横断する次を担当する。

- risk → test → evidence の join と latest selection
- scenario と policy の effective threshold intersection
- evaluation clock に対する freshness / future 判定
- artifact verification report の照合
- policy identity の 3 者一致
- scenario、fault、abort、signal、observed の相互照合

共通 pure validator が必要な場合は `src/validation/reliability-semantics.ts` に置き、schema preflight と evaluator から同じ関数を呼び出す。validation 層から gate 層への逆依存を作ってはならない。関数は入力を書き換えず、次の情報を返す。

```ts
interface ReliabilityContractIssue {
  kind: "schema" | "qualification";
  rule: string;
  path: string;
  nodeId?: string;
  testId?: string;
  evidenceId?: string;
}
```

message 文字列を分岐条件に使用してはならない。`rule` は test で固定できる安定 ID とし、外部 wire field には昇格しない。

### 4.3 status と qualification

| status | lifecycle / observed / signal 要求 | qualification 後の扱い |
|---|---|---|
| `pass` | steady state、fault、observed、signal、および policy が要求する recovery を検証 | 再計算が全て適合すれば pass。閾値違反は BLK-REL-01、recovery 不成立は BLK-REL-02 |
| `fail` | `pass` と同じ | 資格があれば BLK-REL-03。閾値または recovery blocker を併記してよい |
| `aborted` | steady state、fault、observed、signal、abortRecord を検証 | abort contract が有効なら BLK-REL-03。abort contract 不正は DQ-18 |
| `error` / `timeout` / `skipped` | fault、observed、signal、recovery を要求しない | revision、envelope、environment が有効なら BLK-REL-03。欠けている実験 field を理由に DQ-18 / DQ-20 を作らない |

`passed` が存在しないことだけを理由に BLK-REL-03 を作ってはならない。`status=pass` かつ `passed` が未指定または `true` の場合だけ producer outcome は pass 候補となる。`status!=pass` は `passed=false` または未指定でなければ schema invalid とする。

### 4.4 recovery と abort

- `requireRecoveryObservation=true` で `recovered=false`、または必要 field が欠ける場合は BLK-REL-02 とする。
- recovery timestamp / duration が存在するが内部時系列または再計算値が矛盾する場合は DQ-18 とする。
- `recoveryDurationMs > maxRecoverySeconds * 1000` は BLK-REL-02 とする。
- trace / log abort condition の `observedValue` は `matchedCount` と照合する。`aggregation` と `unit` も condition と一致させる。
- abort 条件が true でなければ DQ-18 とし、BLK-REL-03 だけで済ませてはならない。

### 4.5 candidate selection

1. required severity に該当する required risk を確定する。
2. non-deleted resilience test を `coveredRiskIds` と `requires_test` trace path で required risk に join する。
3. evidence の `testId` が required test ID と一致するものを linked candidate とする。
4. `testExecutionMode=real` を base candidate とする。mock は監査用に保持するが分子・分母から除外する。
5. `targetRevision=metadata.headRef` を current candidate とする。
6. current candidate の `endedAt` を UTC instant に正規化し、最大 instant を latest とする。
7. latest tie は canonical decision fingerprint が同一のときだけ重複として畳む。異なる場合は DQ-19 とし、ID や status の良否で選ばない。

`evidenced_by` edge が存在する場合は provenance として report / sourceRefs に保持する。edge の欠落だけで `testId` が一致する evidence を除外しない。edge が別 test を指すなど明示的に矛盾する場合は schema / graph traceability の既存 DQ を適用し、silently ignore しない。

selected evidence が DQ または blocker になっても古い pass へ fallback してはならない。BLK-REL-04 は selected evidence だけでなく current revision の全 real attempt に適用する。

## 5. evaluator architecture

### 5.1 module topology

`src/gate/reliability.ts` の public export と `evaluateReliability` の呼出 contract は維持し、実処理を次へ分割する。

| Module | 責務 | 禁止事項 |
|---|---|---|
| `src/gate/reliability/contracts.ts` | internal stage 型、安定 rule ID | Gate 判定ロジック |
| `src/validation/reliability-semantics.ts` | schema / evaluator 共通の pure semantic validation | gate orchestration、graph mutation、I/O |
| `src/gate/reliability/indexing.ts` | risk / test / evidence index | DQ message の生成 |
| `src/gate/reliability/selection.ts` | base / current / latest selection、fingerprint | blocker 判定 |
| `src/gate/reliability/qualification.ts` | revision、time、environment、lifecycle、policy identity | threshold blocker 判定 |
| `src/gate/reliability/signals.ts` | signal resolution、phase、unit、aggregation、observed 再計算 | artifact file I/O |
| `src/gate/reliability/blockers.ts` | BLK-REL-01〜04、waiver eligibility | candidate 選択 |
| `src/gate/reliability/accounting.ts` | counts、rates、nearest-rank percentile、drill-down | qualification の再判定 |
| `src/gate/reliability.ts` | facade、stage orchestration、公開 export | stage 内ロジックの再実装 |

artifact file I/O は既存 verifier が担当し、evaluator は immutable な verification report だけを受け取る。reliability 有効時に report が渡されない programmatic evaluation は DQ-06 とする。

### 5.2 stage contract

stage 間では raw node 配列ではなく、少なくとも次を持つ typed result を渡す。

```ts
interface ReliabilitySelectionResult {
  testId: string;
  riskIds: string[];
  baseCandidateIds: string[];
  currentCandidateIds: string[];
  selectedEvidenceId?: string;
  excluded: ReliabilityExclusion[];
  issues: ReliabilityIssue[];
}

interface ReliabilityQualificationResult {
  testId: string;
  evidenceId?: string;
  qualified: boolean;
  issues: ReliabilityIssue[];
  measurements?: ReliabilityMeasurements;
  sourceRefs: string[];
}
```

各 stage は入力を変更せず、output ordering を固定する。risk ID、test ID、evidence ID、rule ID の順で安定 sort し、Node / V8 の object enumeration order を判定結果へ漏らさない。

### 5.3 issue ownership

各 issue / blocker は 1 stage だけが生成責任を持つ。

- selection: evidence targetRevision の DQ-12、DQ-18 の candidate 不在、DQ-19
- qualification: DQ-18 lifecycle、DQ-21
- signals: DQ-20
- artifact preflight: DQ-06、raw / signal artifact revision の DQ-12
- blockers: BLK-REL-01〜04
- accounting: 新規 DQ / blocker を生成しない

message wording の共通化は helper で行ってよいが、別 stage が同じ issue を再生成して deduplicate する設計にしてはならない。

## 6. 公開 TypeScript contract

### 6.1 node union

公開型は概念上次の形とする。実際の field は既存 interface を保持する。

```ts
interface TestNodeBase extends QegNodeBase {
  type: "test";
  // legacy 共通 field
}

export interface LegacyTestNode extends TestNodeBase {
  testType?: Exclude<TestType, "resilience">;
  resilienceScenario?: never;
}

export interface ResilienceTestNode extends TestNodeBase {
  testType: "resilience";
  resilienceScenario: ResilienceScenario;
}

export type TestNode = LegacyTestNode | ResilienceTestNode;

interface ExecutionEvidenceNodeBase extends QegNodeBase {
  type: "execution_evidence";
  // legacy 共通 field
}

export interface LegacyExecutionEvidenceNode extends ExecutionEvidenceNodeBase {
  evidenceType?: never;
}

export interface ResilienceExecutionEvidenceNode extends ExecutionEvidenceNodeBase {
  evidenceType: "resilience";
  // resilience 固有 field
}

export type ExecutionEvidenceNode = LegacyExecutionEvidenceNode | ResilienceExecutionEvidenceNode;
```

`QegNode` は上記 union alias を含む。次が custom type guard なしで compile しなければならない。

```ts
function inspect(node: QegNode): void {
  if (node.type === "test" && node.testType === "resilience") {
    node.resilienceScenario.faultModel;
  }
  if (node.type === "execution_evidence" && node.evidenceType === "resilience") {
    node.signalManifest.entries;
  }
}
```

### 6.2 互換性

- discriminator を持たない既存 test / execution_evidence object は引き続き assign 可能とする。
- 既存 field の optional / required は resilience branch 以外で強化しない。
- public export 名 `TestNode`、`ExecutionEvidenceNode`、`QegNode` は維持する。
- resilience 専用 field は legacy branch から参照できないようにする。
- type-only compile fixture を package test に含め、source tree と packed tarball の両方に対して検証する。

interface から union type alias への変更で declaration merging を利用していた consumer は影響を受け得る。この repo は declaration merging を公開拡張点として保証していない。release note には型精度向上として記録するが、wire / runtime breaking change とは扱わない。

## 7. reliability fixture contract

### 7.1 end-to-end 必須 matrix

各 fixture は directory、`gate-input.json`、必要な raw / signal artifact、期待値を持ち、`fixtures/manifest.json` に登録する。最低限、次を用意する。

| Fixture | Primary expectation |
|---|---|
| `positive-reliability-go` | go、DQ なし、blocker なし、accounting / percentile 固定 |
| `positive-legacy-compatible` | reliability disabled、legacy verdict 不変 |
| `negative-resilience-artifact-tamper` | DQ-06 |
| `negative-resilience-revision-mismatch` | DQ-12、DQ-18 を重複しない |
| `negative-resilience-mock-only` | DQ-18 |
| `negative-resilience-stale` | DQ-18 |
| `negative-resilience-lifecycle` | DQ-18 |
| `negative-resilience-selection-ambiguous` | DQ-19 |
| `negative-resilience-signal-missing` | DQ-20 |
| `negative-resilience-signal-mismatch` | DQ-20 |
| `negative-resilience-policy-identity` | DQ-21 |
| `negative-resilience-threshold` | BLK-REL-01、no_go |
| `negative-resilience-recovery` | BLK-REL-02、no_go |
| `negative-resilience-nonpass` | BLK-REL-03、no_go |
| `negative-resilience-safety` | BLK-REL-04、no_go |
| `conditional-resilience-waived-threshold` | BLK-REL-01 effective=false、conditional_go |
| `conditional-resilience-waived-recovery` | BLK-REL-02 effective=false、conditional_go |
| `conditional-resilience-waived-nonpass` | BLK-REL-03 effective=false、conditional_go |
| `negative-resilience-safety-waiver-attempt` | BLK-REL-04 effective=true、no_go |
| `negative-resilience-latest-fail` | latest fail を選択し旧 pass へ fallback しない |
| `negative-resilience-prior-safety-attempt` | latest が安全でも prior current attempt の BLK-REL-04 を保持 |

### 7.2 manifest expectation

reliability fixture の manifest entry は少なくとも verdict、exit code、primary DQ、deterministic な primary blocker instance ID、blocker rule set を比較できなければならない。既存の `primaryDq` / `primaryBlocker` は維持し、rule set 用 field がなければ backward-compatible に追加する。

```json
{
  "expected": {
    "exitCode": 2,
    "verdict": "no_go",
    "primaryDq": null,
    "primaryBlocker": "blocker:rel:01:risk:checkout:test:resilience:evidence:run-3",
    "blockerRuleIds": ["BLK-REL-01"]
  }
}
```

`primaryBlocker` は exact instance ID を比較し、`blockerRuleIds` は instance ID とは独立に semantic rule set を比較する。fixture harness は片方だけを確認して成功扱いしてはならない。

### 7.3 fixture execution path

各 end-to-end fixture は少なくとも次を通す。

1. gate-input schema validation
2. graph 内 raw / signal artifact verification
3. Gate evaluation
4. JSON report と text report
5. `record` と snapshot round-trip
6. 自身が生成した JSON の再 parse / schema validation

policy lint failure と normalize command failure は Gate fixture ではなく CLI contract test で扱ってよい。test helper で baseline object を mutation する場合も、上表の主要 failure mode は on-disk fixture を省略してはならない。

## 8. evidence normalize hardening

### 8.1 共通

- input / context は 1 回だけ bytes として読み、その同じ bytes から parse と hash を行う。
- canonical comparison は locale に依存しない code-point / byte ordering を使う。`localeCompare` の既定 locale を判定に使用しない。
- error message に raw payload、token、request body、trace attribute を含めない。
- temporary output は target output と同じ directory に作成し、成功時だけ atomic rename する。
- `--force` がない既存 output、path escape、symlink escape、unreadable JSON、unsupported adapter、schema-invalid output は exit 1 とし、一時 file を残さない。
- schema-valid だが Gate qualification field が不足する evidence は normalize success とし、後続 Gate で DQ にする。値を捏造して schema を満たしてはならない。

### 8.2 adapter boundary

- Lakda adapter は HATE/v1 manifest の run ID、attempt、commit、artifact metadata を canonical evidence へ写像するだけとする。
- Lakda の acceptance / verdict、探索実行、fault injection、認証情報の読込を QEG normalize から呼び出さない。
- Toxiproxy は raw に存在する proxy / toxic と実測 field だけを写像する。`actualTargetIds`、timestamp、duration が取得できないとき placeholder を作らない。
- shell / CI adapter は versioned envelope 以外を暗黙推測しない。
- Chaos Mesh、Litmus、Docker Compose、custom は canonical evidence 直接入力を許可するが、MVP normalize では unsupported のままとする。

## 9. report と wire compatibility

`GateResult.reliability`、`GateBlocker`、`ReliabilityAccounting` の JSON shape は変更しない。refactor 前後で同一 input の canonical JSON report は byte-equivalent を原則とし、ordering が既存で不安定だった箇所だけ golden snapshot の意図的な更新を許可する。

text report は次を省略してはならない。

- enabled / disabled
- counts、risk coverage、execution pass rate
- percentile と sample count
- selected evidence と excluded reason
- DQ code / sourceRefs
- blocker instance ID / ruleId / riskId / testId / evidenceId / effective / waiverId

normalizer、evaluator、report の内部 module 名や issue rule は wire contract に露出させない。

## 10. 実装順序

1. 元仕様の矛盾修正と public type compile test を先に追加する。
2. 現行 evaluator 出力を golden test で固定する。
3. semantic validator を共通化し、同一入力に対する DQ code / sourceRefs 不変を確認する。
4. indexing、selection、qualification、signals、blockers、accounting の順で module を抽出する。
5. negative end-to-end fixture を追加し、manifest harness を拡張する。
6. normalizer の deterministic / atomic / redaction test を追加する。
7. package smoke、Birdseye、Node 20 / 24 CI を完了する。

各抽出 commit は build と runtime test が通る単位にする。大規模な file move と挙動変更を同じ差分で行ってはならない。

## 11. 受入条件

### 11.1 contract acceptance

- legacy node が schema と TypeScript の両方で互換である。
- resilience branch が discriminator により追加 field へ narrow できる。
- DQ-18 / 19 / 20 / 21 の各 fixture が本書の責務どおりで、同一原因の DQ 重複がない。
- `error` / `timeout` / `skipped` が欠損実験 field だけを理由に DQ にならず、BLK-REL-03 になる。
- `passed` 未指定の valid pass を BLK-REL-03 にしない。
- waiver は risk ID と test ID の双方が一致する BLK-REL-01〜03 だけを ineffective にでき、BLK-REL-04 は常に effective である。
- latest fail と prior safety violation を後続 pass で隠せない。
- reliability 無効時の既存 fixture verdict、exit code、report shape が不変である。

### 11.2 local verification

次をすべて成功させる。

```text
npm ci
npm run typecheck
npm run build
npm run test:runtime
npm run schema-check
npm run enum-check
npm run test:fixtures
npm run test:package
npm run birdseye-check
```

加えて、repository 内 JSON の parse、package dry-run、`git diff --check` を成功させる。

### 11.3 CI acceptance

最新 commit に対する GitHub Actions の `quality (20)` と `quality (24)` が両方 SUCCESS であることを完了条件とする。cancelled、skipped、古い commit の成功を代用してはならない。

## 12. 証跡と完了判定

実装完了時は `docs/spec/reliability-hardening-checklist.md` に、test 名、fixture ID、最新の code-bearing commit SHA とその CI run URL を記録する。チェックリストを埋めただけでは完了とせず、記載した証跡が当該 code-bearing commit と一致することを確認する。

この証跡を記録する後続 commit は docs-only とする。自己参照を避けるため、チェックリスト内の implementation evidence を docs-only commit 自身へ書き換えない。代わりに draft PR の最新 check と最終引継ぎで、docs-only commit に対する `quality (20)` / `quality (24)` の SUCCESS を確認する。

本 hardening の完了は QEG 実装と CI の完了を意味する。実サービスの resilience、Lakda real acceptance、release approval、publish approval を意味しない。
