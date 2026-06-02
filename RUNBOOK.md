---
intent_id: INT-QEG-RUNBOOK-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-06-02
next_review_due: 2026-07-02
---

# Runbook

## Environments

- Local: Node.js 20 以上
- CI: `npm run typecheck` と JSON schema parse を必須確認にする
- Release dry-run: `npm pack --dry-run --cache ./.npm-cache`

## Execute

### 1. 準備

```sh
npm install
```

依存が既にある場合は省略できる。

### 2. 型検証

```sh
npm run typecheck
```

期待結果:

- TypeScript contract が compile できる
- `src/types.ts` と schema enum の不整合がない

### 3. JSON schema parse

```sh
node -e "const fs=require('fs'); for (const f of fs.readdirSync('schemas').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('schemas/'+f,'utf8')); console.log('schemas ok')"
```

期待結果:

- `schemas/*.json` が JSON として parse できる

### 4. Release dry-run

```sh
npm pack --dry-run --cache ./.npm-cache
```

期待結果:

- `docs/requirements.md` が tarball contents に含まれる
- `schemas/` が tarball contents に含まれる
- `README.md`、`BLUEPRINT.md`、`RUNBOOK.md`、`EVALUATION.md`、`GUARDRAILS.md`、`HUB.codex.md` が配布対象に含まれる
- `TASK.codex.md`、`fixtures/README.md`、`docs/control-mapping.md`、`docs/ipo-controlled-profile.md`、`docs/implementation-prep-gate-2026-06-02.md` が配布対象に含まれる

## Confirm

- `docs/requirements.md` が Git 管理対象である
- `GateProfile` と schema の `gateProfile` enum が一致する
- `DisqualificationCode` と `gate-verdict.schema.json` の DQ enum が一致する
- `ipo_controlled` profile の要件が `docs/requirements.md`、`README.md`、`BLUEPRINT.md` に同期されている
- Birdseye index と capsule が変更対象を指している
- `TASK.codex.md` が TASK-01〜TASK-10 の実装順、対象、受入条件を固定している
- `fixtures/README.md` が expected verdict / DQ を固定している
- `docs/control-mapping.md` と `docs/ipo-controlled-profile.md` が IPO 統制実装準備を固定している

## Rollback / Retry

### ロールバック判断

- schema parse が失敗した
- TypeScript typecheck が失敗した
- `docs/requirements.md` が package から落ちた
- `conditional_go` / `ipo_controlled` / DQ enum の契約が requirements / types / schema で不一致

### 復旧手順

1. 直近変更ファイルを確認する。
2. `docs/birdseye/index.json` から関連 capsule を読む。
3. requirements / types / schema / README / BLUEPRINT のどれが正本と矛盾したかを特定する。
4. 最小差分で修正する。
5. Execute の 2〜4 を再実行する。

## Observability

- release 判定に使った command、input hash、policy hash、artifact revision、actor、timestamp を `quality-evidence-record.json` または external control evidence に残す。
- IPO controlled profile では silent overwrite 可能な evidence だけを release 判定に使わない。
