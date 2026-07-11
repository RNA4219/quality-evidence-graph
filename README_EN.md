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

## Controlled Governance Profile

QEG includes a controlled governance profile for audit-grade quality decisions.

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

In CI, generate a cumulative report instead of stopping at the first missing evidence item:

```sh
npm run report -- fixtures
npm run report -- --json --out .qeg/qeg-ci-report.json fixtures
npm run report -- --json --github-summary --out .qeg/qeg-ci-report.json fixtures
```

`report` evaluates every target it can reach and summarizes missing `gate-input.json`, ingest errors, DQs, blockers, residual risks, and human-review requirements. Its exit code is `1` when CLI errors exist, `2` when gate failures exist, and `0` when every target is `go`.

Operational helpers:

```sh
npm run explain -- DQ-15
npm run doctor -- fixtures/positive-release-go
npm run schema-check
npm run enum-check
npm run check -- fixtures/positive-release-go
npm run baseline -- audit .qeg/qeg-baseline.json fixtures
npm run evidence -- verify fixtures/positive-release-go
npm run policy -- lint fixtures/positive-release-go
npm run repro-bundle -- --report .qeg/qeg-ci-report.json --out .qeg/repro fixtures/positive-release-go
npm run snapshot -- fixtures/positive-release-go
npm run init -- --root ../your-repo
```

Use `--baseline <path>` to accept known DQs as `baseline_accepted` during migration so only new DQs fail the run. `baseline audit` detects missing owners, expired entries, resolved DQs, and missing targets. Use `--changed-only` to evaluate only targets related to `QEG_CHANGED_FILES` or git diff output. Use `--diff <previous-report.json>` to classify DQs as `new`, `resolved`, or `unchanged`.

In GitHub Actions, `.github/workflows/ci.yml` runs this report through `qeg-report-action` and uploads `.qeg/qeg-ci-report.json` as the `qeg-ci-report` artifact. Install, typecheck, build, JSON parse, package dry-run, and QEG report are allowed to finish before the final verdict step fails the job.
The external Action installs and builds its checked-out GitHub source by default, so it does not require a published QEG npm package.

The Action exposes `exit_code`, `gate_failed`, `cli_errors`, `dq_count`, `report_path`, and `summary_markdown_path` outputs for caller-side branching.

Minimal use from another repository:

```yaml
- uses: RNA4219/quality-evidence-graph/qeg-report-action@v0.2.0
  id: qeg_report
  with:
    targets: .qeg
    output-path: .qeg/qeg-ci-report.json
    github-summary: "true"
```

For a demo, manually run the `CI` workflow with `qeg_report_targets=fixtures/negative-approval-missing`. The job becomes red, but the Step Summary and `qeg-ci-report` artifact keep the cumulative missing-evidence report.

## Reading Verdicts

- `go`: release conditions are satisfied. Exit code `0`.
- `conditional_go`: conditional approval is required. In controlled governance mode, this is not CI success. Exit code `2`.
- `no_go`: blockers remain. Exit code `2`.
- `disqualified`: the gate is not qualified to decide because one or more DQs exist. Exit code `2`.

`conditional_go` does not mean the release passed. It means human review or approval is required.

## For Developers And Agents

Use the root [README.md](README.md) and [docs/agent/HUB.codex.md](docs/agent/HUB.codex.md) as the implementation entry point.

Key sources of truth:

- Requirements source: `docs/requirements.md`
- Governance control specs: `docs/spec/`
- Implementation gate record: `docs/spec/implementation-gate-2026-06-03.md`
- Fixture contract: `fixtures/README.md`

## Current Status

- DQ-01 through DQ-17 are implemented.
- Fixture regression uses fixtures/manifest.json as its source of truth.
- The Test Placement Plan can record manual-to-automated retirement through `placement_changes[]`, including replacement evidence, policy, and revert conditions.
- `code-to-gate` findings are kept at 0.
- `positive-release-go` returns `go / exit 0`.
- Negative fixtures generally return `disqualified / exit 2`.

QEG makes quality accountable by turning release judgment into evidence, policy, and executable gate contracts.

## 0.2.0 contract

All CLI commands share runtime schema/evidence preflight. Broken JSON or a missing decision envelope is a CLI error (exit 1); a parseable invalid required component is DQ-01 (exit 2). Required evidence is verified against real files, SHA-256, and revision; optional-only failures are warnings.

changed-only returns no_relevant_changes/exit 0 only after successful detection. Detection failure is detection_failed/exit 1. QEG_CHANGED_FILES is authoritative. fixtures/manifest.json is the fixture source of truth.

The v0.2.0 external Action enforces after artifact upload by default. Set enforce: "false" only for diagnostic collection and consume its exit_code output.

Enforced example:

    - uses: RNA4219/quality-evidence-graph/qeg-report-action@v0.2.0
      with:
        targets: .qeg

Diagnostic-only example:

    - uses: RNA4219/quality-evidence-graph/qeg-report-action@v0.2.0
      id: qeg_report
      with:
        targets: .qeg
        enforce: "false"
