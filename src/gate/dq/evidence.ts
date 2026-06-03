import type { Disqualification, DisqualificationCode, QegNode, SourceRef, TestPlacementNode } from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import { getEvidencePackageText } from "../context.js";
import { SR_DQ_09, SR_DQ_11 } from "./source-refs.js";

/**
 * DQ-08: Manual evidence incomplete
 *
 * Manual evidence must have expectedResult, oracleRefs, traceTo, and evidenceRefs.
 */
export function detectDQ08(input: DQDetectorInput): Disqualification[] {
  if (!input.evidencePackage) return [];

  const disqualifications: Disqualification[] = [];
  for (const manual of input.evidencePackage.manualEvidence) {
    if (!manual.expectedResult || manual.oracleRefs.length === 0 ||
        manual.traceTo.length === 0 || manual.evidenceRefs.length === 0) {
      disqualifications.push({
        code: "DQ-08" as DisqualificationCode,
        message: `Manual evidence "${manual.executedCaseId}" incomplete`,
        nodeIds: [manual.executedCaseId],
        sourceRefs: [] as SourceRef[],
      });
    }
  }
  return disqualifications;
}

/**
 * Sensitive value patterns for DQ-09 detection
 */
const SENSITIVE_VALUE_PATTERNS = [
  /password\s*=\s*["'][^"']+["']/i,
  /api[_-]?key\s*=\s*["'][^"']+["']/i,
  /token\s*=\s*["'][^"']+["']/i,
  /secret\s*=\s*["'][^"']+["']/i,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
];

/**
 * DQ-09: Unredacted sensitive value in evidence package
 *
 * Evidence package text must not contain unredacted sensitive values.
 */
export function detectDQ09(input: DQDetectorInput): Disqualification | null {
  if (!input.evidencePackage) return null;

  if (SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(getEvidencePackageText(input)))) {
    return {
      code: "DQ-09" as DisqualificationCode,
      message: "Unredacted sensitive value detected in evidence package",
      nodeIds: [],
      sourceRefs: [SR_DQ_09],
    };
  }
  return null;
}

/**
 * DQ-10: Hidden oracle accessed in benchmark mode
 *
 * Candidate must not access hidden oracle when benchmarkMode is true.
 */
export function detectDQ10(input: DQDetectorInput): Disqualification | null {
  if (input.metadata.benchmarkMode && input.metadata.hiddenOracleAccessed) {
    return {
      code: "DQ-10" as DisqualificationCode,
      message: "Candidate accessed hidden oracle in benchmark mode",
      nodeIds: [],
      sourceRefs: [] as SourceRef[],
    };
  }
  return null;
}

/**
 * DQ-11: Required connector contract violation treated as success
 *
 * Required connectors with contract_violation status disqualify the gate.
 */
export function detectDQ11(input: DQDetectorInput): Disqualification[] {
  if (!input.metadata.requiredConnectorStatus) return [];

  const disqualifications: Disqualification[] = [];
  for (const [adapter, status] of Object.entries(input.metadata.requiredConnectorStatus)) {
    if (status === "contract_violation") {
      disqualifications.push({
        code: "DQ-11" as DisqualificationCode,
        message: `Required connector "${adapter}" contract violation treated as success`,
        nodeIds: [],
        sourceRefs: [SR_DQ_11],
      });
    }
  }
  return disqualifications;
}

/**
 * DQ-12: Artifact revision mismatch with headRef
 *
 * Input artifacts must have revision matching metadata.headRef.
 */
export function detectDQ12(input: DQDetectorInput): Disqualification[] {
  if (!input.metadata.headRef) return [];

  const disqualifications: Disqualification[] = [];
  for (const artifact of input.metadata.inputArtifacts) {
    if (artifact.revision && artifact.revision !== input.metadata.headRef) {
      disqualifications.push({
        code: "DQ-12" as DisqualificationCode,
        message: `Artifact revision "${artifact.revision}" mismatch with headRef "${input.metadata.headRef}"`,
        nodeIds: [artifact.id],
        sourceRefs: [] as SourceRef[],
      });
    }
  }
  return disqualifications;
}

/**
 * DQ-13: Evidence package sourceRefs empty
 *
 * Evidence package must have non-empty sourceRefs for audit trail.
 */
export function detectDQ13(input: DQDetectorInput): Disqualification | null {
  if (input.evidencePackage && input.evidencePackage.sourceRefs.length === 0) {
    return {
      code: "DQ-13" as DisqualificationCode,
      message: "Evidence package sourceRefs is empty",
      nodeIds: [],
      sourceRefs: [] as SourceRef[],
    };
  }
  return null;
}

/**
 * Helper: Get test placement nodes for DQ-14 detection
 */
function testPlacementNodes(input: DQDetectorInput): readonly TestPlacementNode[] {
  return input.testPlacementNodes ?? input.graph.nodes.filter(
    (node: QegNode): node is TestPlacementNode => node.kind === "test_placement"
  );
}

/**
 * DQ-14: Manual-scripted placement without acceptable oracle
 *
 * Manual-scripted test placements must have acceptable oracle evidence.
 */
export function detectDQ14(input: DQDetectorInput): Disqualification[] {
  const disqualifications: Disqualification[] = [];

  for (const placement of testPlacementNodes(input)) {
    if (placement.primaryLayer !== "manual-scripted") continue;

    const hasAcceptableOracle = input.evidencePackage?.manualEvidence.some(
      (manual) => manual.oracleRefs.some((oracle) => oracle.evidenceKind === "human_review")
    ) || placement.candidateScores.some(
      (score) => score.sourceRefs.some((sourceRef) => sourceRef.label?.includes("oracle"))
    );
    if (!hasAcceptableOracle) {
      disqualifications.push({
        code: "DQ-14" as DisqualificationCode,
        message: `Manual-scripted placement "${placement.id}" without acceptable oracle`,
        nodeIds: [placement.id],
        sourceRefs: placement.traceability.sourceRefs,
      });
    }
  }

  return disqualifications;
}