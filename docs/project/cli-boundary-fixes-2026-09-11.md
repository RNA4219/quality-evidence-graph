---
intent_id: INT-QEG-CLI-BOUNDARY-FIXES-20260911
owner: quality-evidence-graph
status: implemented
last_reviewed_at: 2026-09-11
next_review_due: 2026-12-11
---

# R8〜R13 CLI境界の一括改修・受入

PR #11 merge 57d303b34a8cca0ea2ed0c7be52054f807996a8e の追加レビューで、CLI 33回の実行から6件を確認した。再現原本はworkspaceの artifacts/qeg-postmerge-review2-20260911/ に保存し、今回の証拠にhashで結び付ける。

| ID / 要求 | 再現した不具合 | 修正とoracle |
|---|---|---|
| R8 / C-15 | cwd自身・subdirectoryで変更1件でも対象0 / exit 0 | Git rootとcwdを絶対pathへ正規化。origin/main・親commit・worktree × root/子階層/target自身、明示相対/絶対pathを比較 |
| R9 / C-06 | 親指定で入力を失った子が消え、exit 0 | consumer固有の出力markerも収集し、欠落/不正入力をCLI errorへ。通常/差分と単独/親指定を比較 |
| R10 / C-14/17 | 期限切れ・ownerなし・不正日付をauditが拒否してもreportが許容 | schema/適用資格を共有。不適格baselineはBASELINE_INVALID / exit 1で診断を継続。warningのみの設定は互換維持 |
| R11 / C-14/17 | consumerの許容がother-consumerにも適用 | 正規化した完全pathで一致。別名suffix・同名別階層を拒否、相対/絶対指定は同じtargetへ適用 |
| R12 / C-18 | 未選択・不正JSONで古いDQをresolvedと表示 | unverifiedとnot_evaluated/evaluation_failedを追加。実際に修正した場合だけresolved。text/GitHub/Actionにも表示 |
| R13 / C-07/10/19/22 | tarball導入後のdoctor/enum/check/reproがcwd側src/schemaへ依存して失敗 | 同梱metadata/enum/schemaを配布位置から読む。consumer側同名fileと独立。初期化runtime、実際のenum破損も検証 |

共通harnessは[cli-boundary-matrix](../../tests/helpers/cli-boundary-matrix.mjs)。[runtime試験](../../tests/cli-boundary-regression.test.mjs)からsource CLIとAction bundleへ同じmatrixを適用し、[package smoke](../../tests/package-smoke.mjs)からtarball consumerへ適用する。initが作るruntimeの診断、enum両側欠落・drift拒否も含む。fixture期待値を現在の結果へ自動追従させない。

ローカル検証後、source CIを[validation.json](../evidence/cli-boundary-fixes-2026-09-11/validation.json)へ固定して受入を確定する。追加CI待ち。

初回CIのWindows runtimeでは、別名pathとevaluator/Gitの実体pathが一致しない3種類の失敗がCLI/Action各3ケースに現れた。junction経由で同じ失敗を再現し、最寄りの存在する祖先まで実体pathへ正規化する修正を追加した。共通matrixの変更選択・baseline・diffはjunction（Windows）/symlink（Linux）経由でも評価する。

wire0.2 / package0.4.0未公開、Gate evaluator・waiver・approval・retentionの判定規則と過去のproducer原本・受入JSONは維持する。baselineの無資格・suffix許容を拒否するため、従来誤って成功した設定は明示的に失敗する。全consumer markerを削除したfolderの自動推測、実producer再接続、本番環境や人手QAは今回の受入範囲に含めない。
