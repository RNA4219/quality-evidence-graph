---
intent_id: INT-QEG-GATE-CONTRACT-CONSISTENCY-20260911
owner: quality-evidence-graph
status: implemented
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# 配置・判定・正規化の整合契約

R14〜R19の不具合に対するEAC-04/06/07/11、T-09、V-08、snapshot契約の具体化。package 0.4.0未公開 / wire 0.2と既存DQ番号を維持する。受入状況は[改修台帳](../project/gate-contract-fixes-2026-09-11.md)を参照する。

## 配置と明示coverage

Gateは選択testの明示coverageとobligationを照合する。riskを持つobligationはcoveredRiskIdsで検証し、そのriskに関連付けられたchangedCodeのcoverageを重複要求しない。riskを持たないobligationはcoveredChangedCodeIdsで検証する。複数testの集合で必要IDを満たしてよいが、明示coverageが対象と無関係なtest、明示した空集合、不完全な集合はDQ-05となる。実コードの計測coverageを推定する機能ではない。

native_graphの旧testで両coverage fieldが全て省略されている場合は既存の明示placement契約を維持する。1件でもcoverageを宣言した場合、省略されたtestを不足IDの補完根拠にしない。upstream_artifactsは明示coverageが必要。実行必須条件・raw/対象確認は独立して適用する。

## 手動oracle

graphとplacementPlanの配置を双方評価し、同一内容の複製を除く。IDによる上書きで矛盾を消さず、graph/plan不一致はDQ-03を維持する。manual-scriptedの選択testにはoracleRefsとexpectedResultsを必要とする。

- specified / derived: 手動oracleとして適格。
- human: 選択test IDをrequiredHumanReviewへ必ず記録する。現行wireにはtest単位のreview完了契約がないため、任意のreviewer文字列で解除しない。追加DQ/blockerがなければconditional_go / exit 2。
- implicit / missing / 未指定: 単独では手動oracleの根拠とならずDQ-14。candidateのlabelや無関係なmanualEvidenceで代替しない。

plannerとGateは同じoracle適格性を使う。deletedで、manual→automatedの引退記録があり、current inventoryに復帰していないtestは履歴として扱い、現行手動oracleを要求しない。引退記録の証跡・replacement・強度・連続成功・coverage不足は従来のDQ-14で検証し続ける。

## 正規化ステータス

rawのstatus aliasは全て検証してから統合する。未指定のみcontextへのfallbackを認め、unknown、空文字、null、object、配列などを未指定へ変換しない。大文字小文字の違い、既存のpass/success/passed、fail/failure/failed、cancelled/canceled/aborted、error/timeout/skipped、booleanは維持する。alias同士・raw lifecycle・contextが矛盾すればexit 1で出力を作らない。エラーにはraw値を表示しない。

shell exitCodeは安全な整数に限定する。0はpass、非0はnonpassと照合し、詳細statusがあればfail/timeout等を保持する。statusが欠落した場合のみ0→pass、非0→failへ変換する。schemaとadapter versionの既存条件は維持する。

## Waiver・IPO

approverは空白以外の文字を必要とする。schemaで拒否したCLIはDQ-01 / exit 2、公開APIのwaiver資格判定でも無効とし、対象riskのDQを免除しない。正当なwaiverの残存risk・human review、承認権限・期限・rollback・follow-up要件は維持する。

ipo_controlledでもhuman oracleとwaiverをgoへ変換しない。approval evidenceのhash/policy/package bindingとretention規則は変更しない。過去の受入JSONとproducer原本は保存する。

## Snapshotの互換性

新規作成と明示`qeg snapshot --update <target>`はsnapshotVersion=`qeg-report-snapshot-v1`のenvelopeを保存する。report.generatedAtを`<snapshot>`、report.targets[].targetを`<target>`に限定して正規化する。対象は実体pathへ解決し、cwdやjunction/symlinkの呼び方に左右されない。sourceRefsや自由文内のbackslash・pathを一律置換しない。

従来のreport単体形式は、保存済みtargetを旧anchorとして互換比較し、自動更新しない。旧形式のslash正規化は旧形式に限る。対象外の絶対pathなど旧cwdへ依存する自由文を含むsnapshotは一致しない場合がある。その場合は実際のreport差分を確認し、対象を指定して`--update`で新形式へ移行する。内容変更によるmismatchを確認せず一括更新しない。未知version・不正JSONはmismatchとなる。
