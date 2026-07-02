import { writeFile } from "fs/promises";
import { join } from "path";
import type {
  AuditTrail,
  EvidencePackage,
  GatePolicy,
  QualityEvidenceRecord,
} from "../types.js";
import { CliError } from "./errors.js";
import type { EvaluatedFixture } from "./fixture-io.js";
import {
  appendEscapedDefectNodes,
  buildGateEfficacyRecords,
  buildRecalibrationProposalsForFixture,
} from "../gate-efficacy.js";

function buildAuditTrail(evidencePackage: EvidencePackage | undefined, policy: GatePolicy): AuditTrail | undefined {
  if (!evidencePackage) {
    return undefined;
  }

  return {
    evidencePackageHash: evidencePackage.evidencePackageHash,
    approvalEvidenceSummary: evidencePackage.approvalEvidence.map((approval) => ({
      id: approval.id,
      approver: approval.approver,
      approvedAt: approval.approvedAt,
      policyId: approval.policyId,
      policyHash: approval.policyHash,
      evidencePackageHash: approval.evidencePackageHash,
    })),
    gatePolicyHash: policy.policyHash,
    gatePolicyId: policy.policyId,
  };
}

export async function writeOutputRecord(evaluated: EvaluatedFixture): Promise<void> {
  const placementPlan = evaluated.placementPlan ?? {
    metadata: evaluated.metadata,
    obligations: [],
    placements: [],
  };
  const gateEfficacyRecords = buildGateEfficacyRecords(evaluated);
  const recalibrationProposals = buildRecalibrationProposalsForFixture(evaluated);

  const record: QualityEvidenceRecord = {
    metadata: evaluated.metadata,
    graph: appendEscapedDefectNodes(evaluated.graph, evaluated, placementPlan),
    placementPlan,
    gate: evaluated.gateResult,
    exports: [
      { kind: "json", path: "output-record.json" },
    ],
    auditTrail: buildAuditTrail(evaluated.evidencePackage, evaluated.policy),
    ...(gateEfficacyRecords.length > 0 ? { gateEfficacyRecords } : {}),
    ...(recalibrationProposals.length > 0 ? { recalibrationProposals } : {}),
  };

  const recordJson = JSON.stringify(record, null, 2);
  try {
    JSON.parse(recordJson);
    console.log("Own-output validation: PASS (record can be serialized and parsed)");
  } catch (error) {
    throw new CliError(
      `Own-output validation: FAIL - ${error}`,
      error instanceof Error ? error : undefined
    );
  }

  const outputPath = join(evaluated.fixtureDir, "output-record.json");
  await writeFile(outputPath, recordJson, "utf-8");
  console.log(`Record written to: ${outputPath}`);
}
