# code-to-gate Analysis Report

**Generated**: 2026-07-20T11:58:07.312Z
**Run ID**: ctg-202607201158-local
Repository: .
**Tool**: code-to-gate v1.5.0

---

## Summary

### Raw Findings (All Detections)

| Metric | Count |
|--------|-------|
| Total Raw Findings | 13 |
| Critical | 0 |
| High | 1 |
| Medium | 12 |
| Low | 0 |

### Effective Findings (After Suppression)

| Metric | Count |
|--------|-------|
| Effective Findings | 12 |
| Critical | 0 |
| High | 0 |
| Medium | 12 |
| Low | 0 |

### Accepted Exceptions (Suppressed)

| Metric | Count |
|--------|-------|
| Suppressed Findings | 1 |
| Critical | 0 |
| High | 1 |
| Medium | 0 |
| Low | 0 |

#### Exception Classification Breakdown

| Class | Count | Description |
|-------|-------|-------------|
| self-reference | 0 | Rule implementation files |
| fixture-intentional | 0 | Test fixtures |
| generated-artifact | 0 | Compiled output |
| accepted-design | 1 | Architecture decisions |
| temporary-debt | 0 | Needs repayment |

### Known Debt

| Debt Type | Count | Critical | High | Medium | Low |
|-----------|-------|----------|------|--------|-----|
| Suppression Debt | 1 | 0 | 0 | 1 | 0 |
| Explicit Debt Markers | 0 | 0 | 0 | 0 | 0 |

## Domain Context

| Domain | Findings | High/Critical | Evidence Paths |
|--------|----------|---------------|----------------|
| Code health and maintainability | 11 | 0 | src/cli/report/targets.ts, src/cli/repro-bundle.ts, src/cli/snapshot.ts |
| Runtime configuration | 1 | 0 | src/cli/report/command.ts |

## Human Review Guide

Findings in this report are review-required candidates. Severity is a gate
priority label, not proof of a confirmed incident.

Suggested confirmation commands:

```sh
code-to-gate analyze "." --emit all --out .qh
code-to-gate schema validate .qh/findings.json
code-to-gate readiness "." --from .qh --out .qh
```

| Finding | Review Priority | Impact Hypothesis | Evidence | Confidence | Verification Hint |
|---------|-----------------|-------------------|----------|------------|-------------------|
| finding-TRY_CATCH_SWALLOW-000 | *MEDIUM* | Code health and maintainability: The catch block returns null/undefined without logging the error. This silently hides exceptions, making debugging difficult. | src/cli/report/targets.ts (text) | 0.85 | Inspect src/cli/report/targets.ts:4 and confirm whether the signal reaches a risky runtime path. |
| finding-TRY_CATCH_SWALLOW-001 | *MEDIUM* | Code health and maintainability: The catch block returns null/undefined without logging the error. This silently hides exceptions, making debugging difficult. | src/cli/repro-bundle.ts (text) | 0.85 | Inspect src/cli/repro-bundle.ts:20 and confirm whether the signal reaches a risky runtime path. |
| finding-TRY_CATCH_SWALLOW-002 | *MEDIUM* | Code health and maintainability: The catch block returns null/undefined without logging the error. This silently hides exceptions, making debugging difficult. | src/cli/snapshot.ts (text) | 0.85 | Inspect src/cli/snapshot.ts:59 and confirm whether the signal reaches a risky runtime path. |
| finding-TRY_CATCH_SWALLOW-003 | *MEDIUM* | Code health and maintainability: The catch block is empty, silently swallowing all exceptions. This hides errors and makes debugging difficult. Consider logging the error or handling it appropriately. | tools/migrate-fixtures-v02.mjs (text) | 0.95 | Inspect tools/migrate-fixtures-v02.mjs:137 and confirm whether the signal reaches a risky runtime path. |
| finding-ENV_DIRECT_ACCESS-004 | *MEDIUM* | Runtime configuration: The environment variable 'GITHUB_STEP_SUMMARY' is accessed directly without validation, default values, or type checking. This can cause runtime errors if the variable is missing or incorrectly formatted. Use a config validation layer or provide fallback values. | src/cli/report/command.ts (text) | 0.75 | Inspect src/cli/report/command.ts:105 and confirm whether the signal reaches a risky runtime path. |
| finding-LARGE_MODULE-006 | *MEDIUM* | Code health and maintainability: This file has 39 function definitions, exceeding the 20 threshold. Files with many functions are hard to understand and test. Consider grouping related functions into separate modules. | src/cli/evidence-normalize.ts (text) | 0.85 | Inspect src/cli/evidence-normalize.ts:1 and confirm whether the signal reaches a risky runtime path. |
| finding-LARGE_MODULE-007 | *MEDIUM* | Code health and maintainability: This file has 23 function definitions, exceeding the 20 threshold. Files with many functions are hard to understand and test. Consider grouping related functions into separate modules. | src/cli/policy-lint.ts (text) | 0.85 | Inspect src/cli/policy-lint.ts:1 and confirm whether the signal reaches a risky runtime path. |
| finding-LARGE_MODULE-008 | *MEDIUM* | Code health and maintainability: This file has 44 function definitions, exceeding the 20 threshold. Files with many functions are hard to understand and test. Consider grouping related functions into separate modules. | src/cli/report/formatter.ts (text) | 0.85 | Inspect src/cli/report/formatter.ts:1 and confirm whether the signal reaches a risky runtime path. |
| finding-LARGE_MODULE-009 | *MEDIUM* | Code health and maintainability: This file has 26 function definitions, exceeding the 20 threshold. Files with many functions are hard to understand and test. Consider grouping related functions into separate modules. | src/gate/reliability/qualification.ts (text) | 0.85 | Inspect src/gate/reliability/qualification.ts:1 and confirm whether the signal reaches a risky runtime path. |
| finding-LARGE_MODULE-010 | *MEDIUM* | Code health and maintainability: This file has 29 function definitions, exceeding the 20 threshold. Files with many functions are hard to understand and test. Consider grouping related functions into separate modules. | src/gate/reliability/utils.ts (text) | 0.85 | Inspect src/gate/reliability/utils.ts:1 and confirm whether the signal reaches a risky runtime path. |
| finding-LARGE_MODULE-011 | *MEDIUM* | Code health and maintainability: This file has 24 function definitions, exceeding the 20 threshold. Files with many functions are hard to understand and test. Consider grouping related functions into separate modules. | tools/migrate-fixtures-v02.mjs (text) | 0.85 | Inspect tools/migrate-fixtures-v02.mjs:1 and confirm whether the signal reaches a risky runtime path. |
| finding-SUPPRESSION_DEBT-012 | *MEDIUM* | Code health and maintainability: This suppression has expiry longer than 180 days. Narrow the path, add a near-term expiry, or replace the suppression with a tracked remediation item. | .ctg/suppressions.yaml (text) | 0.80 | Inspect .ctg/suppressions.yaml:3 and confirm whether the signal reaches a risky runtime path. |

## Suppressed Findings

| ID | Rule | Severity | Title | Reason |
|----|------|----------|-------|--------|
| finding-UNSAFE_DELETE-005 | UNSAFE_DELETE | **HIGH** | Unsafe delete operation detected | (suppressed) |

## Suppression Debt

These suppressions may hide underlying issues and should be reviewed.

| ID | Location | Severity | Title |
|----|----------|----------|-------|
| finding-SUPPRESSION_DEBT-012 | .ctg/suppressions.yaml | *MEDIUM* | Suppression may hide debt (UNSAFE_DELETE) |

## All Findings

| ID | Rule | Category | Domain | Severity | Title | Evidence | Review Flags | LLM |
|----|------|----------|--------|----------|-------|----------|--------------|-----|
| finding-TRY_CATCH_SWALLOW-000 | TRY_CATCH_SWALLOW | maintainability | Code health and maintainability | *MEDIUM* | Catch block returns null without logging | src/cli/report/targets.ts | evidence-linked | not-used |
| finding-TRY_CATCH_SWALLOW-001 | TRY_CATCH_SWALLOW | maintainability | Code health and maintainability | *MEDIUM* | Catch block returns null without logging | src/cli/repro-bundle.ts | evidence-linked | not-used |
| finding-TRY_CATCH_SWALLOW-002 | TRY_CATCH_SWALLOW | maintainability | Code health and maintainability | *MEDIUM* | Catch block returns null without logging | src/cli/snapshot.ts | evidence-linked | not-used |
| finding-TRY_CATCH_SWALLOW-003 | TRY_CATCH_SWALLOW | maintainability | Code health and maintainability | *MEDIUM* | Empty catch block swallows exceptions | tools/migrate-fixtures-v02.mjs | evidence-linked | not-used |
| finding-ENV_DIRECT_ACCESS-004 | ENV_DIRECT_ACCESS | config | Runtime configuration | *MEDIUM* | Environment variable 'GITHUB_STEP_SUMMARY' accessed without validation | src/cli/report/command.ts | evidence-linked | not-used |
| finding-LARGE_MODULE-006 | LARGE_MODULE | maintainability | Code health and maintainability | *MEDIUM* | Module has too many functions (39) | src/cli/evidence-normalize.ts | evidence-linked | not-used |
| finding-LARGE_MODULE-007 | LARGE_MODULE | maintainability | Code health and maintainability | *MEDIUM* | Module has too many functions (23) | src/cli/policy-lint.ts | evidence-linked | not-used |
| finding-LARGE_MODULE-008 | LARGE_MODULE | maintainability | Code health and maintainability | *MEDIUM* | Module has too many functions (44) | src/cli/report/formatter.ts | evidence-linked | not-used |
| finding-LARGE_MODULE-009 | LARGE_MODULE | maintainability | Code health and maintainability | *MEDIUM* | Module has too many functions (26) | src/gate/reliability/qualification.ts | evidence-linked | not-used |
| finding-LARGE_MODULE-010 | LARGE_MODULE | maintainability | Code health and maintainability | *MEDIUM* | Module has too many functions (29) | src/gate/reliability/utils.ts | evidence-linked | not-used |
| finding-LARGE_MODULE-011 | LARGE_MODULE | maintainability | Code health and maintainability | *MEDIUM* | Module has too many functions (24) | tools/migrate-fixtures-v02.mjs | evidence-linked | not-used |
| finding-SUPPRESSION_DEBT-012 | SUPPRESSION_DEBT | maintainability | Code health and maintainability | *MEDIUM* | Suppression may hide debt (UNSAFE_DELETE) | .ctg/suppressions.yaml | evidence-linked | not-used |

## False-Positive Review

| Finding | Checkpoint |
|---------|------------|
| finding-TRY_CATCH_SWALLOW-000 | domain=Code health and maintainability; evidence=src/cli/report/targets.ts; confidence=0.85; flags=evidence-linked |
| finding-TRY_CATCH_SWALLOW-001 | domain=Code health and maintainability; evidence=src/cli/repro-bundle.ts; confidence=0.85; flags=evidence-linked |
| finding-TRY_CATCH_SWALLOW-002 | domain=Code health and maintainability; evidence=src/cli/snapshot.ts; confidence=0.85; flags=evidence-linked |
| finding-TRY_CATCH_SWALLOW-003 | domain=Code health and maintainability; evidence=tools/migrate-fixtures-v02.mjs; confidence=0.95; flags=evidence-linked |
| finding-ENV_DIRECT_ACCESS-004 | domain=Runtime configuration; evidence=src/cli/report/command.ts; confidence=0.75; flags=evidence-linked |
| finding-LARGE_MODULE-006 | domain=Code health and maintainability; evidence=src/cli/evidence-normalize.ts; confidence=0.85; flags=evidence-linked |
| finding-LARGE_MODULE-007 | domain=Code health and maintainability; evidence=src/cli/policy-lint.ts; confidence=0.85; flags=evidence-linked |
| finding-LARGE_MODULE-008 | domain=Code health and maintainability; evidence=src/cli/report/formatter.ts; confidence=0.85; flags=evidence-linked |
| finding-LARGE_MODULE-009 | domain=Code health and maintainability; evidence=src/gate/reliability/qualification.ts; confidence=0.85; flags=evidence-linked |
| finding-LARGE_MODULE-010 | domain=Code health and maintainability; evidence=src/gate/reliability/utils.ts; confidence=0.85; flags=evidence-linked |
| finding-LARGE_MODULE-011 | domain=Code health and maintainability; evidence=tools/migrate-fixtures-v02.mjs; confidence=0.85; flags=evidence-linked |
| finding-SUPPRESSION_DEBT-012 | domain=Code health and maintainability; evidence=.ctg/suppressions.yaml; confidence=0.80; flags=evidence-linked |

## Recommended Actions Summary

---

*This report was generated by code-to-gate. Findings are based on static analysis of the repository.*
