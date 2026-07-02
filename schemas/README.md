# Schemas

MVP artifact contract:

- `qeg.bundle.schema.json`: canonical graph nodes, edges, and completeness
- `test-placement-plan.schema.json`: risk/test obligations and selected layers
- `gate-verdict.schema.json`: `go / conditional_go / no_go / disqualified`
- `quality-evidence-record.schema.json`: reproducible final record
- `shared-defs.schema.json`: shared metadata, traceability, and source refs
- `gate-policy.schema.json`: QEG-owned Gate policy and proposal-only external policy candidates

Stable IDs now use `<producer>:<local-id>` as the standard form. The reserved
producer prefixes are `rand`, `ctg`, `mbb`, `hate`, and `qeg`. Prefixless IDs
remain schema-compatible during the deprecation window; ingest validation warns
for them and rejects unknown prefixes.

The TypeScript source of truth for the first implementation pass is `src/types.ts`.
These schemas intentionally stay permissive on node-specific fields until adapters
are wired to real upstream artifacts.
