# Quality Evidence Record

Gate: **go**

評価範囲: fixture / positive-placement-change-retirement
未評価: Upstream producer ingestion, Real deployment, Release approval

## 判定理由

- All gate conditions satisfied

## テスト配置

- qeg:obligation-login: manual-scripted / manual-only; tests: mbb:CASE-login-001

## 残存リスク・人間の確認


## 証跡

- qeg-native/test_model: artifacts/input.json (sha256:ee4e3d131531183991b409e2952fb46350ccc4e6fdd0c6fe8c746b7519a15a62)

実行証跡の採用
- 評価時計: 2026-07-02T00:00:00.000Z
- 対象: synthetic-eac / synthetic-build-1 / synthetic-ci / aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
- hate:AETE-login-001: run=synthetic-run-4; evidence=qeg:eac-execution-4; status=pass; reason=latest_qualified_execution; consecutivePasses=5
  - excluded=qeg:eac-execution-0; reason=superseded
  - excluded=qeg:eac-execution-1; reason=superseded
  - excluded=qeg:eac-execution-2; reason=superseded
  - excluded=qeg:eac-execution-3; reason=superseded
