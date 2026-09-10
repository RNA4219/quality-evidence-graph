# Quality Evidence Record

Gate: **disqualified**

評価範囲: fixture / negative-placement-change-no-evidence
未評価: Upstream producer ingestion, Real deployment, Release approval

## 判定理由

- Disqualified: 1 DQ code(s)
- - DQ-14: Placement change "qeg:placement-change-login-retirement" retires manual case "mbb:CASE-login-001" without evidence_refs

## テスト配置

- qeg:obligation-login: manual-scripted / manual-only; tests: mbb:CASE-login-001

## 残存リスク・人間の確認


## 証跡

- qeg-native/test_model: artifacts/input.json (sha256:9e5631a95a6fc479fa53242b12031ae50857f554dc8ed624ec8a1975cd9d67d7)

実行証跡の採用
- 評価時計: 2026-07-02T00:00:00.000Z
- 対象: synthetic-eac / synthetic-build-1 / synthetic-ci / aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
- hate:AETE-login-001: run=synthetic-run-4; evidence=qeg:eac-execution-4; status=pass; reason=latest_qualified_execution; consecutivePasses=5
  - excluded=qeg:eac-execution-0; reason=superseded
  - excluded=qeg:eac-execution-1; reason=superseded
  - excluded=qeg:eac-execution-2; reason=superseded
  - excluded=qeg:eac-execution-3; reason=superseded
