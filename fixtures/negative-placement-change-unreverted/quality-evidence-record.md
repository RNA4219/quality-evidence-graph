# Quality Evidence Record

Gate: **disqualified**

評価範囲: fixture / negative-placement-change-unreverted
未評価: Upstream producer ingestion, Real deployment, Release approval

## 判定理由

- Disqualified: 1 DQ code(s)
- - DQ-14: Placement change "qeg:placement-change-login-retirement" is a revert candidate: evidence strength or green-run threshold fell below policy

## テスト配置

- qeg:obligation-login: manual-scripted / manual-only; tests: mbb:CASE-login-001

## 残存リスク・人間の確認


## 証跡

- qeg-native/test_model: artifacts/input.json (sha256:9fa8e511107a0fb246464ed29e38903e0a08579566492cfc7d402c45830be937)

実行証跡の採用
- 評価時計: 2026-07-02T00:00:00.000Z
- 対象: synthetic-eac / synthetic-build-1 / synthetic-ci / aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
- hate:AETE-login-001: run=synthetic-run-0; evidence=qeg:eac-execution-0; status=pass; reason=latest_qualified_execution; consecutivePasses=1
