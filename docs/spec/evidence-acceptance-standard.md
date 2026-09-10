---
intent_id: INT-QEG-EVIDENCE-ACCEPTANCE-001
owner: quality-evidence-graph
status: defined
standard_version: qeg-evidence-acceptance/v1
implementation_status: partially_accepted
last_reviewed_at: 2026-09-10
next_review_due: 2026-12-10
---

# 証跡の共通受入基準

**今回の対象・時点・実行を証明できる証跡だけを、Gateを良化させる根拠として採用する。** ファイルの存在、schema適合、hash一致、CI成功は、それぞれ必要な検証の一部である。

要求正本は [requirements.mdのEAC要求](../requirements.md)。本書は次回改修の判定基準を定めたものであり、現在のruntimeが充足したという記録ではない。[実装・受入状況](../project/evidence-acceptance-status.md)を別に管理する。既存のR01〜R06受入は当時の検証範囲の履歴として保持する。

## 1. 根拠付き観点と判定規則

対象は手動・自動の通常テスト、resilience、native入力、raw adapter入力、およびそれらを使うAPI・CLI・Action・record。既存resilience契約の資格判定、安全性、最新失敗時の旧pass fallback禁止を維持する。`requireExecutedTests=false`の計画評価は実行受入と区別し、実行済み・実環境検証済みという主張に使わない。通常optionalの不正だけを一律DQへ昇格せず、Gateを良化させる根拠に採用する際の資格を検証する。

| 基準 | 観点・根拠 | 必須の判定規則 |
|---|---|---|
| EAC-01 | 対象。manual rawのbuild不一致がgoになった観測、FIX-03/07 | 対象repo/project、完全なrevision、build、feature/case/test、環境・評価scopeを明示し、今回使う証跡と一致させる。不一致・対応不明の必須証跡はDQ |
| EAC-02 | 時点。未来のmanual実行がgoになった観測、REL-09 | 評価時計はmetadata.createdAt。実行日時はtimezone付きでparse可能とし、未来の実行をDQ。有効期間を明示し、期限切れを採用しない |
| EAC-03 | 実行。同一testのfail→passがno_goになった観測、REL-10 | 対象が一致する現在の候補から最新実行を一意に選ぶ。失敗・skip・不正な最新結果を旧passで補完しない。採用・除外の理由を残す |
| EAC-04 | 関連。FIX-05/06、typed reference | 要求/リスク/変更→obligation→placement→test→実行→rawを逆引きできる。別case、未解決参照、ID競合は不足を解消しない |
| EAC-05 | 実体。FIX-04/11/18、producer契約 | 採用証跡のraw・参照先を検証し、hash/revision/producer versionとraw内部の対象情報を照合する。読取失敗の操作・path・原因を保持 |
| EAC-06 | 結果。FIX-07、DQ優先 | required real testの未実行・mock-only・結果不明はDQ。資格のある採用実行がfailならno_go要因。passだけでは既存blocker・DQ・承認不足を消さない |
| EAC-07 | 決定性。G-09、REL-09/10 | 同一input/policy/revisionで採用ID・除外理由・verdictが同じ。入力順、ファイル順、machine clockで変えない |
| EAC-08 | 出力。FIX-08〜10/14 | 有効な正式出力は全成果物が同一世代でschema/hash/相互参照を満たす。検証失敗・中断・競合を成功表示しない |
| EAC-09 | 接続。現行受入の合成fixture範囲 | 合成fixture、実producer由来の固定artifact再生、producer再実行の結合試験を識別する。実接続を主張するには対応する実行証拠が必要 |
| EAC-10 | 移行。FIX-01/16、fixture専用migration | 旧consumerのmode/必須集合/scope/実行条件を明示する。dry-runは変更せず不足を示し、移行で承認・履歴や実行必須条件を暗黙に変更しない |
| EAC-11 | 統制。既存waiver/approval/retention契約 | 全profileで証跡の資格を守る。waiverでDQを消さず、採用結果と外部承認・保管証明を分ける |
| EAC-12 | 完了。FIX-16、既存CI受入条件 | 要求→基準→ケース→実装revision→実行結果を対応付ける。必要ケース未実施・不合格をCI全体の緑や過去の合格で置換しない |

### 1.1 対象の対応

build IDはcommit SHAとは限らない。build→完全なrevisionの対応を、生成元とhash付きsourceRefを持つ入力として明示する。同じrevisionでもbuildや環境が異なる結果は暗黙に代用しない。Git以外の対象は同等に不変なrevision識別方法を実装仕様で定義するまで実行受入しない。

実行はproducer、project、feature、case/test、build、環境を含む文脈で識別し、run IDとraw provenanceを保持する。同じcase名やTC番号だけで別featureを融合しない。現在のmanual gate_decisionと採用execution_evidenceのbuildは一致を要求する。複数producerのrun ID自体が等しい必要はなく、共通の評価対象へ対応する必要がある。

必須の現在入力を、対象不一致を理由に自動で「履歴」へ落として無視してはならない。履歴として別保管・明示された記録は除外理由を残し、今回のcoverageに算入しない。rawのschemaに独自fieldを勝手に追加せず、QEG descriptorと正規化後の契約で必要な対応を保持する。

### 1.2 時計と有効期間

`T = metadata.createdAt`、`t = producer契約で定めた実行完了時刻`、`H = policyで明示する最大経過時間`とする。manual-bb/v1の単一時刻はrawのtimestampを使用する。別producerでは開始時刻を完了時刻へ読み替えない。

- v1の未来許容幅は0。`t > T`はDQ、`t = T`は時刻条件を満たす。
- Hは正の有限値で、時間単位を固定する。通常テストでは暗黙の無期限・任意の既定値を設けず、未設定をDQとする。既存resilienceのmaxEvidenceAgeHoursはその契約を維持する。
- `0 <= T - t <= H`を満たすこと。ちょうどHは有効、Hを超えたら期限切れ。入力精度はミリ秒までで比較し、境界試験の差は1msとする。
- 必須の現在文脈に不正時刻・未来時刻があればDQとし、候補から消して旧passへ戻さない。古い正当な履歴は後述の規則で除外する。
- timezoneなし、不正日時、NaN/無限大/0/負のHを拒否する。wall clockの経過だけで既存recordを再判定しない。別時点の判断には新しいTの入力を作る。

Hの具体値は案件のpolicyで決める。受入用fixtureでは24時間を使用し、製品全体の既定値と誤認させない。新規field名・保存位置・DQ番号の実装写像は、公開型/schema/CLIを更新する実装仕様で固定する。本書のEAC番号は要求・試験の追跡IDであり、追加のruntime DQ番号ではない。

### 1.3 再実行・履歴の採用順序

1. 必須artifact、対象対応、参照、時刻の資格を確認する。同一IDで異なるpayloadはDQ。完全に同じ論理実行ID・hashの重複だけを重複としてまとめられる。
2. 現在の対象に属するreal実行をtest単位でまとめ、実行完了時刻が最新の1件を選ぶ。run IDの辞書順やpassを優先して決めない。異なる論理実行が最新同時刻なら、両方passでも曖昧としてDQ。
3. 最新の有効期間を検証する。最新が期限切れならDQ。過去の不採用実行は理由付きで残し、単なる履歴の期限切れを現在の成功の失敗要因にはしない。
4. 最新passは当該testの実行条件を満たす。最新failはno_go要因。最新skip/blocked/cancelled/unknown/未完了は実行条件を満たさずDQ。どの場合も旧passへ戻らない。
5. 以前のfail→現在のpassでは古いfailを履歴として残す。ただし未解決欠陥、上流no_go、安全性blocker、承認不足は独立して評価し、新しいpassだけで消さない。

採用記録はtest ID、選択したevidence/run ID、対象build/revision、評価時計、採用理由を持つ。不採用記録にもIDと除外理由を持ち、reportとrecordから辿れること。

### 1.4 出力と完了の境界

正式な読取経路は、完了manifestまたは世代pointerを検証する。更新中に新旧のfileが混在していても、混在物を有効なrecordとして返さない。初回は有効出力なし、更新時は旧世代か新世代のどちらかを返すか、明示的な読取/復旧エラーにする。中断後は復旧可能な旧/新世代と診断を残す。同時書込は直列化または明示拒否し、成功と表示した世代が完全であることを確認する。

DQはdisqualified/exit 2、資格のある必須実行のfailはno_go要因/exit 2、CLIの読込・公開・復旧不能はexit 1。診断に対象とsourceRefを付ける。正常対照で他の全条件も満たす場合だけgo/exit 0とする。

## 2. リスク

初期評価は発生率の実測ではなく、確認した挙動と影響範囲に基づく見積り。`raw=4*I*L+2*D+2*C+2*X+2*P-2*A`、`score=round(min(100,raw*100/124))`。I/Lは1〜5、D/C/X/P/Aは0〜3。今回の未検証境界には自動テスト信用A=0を使用する。

| リスク | 対応 | I/L/D/C/X/P/A | score | 根拠 |
|---|---|---|---:|---|
| R-E01 別buildを今回の成功に算入 | EAC-01/04/05 | 5/3/3/2/2/0/0 | 60 | schema/hash検証が成功しても誤ったgoとなった |
| R-E02 未来・期限切れの実行を採用 | EAC-02 | 5/3/3/2/2/0/0 | 60 | 未来時刻のgoを確認、有効期間は通常テストで未定義 |
| R-E03 再実行と履歴を混同 | EAC-03/06/07 | 4/3/2/2/1/0/0 | 47 | 古いfailが残るno_goを確認。新しい失敗を隠す方向にも注意 |
| R-E04 不完全な出力を有効と誤認 | EAC-08 | 5/2/3/3/1/0/0 | 44 | 強制終了・同時実行への耐性は未検証 |
| R-E05 合成fixture成功を実接続の証明に拡大 | EAC-09/12 | 4/3/2/2/2/0/0 | 48 | 現行のproducer E2Eは合成fixtureに限定 |
| R-E06 移行で証跡条件・統制が変化 | EAC-10/11 | 4/3/2/2/1/0/0 | 47 | 既存migrationはfixture専用でconsumerには適用できない |

## 3. 優先度と適用単位

R-E01/02はP1、残りはP2。まず対象・時計・再実行を一緒に整合させる。以下の単位ごとに完了を判断し、部分完了時は単位名を省略しない。

| 受入単位 | 必須基準 | 完了条件 |
|---|---|---|
| 証跡判定 | EAC-01〜07/11/12 | 下表TC-01〜18/25が全成功、実装写像と回帰・該当CIが同一revisionで成功 |
| 出力復旧 | EAC-08/12 | TC-19〜22がLinux/Windowsで成功、正式な読取・復旧手順が定義済み |
| producer実接続 | EAC-09/12 | TC-23を3producerで成功、合成/固定再生/実再実行の証跡を区別 |
| consumer移行 | EAC-10/11/12 | TC-24/25が成功、旧consumerの手順と変更差分をレビュー可能 |

## 4. 受入ケース

すべて今後実装する基準に対する期待結果。現在の合格結果ではない。black-boxを主とし、ログ・manifestによるgray確認を補助にする。自動化済みの同一ケースは実行証拠を流用でき、手動で重複実行する必要はない。

共通前提はraw fixtureまたは隔離consumer、実行必須=true、正当な現在build/revision、他のGate条件を満たす正常対照。操作は「対象データを準備→raw build-graph→place-tests→gate→record→schema/hash確認」。1要因変更ではraw hashも実際のbytesへ整合させ、hashエラーで本来の意味的検証が隠れないようにする。全ケースのoracleは本書の対応EAC規則（specified）とする。

| ケース | 対応/優先 | データ・操作 | 期待結果・確認する証拠 |
|---|---|---|---|
| TC-01 | EAC-01〜07/P1 | canonical_validで同一対象・有効時刻・pass | go/0。選択ID、scope、対象対応をrecordで確認 |
| TC-02 | EAC-01/05/P1 | executionとgate_decisionのbuildだけ異なる | DQ/2。build不一致と両sourceRef。go禁止 |
| TC-03 | EAC-01/04/P1 | build対応欠落、別revision、別feature/case、別環境を個別変更 | 各DQ/2。どの対応が欠けたか判別可能 |
| TC-04 | EAC-02/P1 | 実行時刻T-1ms、T、T+1msのboundary3 | 前2件は時刻条件を充足、T+1msはDQ。入力順に非依存 |
| TC-05 | EAC-02/P1 | 経過H-1ms、H、H+1msのboundary3 | 前2件は期間条件を充足、H+1msはDQ |
| TC-06 | EAC-02/P1 | timezone欠落、不正日付、H欠落/0/負/非有限 | 各DQ/2。parse不能なCLI envelopeだけは既存exit 1 |
| TC-07 | EAC-03/06/P1 | 同一対象の古いfail→新しいpass、未解決欠陥なし | 新passを採用、旧failは履歴。正常対照ではgo/0 |
| TC-08 | EAC-03/06/P1 | 古いpass→新しいfail | no_go/2。旧passへのfallbackなし |
| TC-09 | EAC-03/06/P1 | 古いpass→新しいskip/blocked/cancelled/unknown/未完了 | 各DQ/2。旧passへのfallbackなし |
| TC-10 | EAC-02/03/P1 | 古いpassに未来/不正時刻の現在実行を追加、最新だけ期限切れ | 各DQ/2。不正候補の除外でgoへ戻らない |
| TC-11 | EAC-03/04/P1 | 最新同時刻に異なるrun、同一IDで異なるraw | 同時刻pass/passもDQ。競合する候補を列挙 |
| TC-12 | EAC-03/07/P2 | 同一論理ID/hashの完全重複、入力順の逆転 | 重複は計数しない。選択IDとverdictが不変 |
| TC-13 | EAC-03/06/11/P1 | 最新passだが未解決blockerまたは上流no_goあり | no_go要因を維持。テスト再成功で消去しない |
| TC-14 | EAC-04/06/P1 | 必須testを未実行/mock-only、別testへのedgeに変更 | 各DQ/2。適格実行として計数しない |
| TC-15 | EAC-05/P1 | 採用証跡のraw/参照先を欠落・改変・読取不能にする | 必須証跡はDQまたはCLI I/O error。操作/path/原因を保持しgo禁止 |
| TC-16 | EAC-01/03/P2 | 明示した旧build履歴、現在必須の不一致入力を比較 | 履歴は理由付き除外。現在不一致を自動で履歴化せずDQ |
| TC-17 | EAC-06/11/P2 | optional-only不正、requireExecutedTests=falseの計画評価 | 既存warning契約を維持。実行受入済みとは表示しない |
| TC-18 | EAC-07/12/P1 | 入力順・実行日のwall clock・API/CLI/packed consumerを変更 | 同じ記録時計と入力で意味的結果が一致。採用/除外理由も一致 |
| TC-19 | EAC-08/P2 | 既存出力を作り、schema不正/rename失敗を注入 | schema失敗では既存bytes不変。I/O失敗は復旧/診断、成功表示なし |
| TC-20 | EAC-08/P2 | 公開各境界でプロセス終了→正式経路で読取→再起動 | 旧/新の完全世代、または明示エラー。混在物を有効と扱わない |
| TC-21 | EAC-08/P2 | 同じ出力先へ2実行、公開中に正式読取 | 直列化/明示拒否。成功世代にhash矛盾なし |
| TC-22 | EAC-08/P2 | 初回中断、復旧再実行、manifest/alias改変 | 中断物を完了としない。復旧の再実行で完全世代、改変は検出 |
| TC-23 | EAC-09/P2 | 共通対象への3producerの実出力を保存・再生し、実producer再実行と比較 | version/revision/build/runとraw hashを保持、QEGまで完走。schemaを合わせるための原文改変なし |
| TC-24 | EAC-10/P2 | 旧consumerへdry-run→明示設定して移行→再度移行 | dry-run無変更。不足と差分を提示し、繰返しで不要な変更なし |
| TC-25 | EAC-11/12/P1 | 全profileでP1不正入力、waiver/承認/retentionの組合せ | DQをwaiverで消さず、scopeやstrict=falseで資格を緩めない。既存統制回帰成功 |

CIへ登録する際は各表行の「個別」「各」を独立したsubcaseとして展開する。表の25行をテスト実行件数と呼ばない。期待結果を修正後の実際の出力から自動採用せず、表のoracleとの一致を確認する。

## 5. 検証工数の初期見積り

実装・自動化harnessが揃った後の、1回のレビュー/検証運用を見積もる。prep 30〜60分、実行・結果確認60〜120分、証拠整理30〜45分、再試行30〜60分、合計150〜285分。実装工数、producer自体の実行待ち、外部承認待ちは含めない。環境やproducer runtimeが未整備なら実測後に更新する。期間の保証値として扱わない。

## 6. Gateと完了報告

受入レビューのprofileはstandardを基準とするが、上記P1の資格条件は100%成功を必須とし、95%等の割合で免除しない。これはQEG runtimeのprofile設定を変更する指示ではない。

- `defined`：基準、oracle、ケース、適用範囲が記述されている。本書の現在状態。
- `implemented`：型/schema/adapter/evaluator/reportと変更説明が揃う。未実行ケースをpassにしない。
- `verified`：対応する必要ケース、既存回帰、公開API/CLI/packed consumer、該当するLinux Node 20/24・Windows Node 24のCIが同一実装revisionで成功。
- `accepted`：verifiedの証跡と残余リスクを照合し、受入単位を明記した記録がある。P1既知不具合が残る単位は受入no_go。

実行記録の必須欄は基準version、EAC/TC/subcase ID、source commit、artifact/manifest hash、policy ID/hash、評価対象・scope・T、producer version/run/build/revision、コマンド/環境、expected/actual/exit、採用・除外ID/理由、ログ/CI URL、判定者、残課題。該当しない欄はN/Aと理由を記載する。

Gateのruntime verdictと「この改修の受入判定」は別に記録する。負のfixtureで期待通りDQになったことはテストpassである。基準制定前のCI成功を本基準のverified/acceptedへ転用しない。

## 7. Go/No-Go brief

基準策定はdefined。通常実行の対象・時計・最新runの[実装契約](execution-qualification.md)を追加した。各受入単位の試験・CIと現在の判断は[受入状況](../project/evidence-acceptance-status.md)に記録する。出力復旧・実producer接続・consumer移行の追加受入は継続して別単位とする。
