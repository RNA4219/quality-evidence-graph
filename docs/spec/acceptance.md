---
intent_id: INT-QEG-SPEC-ACCEPTANCE-001
owner: quality-evidence-graph
status: active
profile: ipo_controlled
last_reviewed_at: 2026-06-03
next_review_due: 2026-07-03
---

# 仕様書検収

この文書は `docs/spec/` の検収条件を固定する。

## 1. 検収観点

| ID | 観点 | 期待結果 |
|---|---|---|
| SPEC-01 | 正本関係 | `docs/requirements.md` を要求正本、`docs/spec/` を実装仕様正本として扱っている。 |
| SPEC-02 | Gate policy | `GatePolicy`、DQ scope、exit code、verdict 優先順位が固定されている。 |
| SPEC-03 | Waiver / approval | waiver、approval evidence、ControlRoles、human review の必須項目が固定されている。 |
| SPEC-04 | Evidence package | 必須 input、QEG output、manual evidence、policy、waiver、approval evidence、hash が固定されている。 |
| SPEC-05 | Retention / immutability | storage classification、tamper evidence、silent overwrite 判定が固定されている。 |
| SPEC-06 | No-Go 分離 | 仕様書作成完了後も IPO controlled release は実装と fixture が揃うまで `no_go` である。 |
| SPEC-07 | Review record | 仕様書見直し結果、修正方針、残リスクが `docs/spec/review-2026-06-03.md` に記録されている。 |
| SPEC-08 | Gate acceptance | 実装前 Gate の Go/No-Go 判定が `docs/spec/gate-acceptance-2026-06-03.md` に記録されている。 |

## 2. 手動確認ケース

| Case | 手順 | 期待結果 |
|---|---|---|
| TC-SPEC-01 | `docs/spec/index.md` から全仕様書を読む。 | 読み順、正本関係、MVP / IPO 境界が明確である。 |
| TC-SPEC-02 | `docs/spec/gate-policy.md` を確認する。 | DQ が `disqualified` 最優先で、`conditional_go` exit code が `2` である。 |
| TC-SPEC-03 | `docs/spec/waiver-approval.md` を確認する。 | waiver で DQ を消せず、approval evidence は QEG verdict と分離されている。 |
| TC-SPEC-04 | `docs/spec/evidence-package.md` と `docs/spec/retention-immutability.md` を確認する。 | evidence package と保管要件が release 判定に使える粒度で固定されている。 |
| TC-SPEC-05 | `HUB.codex.md`、`RUNBOOK.md`、`EVALUATION.md` を確認する。 | 仕様書群の読み順、検証コマンド、acceptance criteria が接続されている。 |
| TC-SPEC-06 | `docs/spec/review-2026-06-03.md` を確認する。 | 仕様書 review Gate、実装着手 Gate、IPO release Gate が分離されている。 |
| TC-SPEC-07 | `docs/spec/gate-acceptance-2026-06-03.md` を確認する。 | 仕様内容 Gate、正式な実装前 Gate、実装着手 Gate、IPO release Gate が分離されている。 |

## 3. コマンド確認

```sh
npm run typecheck
node -e "const fs=require('fs'); for (const f of fs.readdirSync('schemas').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('schemas/'+f,'utf8')); console.log('schemas ok')"
npm pack --dry-run --cache ./.npm-cache
git ls-files docs/spec/index.md docs/spec/gate-policy.md docs/spec/waiver-approval.md docs/spec/evidence-package.md docs/spec/retention-immutability.md docs/spec/acceptance.md docs/spec/review-2026-06-03.md docs/spec/gate-acceptance-2026-06-03.md
```

期待結果:

- typecheck が成功する。
- schema JSON parse が成功する。
- package dry-run が成功し、`docs/spec/` が tarball contents に含まれる。
- `docs/spec/*.md` が Git tracked である。

## 4. Gate 判定

- 仕様書作成 Gate: `go`
- 実装着手 Gate: `go`
- IPO controlled release Gate: `no_go`

理由:

- TASK-09 / TASK-10 の実装判断に必要な policy、waiver、approval evidence、retention、immutability、evidence package の contract が仕様書で固定された。
- ただし、TypeScript 型、JSON Schema、CLI、fixture 実体、own-output validation は未実装である。
- 実装と実証が揃うまで、IPO controlled release を `go` にしてはならない。
