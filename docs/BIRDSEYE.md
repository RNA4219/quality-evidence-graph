---
intent_id: INT-QEG-BIRDSEYE-001
owner: quality-evidence-graph
status: active
last_reviewed_at: 2026-07-04
next_review_due: 2026-08-04
---

# Birdseye

## Purpose

QEG の主要契約を最小文脈で読むための fallback map。
機械読みは `docs/birdseye/index.json` と `docs/birdseye/caps/*.json` を優先する。

## Nodes

| Node | Role |
|---|---|
| `README.md` | overview / bootstrap |
| `docs/agent/HUB.codex.md` | navigation |
| `docs/project/blueprint.md` | product blueprint |
| `docs/requirements.md` | requirements source of truth |
| `docs/project/runbook.md` | operations |
| `docs/project/evaluation.md` | acceptance |
| `docs/project/guardrails.md` | constraints |
| `docs/project/tasks.codex.md` | implementation task ledger |
| `docs/spec/operational-cli-extensions.md` | CI / OSS operational CLI contract |
| `fixtures/README.md` | fixture contract |
| `docs/control-mapping.md` | control mapping |
| `docs/ipo-controlled-profile.md` | IPO controlled profile |
| `docs/implementation-prep-gate-2026-06-02.md` | implementation preparation gate record |
| `src/types.ts` | TypeScript contracts |
| `src/cli/report.ts` | cumulative CI report CLI |
| `src/cli/doctor.ts` | environment / target diagnostics CLI |
| `src/cli/dq-explain.ts` | DQ remediation explanations |
| `src/cli/schema-check.ts` | JSON Schema compile / fixture validation CLI |
| `src/cli/enum-check.ts` | TypeScript / JSON Schema enum drift check |
| `src/cli/init.ts` | OSS starter scaffolding CLI |
| `src/cli/snapshot.ts` | report golden snapshot CLI |
| `src/cli/baseline.ts` | baseline audit CLI |
| `src/cli/evidence-verify.ts` | evidence artifact preflight CLI |
| `src/cli/policy-lint.ts` | GatePolicy lint CLI |
| `src/cli/repro-bundle.ts` | CI reproduction bundle CLI |
| `src/cli/check.ts` | local aggregate check CLI |
| `qeg-report-action/action.yml` | GitHub Action wrapper for cumulative report |
| `schemas/shared-defs.schema.json` | shared schema definitions |
| `schemas/gate-verdict.schema.json` | Gate verdict schema |
| `schemas/qeg.bundle.schema.json` | graph bundle schema |
| `schemas/test-placement-plan.schema.json` | placement schema |
| `schemas/quality-evidence-record.schema.json` | final record schema |

## Edges

- `README.md` -> `docs/agent/HUB.codex.md`
- `docs/agent/HUB.codex.md` -> `docs/birdseye/index.json`
- `docs/agent/HUB.codex.md` -> `docs/project/blueprint.md`
- `docs/agent/HUB.codex.md` -> `docs/requirements.md`
- `docs/agent/HUB.codex.md` -> `docs/project/tasks.codex.md`
- `docs/agent/HUB.codex.md` -> `fixtures/README.md`
- `docs/agent/HUB.codex.md` -> `docs/spec/operational-cli-extensions.md`
- `docs/agent/HUB.codex.md` -> `docs/control-mapping.md`
- `docs/agent/HUB.codex.md` -> `docs/ipo-controlled-profile.md`
- `docs/project/tasks.codex.md` -> `fixtures/README.md`
- `docs/project/tasks.codex.md` -> `docs/control-mapping.md`
- `docs/project/tasks.codex.md` -> `docs/ipo-controlled-profile.md`
- `docs/implementation-prep-gate-2026-06-02.md` -> `docs/project/tasks.codex.md`
- `docs/requirements.md` -> `src/types.ts`
- `docs/requirements.md` -> `src/cli/report.ts`
- `docs/requirements.md` -> `src/cli/baseline.ts`
- `docs/requirements.md` -> `src/cli/evidence-verify.ts`
- `docs/requirements.md` -> `src/cli/policy-lint.ts`
- `docs/requirements.md` -> `src/cli/repro-bundle.ts`
- `docs/requirements.md` -> `src/cli/check.ts`
- `docs/requirements.md` -> `qeg-report-action/action.yml`
- `docs/requirements.md` -> `docs/spec/operational-cli-extensions.md`
- `docs/requirements.md` -> `schemas/gate-verdict.schema.json`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/report.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/doctor.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/dq-explain.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/schema-check.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/enum-check.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/init.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/snapshot.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/baseline.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/evidence-verify.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/policy-lint.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/repro-bundle.ts`
- `docs/spec/operational-cli-extensions.md` -> `src/cli/check.ts`
- `docs/spec/operational-cli-extensions.md` -> `qeg-report-action/action.yml`
- `src/cli.ts` -> `src/cli/baseline.ts`
- `src/cli.ts` -> `src/cli/evidence-verify.ts`
- `src/cli.ts` -> `src/cli/policy-lint.ts`
- `src/cli.ts` -> `src/cli/repro-bundle.ts`
- `src/cli.ts` -> `src/cli/check.ts`
- `src/cli/check.ts` -> `src/cli/schema-check.ts`
- `src/cli/check.ts` -> `src/cli/enum-check.ts`
- `src/cli/check.ts` -> `src/cli/snapshot.ts`
- `src/cli/check.ts` -> `src/cli/doctor.ts`
- `src/cli/check.ts` -> `src/cli/report.ts`
- `.github/workflows/ci.yml` -> `qeg-report-action/action.yml`
- `src/types.ts` -> `schemas/shared-defs.schema.json`
- `schemas/shared-defs.schema.json` -> `schemas/gate-verdict.schema.json`
- `schemas/shared-defs.schema.json` -> `schemas/qeg.bundle.schema.json`
- `schemas/shared-defs.schema.json` -> `schemas/test-placement-plan.schema.json`
- `schemas/qeg.bundle.schema.json` -> `schemas/quality-evidence-record.schema.json`
- `schemas/test-placement-plan.schema.json` -> `schemas/quality-evidence-record.schema.json`
- `schemas/gate-verdict.schema.json` -> `schemas/quality-evidence-record.schema.json`
