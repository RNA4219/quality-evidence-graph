import type {
  Disqualification,
  DisqualificationCode,
  EvidenceRef,
  QegNode,
  SourceRef,
  StableId,
  TestNode,
  TestObligation,
  TestPlacementNode,
} from "../../types.js";
import type { DQDetectorInput } from "../context.js";

function testPlacementNodes(input: DQDetectorInput): readonly TestPlacementNode[] {
  return input.testPlacementNodes ?? input.graph.nodes.filter(
    (node: QegNode): node is TestPlacementNode => node.kind === "test_placement"
  );
}

function testNodes(input: DQDetectorInput): readonly TestNode[] {
  return input.graph.nodes.filter((node: QegNode): node is TestNode => node.kind === "test");
}

function sourceRefsFromEvidence(evidenceRefs: readonly EvidenceRef[]): SourceRef[] {
  return evidenceRefs.map(({ evidenceKind: _evidenceKind, capturedAt: _capturedAt, ...sourceRef }) => sourceRef);
}

function sourceRefsForPlacementChange(input: DQDetectorInput, evidenceRefs: readonly EvidenceRef[]): SourceRef[] {
  const refs = sourceRefsFromEvidence(evidenceRefs);
  return refs.length > 0 ? refs : [...input.policy.sourceRefs];
}

function obligationsForSubject(
  obligations: readonly TestObligation[],
  placements: readonly TestPlacementNode[],
  subjectId: StableId
): readonly TestObligation[] {
  const obligationIds = new Set(
    placements
      .filter((placement) => placement.id === subjectId || placement.selectedTestIds.includes(subjectId))
      .map((placement) => placement.obligationId)
  );
  return obligations.filter((obligation) => obligationIds.has(obligation.id));
}

function riskIdsForSubject(
  obligations: readonly TestObligation[],
  placements: readonly TestPlacementNode[],
  subjectId: StableId
): StableId[] {
  return [...new Set(obligationsForSubject(obligations, placements, subjectId).flatMap((obligation) => obligation.riskIds))];
}

function isManualLayer(layer: string): boolean {
  return layer === "manual-scripted" || layer === "manual-exploratory";
}

function isRestored(input: DQDetectorInput, subjectId: StableId): boolean {
  return input.placementPlan?.manual_case_inventory?.current_subject_ids.includes(subjectId) ?? false;
}

function detectManualScriptedOracleGaps(input: DQDetectorInput): Disqualification[] {
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

function detectPlacementChangeRetirementGaps(input: DQDetectorInput): Disqualification[] {
  if (!input.placementPlan) return [];

  const disqualifications: Disqualification[] = [];
  const placementChanges = input.placementPlan.placement_changes ?? [];
  const knownTests = new Map(testNodes(input).map((test) => [test.id, test]));
  const retirementPolicy = input.policy.placementRetirementPolicy;

  for (const change of placementChanges) {
    const sourceRefs = sourceRefsForPlacementChange(input, change.evidence_refs);
    const isRetirement = isManualLayer(change.from_layer) && change.to_layer === "automated";

    if (!isRetirement) continue;

    if (change.evidence_refs.length === 0) {
      disqualifications.push({
        code: "DQ-14" as DisqualificationCode,
        message: `Placement change "${change.id}" retires manual case "${change.subject_id}" without evidence_refs`,
        nodeIds: [change.id, change.subject_id],
        sourceRefs,
      });
      continue;
    }

    if (!retirementPolicy || retirementPolicy.sourceRefs.length === 0) {
      disqualifications.push({
        code: "DQ-14" as DisqualificationCode,
        message: `Placement change "${change.id}" has no source-backed retirement policy`,
        nodeIds: [change.id, change.policy_ref],
        sourceRefs,
      });
      continue;
    }

    const replacementTests = change.replacement_ids.map((id) => knownTests.get(id));
    if (replacementTests.some((test) => test === undefined || test.deleted)) {
      if (!isRestored(input, change.subject_id)) {
        disqualifications.push({
          code: "DQ-14" as DisqualificationCode,
          message: `Placement change "${change.id}" replacement test is missing or deleted and manual case "${change.subject_id}" is not restored`,
          nodeIds: [change.id, change.subject_id, ...change.replacement_ids],
          sourceRefs,
        });
      }
      continue;
    }

    const concreteReplacementTests = replacementTests.filter((test): test is TestNode => test !== undefined);
    const evidenceTooWeak = concreteReplacementTests.some((test) =>
      (test.evidenceStrength ?? 0) < retirementPolicy.minEvidenceStrength ||
      (test.recentGreenRuns ?? 0) < retirementPolicy.minConsecutiveGreen
    );
    const requiredRiskIds = riskIdsForSubject(input.placementPlan.obligations, input.placementPlan.placements, change.subject_id);
    const coveredRiskIds = new Set(concreteReplacementTests.flatMap((test) => test.coveredRiskIds ?? []));
    const riskCoverageMissing = retirementPolicy.requireRiskCoverage &&
      requiredRiskIds.some((riskId) => !coveredRiskIds.has(riskId));

    if ((evidenceTooWeak || riskCoverageMissing) && !isRestored(input, change.subject_id)) {
      const reason = evidenceTooWeak ? "evidence strength or green-run threshold fell below policy" : "required risk coverage is missing";
      disqualifications.push({
        code: "DQ-14" as DisqualificationCode,
        message: `Placement change "${change.id}" is a revert candidate: ${reason}`,
        nodeIds: [change.id, change.subject_id, ...change.replacement_ids, ...requiredRiskIds],
        sourceRefs,
      });
    }
  }

  return disqualifications;
}

function detectManualCaseDisappearance(input: DQDetectorInput): Disqualification[] {
  const inventory = input.placementPlan?.manual_case_inventory;
  if (!inventory) return [];

  const current = new Set(inventory.current_subject_ids);
  const retired = new Set((input.placementPlan?.placement_changes ?? []).map((change) => change.subject_id));

  return inventory.previous_subject_ids
    .filter((previousSubjectId) => !current.has(previousSubjectId) && !retired.has(previousSubjectId))
    .map((previousSubjectId) => ({
      code: "DQ-14" as DisqualificationCode,
      message: `Manual case "${previousSubjectId}" disappeared without placement_change retirement record`,
      nodeIds: [previousSubjectId],
      sourceRefs: inventory.sourceRefs,
    }));
}

/**
 * DQ-14: Manual-scripted placement without acceptable oracle, invalid manual
 * retirement record, unreverted replacement degradation, or unrecorded manual
 * case disappearance.
 */
export function detectDQ14(input: DQDetectorInput): Disqualification[] {
  return [
    ...detectManualScriptedOracleGaps(input),
    ...detectPlacementChangeRetirementGaps(input),
    ...detectManualCaseDisappearance(input),
  ];
}
