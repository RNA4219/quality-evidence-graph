---
intent_id: INT-QEG-BIRDSEYE-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-06-02
next_review_due: 2026-07-02
---

# Birdseye

## Purpose

QEG の主要契約を最小文脈で読むための fallback map。
機械読みは `docs/birdseye/index.json` と `docs/birdseye/caps/*.json` を優先する。

## Nodes

| Node | Role |
|---|---|
| `README.md` | overview / bootstrap |
| `HUB.codex.md` | navigation |
| `BLUEPRINT.md` | product blueprint |
| `docs/requirements.md` | requirements source of truth |
| `RUNBOOK.md` | operations |
| `EVALUATION.md` | acceptance |
| `GUARDRAILS.md` | constraints |
| `TASK.codex.md` | implementation task ledger |
| `fixtures/README.md` | fixture contract |
| `docs/control-mapping.md` | control mapping |
| `docs/ipo-controlled-profile.md` | IPO controlled profile |
| `docs/implementation-prep-gate-2026-06-02.md` | implementation preparation gate record |
| `src/types.ts` | TypeScript contracts |
| `schemas/shared-defs.schema.json` | shared schema definitions |
| `schemas/gate-verdict.schema.json` | Gate verdict schema |
| `schemas/qeg.bundle.schema.json` | graph bundle schema |
| `schemas/test-placement-plan.schema.json` | placement schema |
| `schemas/quality-evidence-record.schema.json` | final record schema |

## Edges

- `README.md` -> `HUB.codex.md`
- `HUB.codex.md` -> `docs/birdseye/index.json`
- `HUB.codex.md` -> `BLUEPRINT.md`
- `HUB.codex.md` -> `docs/requirements.md`
- `HUB.codex.md` -> `TASK.codex.md`
- `HUB.codex.md` -> `fixtures/README.md`
- `HUB.codex.md` -> `docs/control-mapping.md`
- `HUB.codex.md` -> `docs/ipo-controlled-profile.md`
- `TASK.codex.md` -> `fixtures/README.md`
- `TASK.codex.md` -> `docs/control-mapping.md`
- `TASK.codex.md` -> `docs/ipo-controlled-profile.md`
- `docs/implementation-prep-gate-2026-06-02.md` -> `TASK.codex.md`
- `docs/requirements.md` -> `src/types.ts`
- `docs/requirements.md` -> `schemas/gate-verdict.schema.json`
- `src/types.ts` -> `schemas/shared-defs.schema.json`
- `schemas/shared-defs.schema.json` -> `schemas/gate-verdict.schema.json`
- `schemas/shared-defs.schema.json` -> `schemas/qeg.bundle.schema.json`
- `schemas/shared-defs.schema.json` -> `schemas/test-placement-plan.schema.json`
- `schemas/qeg.bundle.schema.json` -> `schemas/quality-evidence-record.schema.json`
- `schemas/test-placement-plan.schema.json` -> `schemas/quality-evidence-record.schema.json`
- `schemas/gate-verdict.schema.json` -> `schemas/quality-evidence-record.schema.json`
