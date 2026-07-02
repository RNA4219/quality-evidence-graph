import type {
  EscapedDefectBacklink,
  EscapedDefectEvidence,
  GateEfficacyRecord,
  QualityEvidenceGraph,
  RecalibrationProposal,
  SourceRef,
  StableId,
  TestPlacementPlan,
} from "./types.js";
import type { EvaluatedFixture } from "./cli/fixture-io.js";

const DEFAULT_TRACEABILITY = {
  sourceRefs: [] as SourceRef[],
  assumptions: [] as string[],
  confidence: "medium" as const,
};

function unique(values: readonly StableId[]): StableId[] {
  return [...new Set(values.filter(Boolean))];
}

function collectEvidenceUsed(evaluated: EvaluatedFixture, defect: EscapedDefectEvidence): StableId[] {
  if (defect.evidenceRefs && defect.evidenceRefs.length > 0) {
    return unique(defect.evidenceRefs);
  }

  const evidencePackage = evaluated.evidencePackage;
  if (!evidencePackage) return [];

  return unique([
    ...evidencePackage.inputArtifactHashes.map((artifact) => artifact.id),
    ...evidencePackage.approvalEvidence.map((approval) => approval.id),
    ...evidencePackage.manualEvidence.flatMap((item) => item.evidenceRefs.map((ref) => ref.id)),
    ...evidencePackage.sourceRefs.map((ref) => ref.id),
  ]);
}

function resolveVerdictRef(evaluated: EvaluatedFixture, defect: EscapedDefectEvidence): StableId {
  return defect.verdictRef ?? evaluated.evidencePackage?.qegOutputs.gateVerdict.id ?? `${evaluated.metadata.runId}:gate-verdict`;
}

function resolvePlacementPlanRef(evaluated: EvaluatedFixture, defect: EscapedDefectEvidence): StableId {
  return defect.placementPlanRef ??
    evaluated.evidencePackage?.qegOutputs.testPlacementPlan.id ??
    `${evaluated.metadata.runId}:placement-plan`;
}

function buildBacklink(evaluated: EvaluatedFixture, defect: EscapedDefectEvidence): EscapedDefectBacklink {
  return {
    id: defect.id,
    title: defect.title,
    severity: defect.severity,
    discoveredAt: defect.discoveredAt,
    linkedVerdictRef: resolveVerdictRef(evaluated, defect),
    linkedPlacementPlanRef: resolvePlacementPlanRef(evaluated, defect),
    linkedEvidenceRefs: collectEvidenceUsed(evaluated, defect),
    sourceRefs: defect.sourceRefs,
  };
}

function buildAnalysisNotes(evaluated: EvaluatedFixture, defect: EscapedDefectEvidence): string {
  return defect.analysisNotes ??
    `Escaped defect ${defect.id} was reported after verdict ${resolveVerdictRef(evaluated, defect)}.`;
}

function proposalId(scope: "policy" | "placement", targetRef: StableId): StableId {
  return `qeg:recalibration-proposal:${scope}:${targetRef.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function buildRecalibrationProposals(
  defects: readonly EscapedDefectEvidence[]
): RecalibrationProposal[] {
  const proposals: RecalibrationProposal[] = [];
  const sourceRefsByTarget = new Map<string, SourceRef[]>();
  const defectRefsByTarget = new Map<string, StableId[]>();

  for (const defect of defects) {
    for (const targetRef of defect.affectedPolicyRefs ?? []) {
      const key = `policy:${targetRef}`;
      sourceRefsByTarget.set(key, [...(sourceRefsByTarget.get(key) ?? []), ...defect.sourceRefs]);
      defectRefsByTarget.set(key, [...(defectRefsByTarget.get(key) ?? []), defect.id]);
    }
    for (const targetRef of defect.affectedPlacementRefs ?? []) {
      const key = `placement:${targetRef}`;
      sourceRefsByTarget.set(key, [...(sourceRefsByTarget.get(key) ?? []), ...defect.sourceRefs]);
      defectRefsByTarget.set(key, [...(defectRefsByTarget.get(key) ?? []), defect.id]);
    }
  }

  for (const [key, escapedDefectRefs] of defectRefsByTarget.entries()) {
    const [scope, ...targetParts] = key.split(":");
    const targetRef = targetParts.join(":");
    const proposalScope = scope as "policy" | "placement";
    proposals.push({
      id: proposalId(proposalScope, targetRef),
      scope: proposalScope,
      targetRef,
      reason: `Escaped defects indicate degraded ${proposalScope} efficacy. Human approval is required before mutation.`,
      escapedDefectRefs: unique(escapedDefectRefs),
      status: "proposed",
      sourceRefs: sourceRefsByTarget.get(key) ?? [],
    });
  }

  return proposals.sort((a, b) => a.id.localeCompare(b.id));
}

export function buildGateEfficacyRecords(evaluated: EvaluatedFixture): readonly GateEfficacyRecord[] {
  const escapedDefects = evaluated.optionalEvidence?.escapedDefects ?? [];
  return escapedDefects.map((defect) => ({
    verdict_ref: resolveVerdictRef(evaluated, defect),
    escaped_defects: [buildBacklink(evaluated, defect)],
    evidence_used: collectEvidenceUsed(evaluated, defect),
    policy_hash_at_verdict: evaluated.policy.policyHash,
    analysis_notes: buildAnalysisNotes(evaluated, defect),
  }));
}

export function buildRecalibrationProposalsForFixture(evaluated: EvaluatedFixture): readonly RecalibrationProposal[] {
  return buildRecalibrationProposals(evaluated.optionalEvidence?.escapedDefects ?? []);
}

export function appendEscapedDefectNodes(
  graph: QualityEvidenceGraph,
  evaluated: EvaluatedFixture,
  placementPlan: TestPlacementPlan
): QualityEvidenceGraph {
  const escapedDefects = evaluated.optionalEvidence?.escapedDefects ?? [];
  if (escapedDefects.length === 0) return graph;

  const nodes = [...graph.nodes];
  const edges = [...graph.edges];

  for (const defect of escapedDefects) {
    const backlink = buildBacklink(evaluated, defect);
    nodes.push({
      id: defect.id,
      kind: "escaped_defect",
      title: defect.title,
      severity: defect.severity,
      discoveredAt: defect.discoveredAt,
      linkedVerdictRef: backlink.linkedVerdictRef,
      linkedPlacementPlanRef: backlink.linkedPlacementPlanRef,
      linkedEvidenceRefs: backlink.linkedEvidenceRefs,
      traceability: {
        ...DEFAULT_TRACEABILITY,
        sourceRefs: defect.sourceRefs,
        assumptions: ["Escaped defect is optional evidence and does not mutate historical verdicts."],
      },
      sourceArtifactIds: defect.sourceRefs.map((ref) => ref.id),
    });

    edges.push({
      id: `${defect.id}:contradicts-verdict`,
      kind: "contradicts",
      from: defect.id,
      to: backlink.linkedVerdictRef,
      traceability: {
        ...DEFAULT_TRACEABILITY,
        sourceRefs: defect.sourceRefs,
      },
    });
    edges.push({
      id: `${defect.id}:contradicts-placement`,
      kind: "contradicts",
      from: defect.id,
      to: backlink.linkedPlacementPlanRef || placementPlan.metadata.runId,
      traceability: {
        ...DEFAULT_TRACEABILITY,
        sourceRefs: defect.sourceRefs,
      },
    });
    for (const evidenceRef of backlink.linkedEvidenceRefs) {
      edges.push({
        id: `${defect.id}:evidenced-by:${evidenceRef.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
        kind: "evidenced_by",
        from: defect.id,
        to: evidenceRef,
        traceability: {
          ...DEFAULT_TRACEABILITY,
          sourceRefs: defect.sourceRefs,
        },
      });
    }
  }

  return {
    ...graph,
    nodes,
    edges,
  };
}
