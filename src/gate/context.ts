import type {
  ChangedCodeNode,
  Disqualification,
  EvidencePackage,
  GateBlocker,
  GatePolicy,
  GateResult,
  QualityEvidenceGraph,
  QegMetadata,
  QegNode,
  RiskNode,
  StableId,
  TestPlacementNode,
  TestPlacementPlan,
  Waiver,
} from "../types.js";

export interface GateEvaluationInput {
  metadata: QegMetadata;
  graph: QualityEvidenceGraph;
  policy: GatePolicy;
  waivers: readonly Waiver[];
  evidencePackage?: EvidencePackage;
  placementPlan?: TestPlacementPlan;
  preflightDisqualifications?: readonly Disqualification[];
  executionTime?: Date;
}

export interface DQDetectorInput {
  metadata: QegMetadata;
  graph: QualityEvidenceGraph;
  policy: GatePolicy;
  waivers: readonly Waiver[];
  evidencePackage: EvidencePackage | undefined;
  placementPlan: TestPlacementPlan | undefined;
  validWaivers: readonly Waiver[];
  preflightDisqualifications: readonly Disqualification[];
  riskNodes?: readonly RiskNode[];
  changedCodeNodes?: readonly ChangedCodeNode[];
  testPlacementNodes?: readonly TestPlacementNode[];
  waiverRiskIds?: ReadonlySet<StableId>;
  blockers?: readonly GateBlocker[];
  evidencePackageText?: string;
}

export interface GateEvaluationContext extends DQDetectorInput {
  riskNodes: readonly RiskNode[];
  changedCodeNodes: readonly ChangedCodeNode[];
  testPlacementNodes: readonly TestPlacementNode[];
  waiverRiskIds: ReadonlySet<StableId>;
  blockers: readonly GateBlocker[];
}

export type DQDetector = (input: DQDetectorInput) => Disqualification[] | Disqualification | null;

function isRiskNode(node: QegNode): node is RiskNode {
  return node.kind === "risk";
}

function isChangedCodeNode(node: QegNode): node is ChangedCodeNode {
  return node.kind === "changed_code";
}

function isTestPlacementNode(node: QegNode): node is TestPlacementNode {
  return node.kind === "test_placement";
}

export function buildBlockers(riskNodes: readonly RiskNode[]): GateBlocker[] {
  const blockers: GateBlocker[] = [];

  for (const risk of riskNodes) {
    if ((risk.severity === "critical" || risk.severity === "high") && risk.evidenceGap > 0.5) {
      blockers.push({
        id: `blocker-${risk.id}`,
        message: `High/critical risk "${risk.title}" with evidence gap`,
        riskIds: [risk.id],
        sourceRefs: risk.traceability.sourceRefs,
      });
    }
  }

  return blockers;
}

export function createGateEvaluationContext(
  input: GateEvaluationInput,
  validWaivers: readonly Waiver[]
): GateEvaluationContext {
  const riskNodes = input.graph.nodes.filter(isRiskNode);
  const changedCodeNodes = input.graph.nodes.filter(isChangedCodeNode);
  const testPlacementNodes = input.graph.nodes.filter(isTestPlacementNode);
  const waiverRiskIds = new Set(validWaivers.flatMap((waiver) => waiver.linkedRiskIds));

  return {
    metadata: input.metadata,
    graph: input.graph,
    policy: input.policy,
    waivers: input.waivers,
    evidencePackage: input.evidencePackage,
    placementPlan: input.placementPlan,
    preflightDisqualifications: input.preflightDisqualifications ?? [],
    validWaivers,
    riskNodes,
    changedCodeNodes,
    testPlacementNodes,
    waiverRiskIds,
    blockers: buildBlockers(riskNodes),
  };
}

export function getEvidencePackageText(input: DQDetectorInput): string {
  if (!input.evidencePackage) {
    return "";
  }

  input.evidencePackageText ??= JSON.stringify(input.evidencePackage);
  return input.evidencePackageText;
}

export interface EvaluatedGateParts {
  gate: GateResult;
  context: GateEvaluationContext;
}
