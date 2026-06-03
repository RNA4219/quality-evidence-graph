import type { SourceRef } from "../../types.js";

// ============================================================================
// DQ-15 SourceRefs (IPO controlled approval evidence checks)
// ============================================================================

export const SR_DQ_15_POLICY: SourceRef = {
  id: "SR-DQ-15-POLICY",
  path: "docs/spec/gate-policy.md",
  startLine: 1,
  endLine: 10,
  label: "policyHash must match",
};

export const SR_DQ_15_APPROVAL: SourceRef = {
  id: "SR-DQ-15-APPROVAL",
  path: "docs/spec/evidence-package.md",
  startLine: 1,
  endLine: 10,
  label: "approval evidence required for release_decision",
};

export const SR_DQ_15_APPROVAL_POLICYID: SourceRef = {
  id: "SR-DQ-15-APPROVAL-POLICYID",
  path: "docs/spec/waiver-approval.md",
  startLine: 1,
  endLine: 10,
  label: "ApprovalEvidence policyId must match GatePolicy",
};

export const SR_DQ_15_APPROVAL_POLICYHASH: SourceRef = {
  id: "SR-DQ-15-APPROVAL-POLICYHASH",
  path: "docs/spec/waiver-approval.md",
  startLine: 1,
  endLine: 10,
  label: "ApprovalEvidence policyHash must match GatePolicy",
};

export const SR_DQ_15_APPROVAL_PKGHASH: SourceRef = {
  id: "SR-DQ-15-APPROVAL-PKGHASH",
  path: "docs/spec/waiver-approval.md",
  startLine: 1,
  endLine: 10,
  label: "ApprovalEvidence evidencePackageHash must match EvidencePackage",
};

export const SR_DQ_15_APPROVAL_SOURCE: SourceRef = {
  id: "SR-DQ-15-APPROVAL-SOURCE",
  path: "docs/spec/waiver-approval.md",
  startLine: 1,
  endLine: 10,
  label: "ApprovalEvidence must have non-empty sourceRefs",
};

export const SR_DQ_17: SourceRef = {
  id: "SR-DQ-17",
  path: "docs/spec/waiver-approval.md",
  startLine: 69,
  endLine: 79,
  label: "ControlRoles required for IPO controlled",
};

// ============================================================================
// DQ-16 SourceRef (retention immutability)
// ============================================================================

export const SR_DQ_16: SourceRef = {
  id: "SR-DQ-16",
  path: "docs/spec/retention-immutability.md",
  startLine: 1,
  endLine: 10,
  label: "storage classification must be immutable/versioned",
};

// ============================================================================
// DQ-09 SourceRef (sensitive value redaction)
// ============================================================================

export const SR_DQ_09: SourceRef = {
  id: "SR-DQ-09",
  path: "docs/spec/retention-immutability.md",
  startLine: 63,
  endLine: 65,
  label: "sensitive value redaction requirement",
};

// ============================================================================
// DQ-11 SourceRef (required connector contract)
// ============================================================================

export const SR_DQ_11: SourceRef = {
  id: "SR-DQ-11",
  path: "docs/spec/gate-policy.md",
  startLine: 65,
  endLine: 66,
  label: "required connector contract violation",
};