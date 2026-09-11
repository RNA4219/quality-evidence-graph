import type { Disqualification, DisqualificationCode, SourceRef } from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import {
  checkApprovalEvidenceHashes,
  checkApprovalRequired,
  checkApprovalShape,
  checkPolicyHashMismatch,
  checkWaiverSourceBacked,
} from "./helpers.js";
import { SR_DQ_16, SR_DQ_17 } from "./source-refs.js";

/**
 * DQ-15: Gate policy / waiver / approval evidence integrity
 *
 * Checks:
 * - Waiver is source-backed
 * - GatePolicy policyHash matches evidencePackage.gatePolicy.policyHash
 * - release_decision phase has approvalEvidence
 * - ApprovalEvidence hashes match (policyId, policyHash, evidencePackageHash)
 * - ApprovalEvidence has sourceRefs
 */
export function detectDQ15(input: DQDetectorInput): Disqualification[] {
  return [
    ...checkWaiverSourceBacked(input.waivers),
    checkPolicyHashMismatch(input),
    checkApprovalRequired(input),
    ...checkApprovalShape(input),
    ...checkApprovalEvidenceHashes(input),
  ].filter((d): d is Disqualification => d !== null);
}

/**
 * DQ-16: Evidence used for release judgment exists only in mutable storage
 *
 * Silent-overwrite capable storage (e.g., local filesystem, mutable database)
 * cannot provide audit trail integrity for release decisions.
 */
export function detectDQ16(input: DQDetectorInput): Disqualification | null {
  const classification = input.evidencePackage?.retention.storageClassification;
  if (classification === "mutable" || classification === "unknown") {
    return {
      code: "DQ-16" as DisqualificationCode,
      message: classification === "unknown"
        ? "Evidence storage immutability is unknown; release judgment requires a verified storage classification"
        : "Evidence used for release judgment exists only in silent-overwrite capable storage",
      nodeIds: [],
      sourceRefs: [SR_DQ_16],
    };
  }
  return null;
}

/**
 * DQ-17: Control roles not recorded for IPO controlled profile
 *
 * IPO controlled profile requires producer/reviewer/approver/waiverApprover/releaseOwner
 * roles to be recorded in evidencePackage.controlRoles.
 */
export function detectDQ17(input: DQDetectorInput): Disqualification[] {
  if (input.metadata.profile !== "ipo_controlled") return [];

  const roles = input.evidencePackage?.controlRoles;
  if (!roles || [roles.producer, roles.reviewer, roles.approver, roles.waiverApprover, roles.releaseOwner]
    .some(role => typeof role !== "string" || role.trim() === "")) {
    return [
      {
        code: "DQ-17" as DisqualificationCode,
        message:
          "Control roles (producer/reviewer/approver/waiverApprover/releaseOwner) not recorded",
        nodeIds: [],
        sourceRefs: [SR_DQ_17],
      },
    ];
  }

  return [];
}
