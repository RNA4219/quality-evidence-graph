# Schemas

MVP artifact contract:

- `qeg.bundle.schema.json`: canonical graph nodes, edges, and completeness
- `test-placement-plan.schema.json`: risk/test obligations and selected layers
- `gate-verdict.schema.json`: `go / conditional_go / no_go / disqualified`
- `quality-evidence-record.schema.json`: reproducible final record
- `shared-defs.schema.json`: shared metadata, traceability, and source refs

The TypeScript source of truth for the first implementation pass is `src/types.ts`.
These schemas intentionally stay permissive on node-specific fields until adapters
are wired to real upstream artifacts.
