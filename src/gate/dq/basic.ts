import type {
  ChangedCodeNode,
  Disqualification,
  DisqualificationCode,
  GateBlocker,
  QegNode,
  RiskNode,
  SourceRef,
} from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import { computeBlockers } from "../verdict.js";

function riskNodes(input: DQDetectorInput): readonly RiskNode[] {
  return input.riskNodes ?? input.graph.nodes.filter((node: QegNode): node is RiskNode => node.kind === "risk");
}

function changedCodeNodes(input: DQDetectorInput): readonly ChangedCodeNode[] {
  return input.changedCodeNodes ?? input.graph.nodes.filter(
    (node: QegNode): node is ChangedCodeNode => node.kind === "changed_code"
  );
}

function blockers(input: DQDetectorInput): readonly GateBlocker[] {
  return input.blockers ?? computeBlockers(input.graph, input.validWaivers);
}

export function detectDQ01(input: DQDetectorInput): Disqualification[] {
  const parserDqs = input.graph.completeness.parserFailures.map((failure) => ({
    code: "DQ-01" as DisqualificationCode,
    message: `Parser failure: ${failure.reason}`,
    nodeIds: [],
    sourceRefs: failure.sourceRefs,
  }));
  return [...input.preflightDisqualifications.filter((dq) => dq.code === "DQ-01"), ...parserDqs];
}

export function detectDQ02(input: DQDetectorInput): Disqualification[] {
  return blockers(input)
    .filter((blocker) => blocker.sourceRefs.length === 0)
    .map((blocker) => ({
      code: "DQ-02" as DisqualificationCode,
      message: `Blocker "${blocker.message}" has no sourceRefs`,
      nodeIds: blocker.riskIds,
      sourceRefs: [] as SourceRef[],
    }));
}

export function detectDQ03(input: DQDetectorInput): Disqualification[] {
  return input.graph.completeness.unsupportedClaims
    .filter((claim) => claim.gateRelevant)
    .map((claim) => ({
      code: "DQ-03" as DisqualificationCode,
      message: `Unsupported claim: ${claim.claim}`,
      nodeIds: claim.nodeIds,
      sourceRefs: [] as SourceRef[],
    }));
}

export function detectDQ04(input: DQDetectorInput): Disqualification[] {
  const disqualifications: Disqualification[] = [];

  for (const risk of riskNodes(input)) {
    if ((risk.priority === "P0" || risk.priority === "P1") && risk.evidenceGap > 0.5) {
      const hasWaiver = input.validWaivers.some((waiver) => waiver.linkedRiskIds.includes(risk.id));
      const hasReviewerNote = input.evidencePackage?.manualEvidence.some(
        (manual) => manual.traceTo.includes(risk.id) && manual.reviewerNote
      );
      if (!hasWaiver && !hasReviewerNote) {
        disqualifications.push({
          code: "DQ-04" as DisqualificationCode,
          message: `P0/P1 risk "${risk.title}" with oracle gap treated as fact`,
          nodeIds: [risk.id],
          sourceRefs: risk.traceability.sourceRefs,
        });
      }
    }
  }

  return disqualifications;
}

export function detectDQ05(input: DQDetectorInput): Disqualification[] {
  const disqualifications: Disqualification[] = [];

  for (const changedCode of changedCodeNodes(input)) {
    if (input.placementPlan) {
      const hasTestPlacement = input.placementPlan.placements.some(
        (placement) => placement.disposition !== "blocked"
      );
      const hasAcceptedWaiver = input.waivers.some((waiver) => waiver.valid);
      if (!hasTestPlacement && !hasAcceptedWaiver) {
        disqualifications.push({
          code: "DQ-05" as DisqualificationCode,
          message: `Changed code "${changedCode.path}" without test obligation or waiver`,
          nodeIds: [changedCode.id],
          sourceRefs: changedCode.traceability.sourceRefs,
        });
      }
    } else {
      disqualifications.push({
        code: "DQ-05" as DisqualificationCode,
        message: `Changed code "${changedCode.path}" without test obligation or waiver`,
        nodeIds: [changedCode.id],
        sourceRefs: changedCode.traceability.sourceRefs,
      });
    }
  }

  return disqualifications;
}

export function detectDQ06(input: DQDetectorInput): Disqualification[] {
  return input.preflightDisqualifications.filter((dq) => dq.code === "DQ-06");
}

export function detectDQ07(input: DQDetectorInput): Disqualification | null {
  if (input.graph.completeness.partial && !input.graph.completeness.score) {
    return {
      code: "DQ-07" as DisqualificationCode,
      message: "Partial graph without explicit completeness score",
      nodeIds: [],
      sourceRefs: [] as SourceRef[],
    };
  }
  return null;
}
