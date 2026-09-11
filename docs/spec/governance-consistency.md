---
intent_id: INT-QEG-GOVERNANCE-CONSISTENCY-20260911
owner: quality-evidence-graph
status: implemented
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# 配置実体・引退・時刻・統制の整合契約

R20〜R24に対応するT-02/09/10/12、S-03、REL-09、CRTL-03、DQ-16/17の具体規則。package 0.4.0未公開 / wire 0.2と既存DQ番号を維持する。[改修台帳](../project/governance-fixes-2026-09-11.md)で受入状態を管理する。

## 配置とtest実体

graph内とplan内の全placementについて、selectedTestIdsの各test.layerはprimaryLayerと一致しなければDQ-03。manual testをunitと記録してもoracleや人手レビューを省略したgoにはならない。plannerが生成する同一layerの選択、同内容のgraph/plan複製、正常な引退履歴は維持する。手動oracleの適格性は[既存契約](gate-contract-consistency.md)に従う。

## 手動testの引退

manual→automatedの記録ではsubject_idがfrom_layerと一致するmanual testに解決し、policy_refが評価policyIdと一致する。replacementは1件以上で、各testがunit/integration/system/e2eのいずれかに属し、subject→replacement方向のreplaced_by edgeで結ばれる。参照矛盾、自動layerの不足、edgeの欠落・逆向きはDQ-14となる。既存の実行資格、強度、連続成功回数、risk coverageも必要。

replacementの削除・劣化や自動coverage不足に対して手動caseがcurrent inventoryへ復帰している場合、従来どおりその手動caseを評価する。手動oracleを満たさない復帰や存在しないsubjectを、復帰フラグだけで有効化しない。

## 日時とwaiver

QEG schemaのdate-timeは実在する暦日、明示timezone（Zまたは±HH:MM）、小数秒省略または1〜9桁を必要とする。実行証跡で使う検証を共通化し、2026-02-30、timezone欠落、24時、10桁以上の小数秒を受理しない。秒60は既存の実行時刻契約同様に対象外とする。日付やtimezoneを自動補正せずproducer原本を保持する。

評価時計はmetadata.createdAtだけを使い、waiver.expiryとUTC基準の整数nanosecondで比較する。expiryが厳密に後である場合のみ期限内。同時刻は期限切れで、1ns後は期限内。TZ環境変数や実行マシンの時計で変わらない。内部gate facadeのvalidateWaiverは既存のDate引数も保持し、string引数で小数秒精度を維持する。不正Dateは無効として返す。

CLIの不正日時schemaはDQ-01 / exit 2。公開evaluateGateへ直接渡された不正waiverは無効となりriskのDQを免除しない。不正metadata.createdAtは公開APIでもDQ-01。正常なwaiverがあっても最大conditional_go / exit 2である。

## IPOの役割と証拠保管

controlRolesのproducer/reviewer/approver/waiverApprover/releaseOwnerは全て非空白の担当者を必要とする。schemaと公開APIで確認する。空白だけの値はCLIではDQ-01、公開APIではDQ-17。前後空白を含む有効な名前は受理し、役割の兼務可否は本変更では新設しない。

evidencePackage.retention.storageClassificationがunknownの場合はmutableと同様にDQ-16。profileでこの条件を緩和しない。保管方式と根拠を確認した新しい入力で再評価するまでgoにしない。immutable/append_only/versionedの既存条件は維持し、approvalのpolicy/package hash bindingや人間の承認記録を書き換えない。

既存の過去証拠とfixture期待値は変更しない。新しい入力条件の不備を合格扱いへ変更するためのsnapshot一括更新は行わない。
