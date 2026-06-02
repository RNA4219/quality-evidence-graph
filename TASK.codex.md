---
intent_id: INT-QEG-TASK-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-06-02
next_review_due: 2026-07-02
---

# Implementation Task Ledger

この台帳は `docs/requirements.md` の TASK-01〜TASK-10 を、実装者が追加判断なしで着手できる粒度に固定する。

## Objective

QEG MVP を `adapter -> graph -> placement -> gate -> record` の順に実装し、`ipo_controlled` hardening へ進めるための契約、fixture、検証境界を確定する。

## Scope

In:

- 必須 3 adapter の入力型、normalizer、contract fixture
- schema validation CLI、own-output validation
- deterministic graph builder、placement skeleton、Gate evaluator
- Quality Evidence Record と Markdown summary
- IPO control mapping、profile、waiver / approval / retention の最小契約

Out:

- upstream tool の実行 orchestration
- Playwright / Jest / pytest などテスト実行フレームワーク本体
- 外部 SaaS 本番設定
- 組織固有承認フローの正本化
- IPO controlled release Go 判定

## Requirements Trace

- `docs/requirements.md` 5〜7: 必須 3 接続先と adapter 境界
- `docs/requirements.md` 8〜13: canonical graph、placement、Gate、DQ、CLI
- `docs/requirements.md` 14〜16: governance、security、schema hardening
- `docs/requirements.md` 18〜20: MVP 受入条件と TASK-01〜TASK-10
- `fixtures/README.md`: fixture set と expected verdict / DQ
- `docs/control-mapping.md`: 統制対応表
- `docs/ipo-controlled-profile.md`: IPO profile の最小実装契約

## Task Order

| Order | Task | Purpose | Implementation Target | Acceptance |
|---:|---|---|---|---|
| 1 | TASK-01 adapter input interfaces | 必須 3 接続先の artifact を型で受ける | `src/types.ts` に RanD / code-to-gate / manual-bb input interfaces を追加 | 必須 artifact と optional artifact が `ArtifactKind` と矛盾しない |
| 2 | TASK-02 schema validation CLI | MVP 4 schema と入力 fixture を検証する | `src/cli.ts` または `src/validation.ts`、`package.json` scripts | invalid JSON / schema invalid を DQ-01 候補として報告できる |
| 3 | TASK-03 minimal fixture | happy path の contract を固定する | `fixtures/minimal-valid/` | 3 接続先の必須 artifact が揃い、expected verdict が `go` または `conditional_go` と明記される |
| 4 | TASK-08 negative fixture | 失格条件の回帰テストを固定する | `fixtures/negative-*` | 欠落、sourceRefs 空、revision 不一致、manual oracle 欠落、optional invalid を検収できる |
| 5 | TASK-04 graph builder | deterministic node / edge を生成する | `src/graph.ts` | 同一 input / policy / revision で同一 stable ID を返す |
| 6 | TASK-05 placement skeleton | risk obligation と candidate score を作る | `src/placement.ts` | blocking risk に placement または accepted waiver が必要になる |
| 7 | TASK-06 Gate evaluator | DQ / blocker / residual risk を分離する | `src/gate.ts` | DQ-01 / DQ-02 / DQ-03 / DQ-05 / DQ-12 / DQ-13 / DQ-14 を評価できる |
| 8 | TASK-07 Quality Evidence Record | 4 JSON artifact と Markdown summary を束ねる | `src/record.ts` | own-output validation が成功し、record に input hash / policy hash を残せる |
| 9 | TASK-09 control mapping | IPO 統制への説明線を固定する | `docs/control-mapping.md` と必要な schema/type | 変更管理、品質判定、例外承認、証跡保全、リリース承認へ trace できる |
| 10 | TASK-10 ipo_controlled profile | IPO profile の実装契約を固定する | `docs/ipo-controlled-profile.md` と Gate policy fixture | `conditional_go` exit code、waiver 必須項目、approval evidence、retention 方針が検証可能 |

## Commands

```sh
npm run typecheck
node -e "const fs=require('fs'); for (const f of fs.readdirSync('schemas').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('schemas/'+f,'utf8')); console.log('schemas ok')"
npm pack --dry-run --cache ./.npm-cache
git status --short
git ls-files docs/requirements.md TASK.codex.md fixtures/README.md docs/control-mapping.md docs/ipo-controlled-profile.md
```

## Acceptance

- [x] TASK-01〜TASK-10 の順序、対象、完了条件が固定されている
- [x] fixture の expected verdict / DQ は `fixtures/README.md` に固定されている
- [x] IPO control hardening の最小 artifact は `docs/control-mapping.md` と `docs/ipo-controlled-profile.md` に固定されている
- [ ] TASK-01〜TASK-08 のコード実装が完了している
- [ ] IPO controlled release Gate が Go になっている

## Current Gate Split

- Implementation preparation: `go`
- IPO controlled release: `no_go`

実装準備 Go は、実装タスクと契約の判断余地が閉じていることを意味する。adapter / graph / placement / gate evaluator / record CLI の完成は、次の MVP release Gate で判定する。
