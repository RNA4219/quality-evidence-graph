# Quality Evidence Graph

Quality Evidence Graph, or QEG, is a local-first quality gate foundation that turns quality decisions into traceable evidence instead of informal confidence.

It connects requirements, risks, code changes, test placement, execution evidence, waivers, approval evidence, and release decisions into a single graph-backed record.

## What Problem It Solves

Traditional QA often leaves important gaps:

- Test results exist, but their requirement and risk coverage is unclear.
- Risks are discussed, but their impact on the release decision is hard to audit.
- Waivers and human approvals are not preserved as structured evidence.
- Final gate reasons are not source-backed.

QEG turns those gaps into explicit graph nodes, disqualification rules, gate verdicts, and evidence packages.

## Core Concepts

QEG is built around four outputs:

- **Quality Evidence Graph**: a graph connecting requirements, risks, changes, tests, evidence, and decisions.
- **Test Placement Plan**: a risk-aware plan for where each test obligation should be handled.
- **Gate Verdict**: one of `go`, `conditional_go`, `no_go`, or `disqualified`.
- **Quality Evidence Record**: a record bundle for release judgment and audit.

`disqualified` has the highest priority. If any DQ exists, a waiver cannot remove it.

## IPO Controlled Profile

QEG includes an `ipo_controlled` profile for IPO-grade quality governance.

This profile requires:

- Gate policy integrity through `policyHash`.
- Source-backed waivers with expiry, impact scope, rollback or containment, and follow-up owner.
- Approval evidence separated from the QEG verdict.
- Recorded control roles: producer, reviewer, approver, waiver approver, and release owner.
- Evidence packages with retention, tamper evidence, and storage classification.
- Rejection of release evidence stored only in silent-overwrite-capable locations.

QEG is not just a test management tool. It is a control layer for quality decisions.

## CLI Usage

Build first:

```sh
npm run build
```

Validate a fixture:

```sh
npm run validate -- fixtures/positive-release-go
```

Print a gate verdict as JSON:

```sh
npm run gate -- fixtures/positive-release-go
```

Generate a Quality Evidence Record:

```sh
npm run record -- fixtures/positive-release-go
```

## Reading Verdicts

- `go`: release conditions are satisfied. Exit code `0`.
- `conditional_go`: conditional approval is required. In `ipo_controlled`, this is not CI success. Exit code `2`.
- `no_go`: blockers remain. Exit code `2`.
- `disqualified`: the gate is not qualified to decide because one or more DQs exist. Exit code `2`.

`conditional_go` does not mean the release passed. It means human review or approval is required.

## For Developers And Agents

Use the root [README.md](README.md) and [HUB.codex.md](HUB.codex.md) as the implementation entry point.

Key sources of truth:

- Requirements source: `docs/requirements.md`
- IPO control specs: `docs/spec/`
- Implementation gate record: `docs/spec/implementation-gate-2026-06-03.md`
- Fixture contract: `fixtures/README.md`

## Current Status

- DQ-01 through DQ-17 are implemented.
- 21 fixtures preserve regression coverage.
- `code-to-gate` findings are kept at 0.
- `positive-release-go` returns `go / exit 0`.
- Negative fixtures generally return `disqualified / exit 2`.

QEG makes quality accountable by turning release judgment into evidence, policy, and executable gate contracts.
