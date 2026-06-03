import type { Disqualification, DisqualificationCode, Waiver } from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import {
  SR_DQ_15_APPROVAL,
  SR_DQ_15_APPROVAL_PKGHASH,
  SR_DQ_15_APPROVAL_POLICYHASH,
  SR_DQ_15_APPROVAL_POLICYID,
  SR_DQ_15_APPROVAL_SOURCE,
  SR_DQ_15_POLICY,
} from "./source-refs.js";

/**
 * Check DQ-15: Waiver is not source-backed
 *
 * A waiver without sourceRefs cannot be traced to approval documentation.
 */
export function checkWaiverSourceBacked(waivers: readonly Waiver[]): Disqualification[] {
  return waivers
    .filter((w) => !w.valid && (!w.sourceRefs || w.sourceRefs.length === 0))
    .map((w) => ({
      code: "DQ-15" as DisqualificationCode,
      message: `Waiver "${w.id}" is not source-backed`,
      nodeIds: [w.id],
      sourceRefs: [],
    }));
}

/**
 * Check DQ-15: Gate policy hash mismatch
 *
 * Evidence package gatePolicy.policyHash must match the evaluated GatePolicy.
 */
export function checkPolicyHashMismatch(input: DQDetectorInput): Disqualification | null {
  if (
    input.evidencePackage &&
    input.evidencePackage.gatePolicy.policyHash !== input.policy.policyHash
  ) {
    return {
      code: "DQ-15" as DisqualificationCode,
      message: "Gate policy hash mismatch - policy integrity violated",
      nodeIds: [],
      sourceRefs: [SR_DQ_15_POLICY],
    };
  }
  return null;
}

/**
 * Check DQ-15: Approval evidence missing in release_decision phase
 *
 * release_decision phase requires approvalEvidence to be non-empty.
 */
export function checkApprovalRequired(input: DQDetectorInput): Disqualification | null {
  if (
    input.evidencePackage?.phase === "release_decision" &&
    input.evidencePackage.approvalEvidence.length === 0
  ) {
    return {
      code: "DQ-15" as DisqualificationCode,
      message: "Approval evidence missing in release_decision phase",
      nodeIds: [],
      sourceRefs: [SR_DQ_15_APPROVAL],
    };
  }
  return null;
}

/**
 * Check DQ-15: ApprovalEvidence hash mismatches
 *
 * Each ApprovalEvidence must have:
 * - policyId matching GatePolicy.policyId
 * - policyHash matching GatePolicy.policyHash
 * - evidencePackageHash matching EvidencePackage.evidencePackageHash (if present)
 * - non-empty sourceRefs
 */
export function checkApprovalEvidenceHashes(input: DQDetectorInput): Disqualification[] {
  if (!input.evidencePackage) return [];

  const disqualifications: Disqualification[] = [];

  for (const approval of input.evidencePackage.approvalEvidence) {
    if (approval.policyId !== input.policy.policyId) {
      disqualifications.push({
        code: "DQ-15" as DisqualificationCode,
        message: `ApprovalEvidence "${approval.id}" policyId mismatch - expected "${input.policy.policyId}", got "${approval.policyId}"`,
        nodeIds: [approval.id],
        sourceRefs: [SR_DQ_15_APPROVAL_POLICYID],
      });
    }

    if (approval.policyHash !== input.policy.policyHash) {
      disqualifications.push({
        code: "DQ-15" as DisqualificationCode,
        message: `ApprovalEvidence "${approval.id}" policyHash mismatch - expected "${input.policy.policyHash}", got "${approval.policyHash}"`,
        nodeIds: [approval.id],
        sourceRefs: [SR_DQ_15_APPROVAL_POLICYHASH],
      });
    }

    if (
      input.evidencePackage.evidencePackageHash &&
      approval.evidencePackageHash !== input.evidencePackage.evidencePackageHash
    ) {
      disqualifications.push({
        code: "DQ-15" as DisqualificationCode,
        message: `ApprovalEvidence "${approval.id}" evidencePackageHash mismatch - expected "${input.evidencePackage.evidencePackageHash}", got "${approval.evidencePackageHash}"`,
        nodeIds: [approval.id],
        sourceRefs: [SR_DQ_15_APPROVAL_PKGHASH],
      });
    }

    if (!approval.sourceRefs || approval.sourceRefs.length === 0) {
      disqualifications.push({
        code: "DQ-15" as DisqualificationCode,
        message: `ApprovalEvidence "${approval.id}" has no sourceRefs`,
        nodeIds: [approval.id],
        sourceRefs: [SR_DQ_15_APPROVAL_SOURCE],
      });
    }
  }

  return disqualifications;
}