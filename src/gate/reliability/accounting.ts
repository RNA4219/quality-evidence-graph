import type {
  Disqualification,
  GateBlocker,
  ReliabilityAccounting,
  ReliabilityDrillDown,
  ResilienceExecutionEvidenceNode,
} from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import type {
  ReliabilityDrillDownSeed,
  ReliabilityIndex,
} from "./contracts.js";
import {
  isPassing,
  lexicalCompare,
  nearestRank,
  uniqueNodeIds,
} from "./utils.js";

export interface AccountingStageInput {
  readonly input: DQDetectorInput;
  readonly index: ReliabilityIndex;
  readonly selectedByTest: ReadonlyMap<string, ResilienceExecutionEvidenceNode>;
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
  readonly safetyBlockers: readonly GateBlocker[];
  readonly drillDown: readonly ReliabilityDrillDownSeed[];
  readonly qualifiedRiskIds: ReadonlySet<string>;
  readonly passingRiskIds: ReadonlySet<string>;
}

export function buildReliabilityAccounting(
  stage: AccountingStageInput,
): ReliabilityAccounting {
  const {
    input,
    index,
    selectedByTest,
    disqualifications,
    blockers,
    safetyBlockers,
    qualifiedRiskIds,
    passingRiskIds,
  } = stage;
  const selected = [...selectedByTest.values()].sort((left, right) =>
    lexicalCompare(left.id, right.id)
  );
  const unsafeRiskIds = new Set(
    blockers
      .filter(
        (item) => item.ruleId === "BLK-REL-04" && item.effective !== false,
      )
      .flatMap((item) => item.riskIds),
  );
  const effectiveBlockerTestIds = new Set(
    blockers
      .filter((item) => item.effective !== false && item.testId !== undefined)
      .map((item) => item.testId),
  );
  const dqNodeIds = new Set(uniqueNodeIds(disqualifications));
  const globallyDisqualified =
    !input.evidenceVerification ||
    input.evidenceVerification.status === "fail" ||
    input.preflightDisqualifications.some(
      (item) => item.code === "DQ-01" || item.code === "DQ-06",
    ) ||
    disqualifications.some(
      (item) => item.code === "DQ-21" && item.nodeIds.length === 0,
    );
  const qualifiedSelected = globallyDisqualified
    ? []
    : selected.filter(
        (evidence) =>
          !dqNodeIds.has(evidence.id) && !dqNodeIds.has(evidence.testId),
      );
  const passingSelected = qualifiedSelected.filter(
    (evidence) =>
      isPassing(evidence) && !effectiveBlockerTestIds.has(evidence.testId),
  );
  const recoverySeconds = qualifiedSelected
    .filter(
      (evidence) =>
        evidence.recovered === true &&
        evidence.recoveryDurationMs !== undefined,
    )
    .map((evidence) => (evidence.recoveryDurationMs ?? 0) / 1000);
  const evidenceAgeHours: Record<string, number> = {};
  for (const evidence of selected) {
    const age =
      (Date.parse(input.metadata.createdAt) - Date.parse(evidence.endedAt)) /
      3_600_000;
    if (Number.isFinite(age) && age >= 0) {
      evidenceAgeHours[evidence.id] = age;
    }
  }
  const countBy = (
    code: "DQ-12" | "DQ-18" | "DQ-19" | "DQ-20" | "DQ-21",
  ): number => disqualifications.filter((item) => item.code === code).length;
  const qualifiedRiskCount = globallyDisqualified ? 0 : qualifiedRiskIds.size;
  const passingRiskCount = globallyDisqualified
    ? 0
    : [...passingRiskIds].filter((riskId) => !unsafeRiskIds.has(riskId)).length;

  const finalDrillDown: ReliabilityDrillDown[] = [...stage.drillDown]
    .sort(
      (left, right) =>
        lexicalCompare(left.riskId, right.riskId) ||
        lexicalCompare(left.testId, right.testId),
    )
    .map((item) => {
      const evidence = item.evidence;
      const safetyIds = safetyBlockers
        .filter(
          (blocker) =>
            blocker.testId === item.testId &&
            blocker.riskIds.includes(item.riskId),
        )
        .map((blocker) => blocker.id);
      return {
        riskId: item.riskId,
        testId: item.testId,
        ...(evidence
          ? {
              selectedEvidenceId: evidence.id,
              adapter: evidence.adapter,
              experimentId: evidence.experimentId,
              attempt: evidence.attempt,
              targetRevision: evidence.targetRevision,
              environmentId: evidence.environmentId,
            }
          : {}),
        selectionReason: item.selectionReason,
        ...(item.exclusionReason
          ? { exclusionReason: item.exclusionReason }
          : {}),
        disqualificationCodes: [...new Set(item.disqualificationCodes)].sort(),
        blockerIds: [...new Set([...item.blockerIds, ...safetyIds])].sort(
          lexicalCompare,
        ),
      };
    });

  return {
    enabled: true,
    requiredRiskCount: index.requiredRisks.length,
    qualifiedRiskCount,
    passingRiskCount,
    riskCoverageRate:
      index.requiredRisks.length === 0
        ? null
        : qualifiedRiskCount / index.requiredRisks.length,
    requiredExecutionCount: new Set(stage.drillDown.map((item) => item.testId)).size,
    qualifiedExecutionCount: qualifiedSelected.length,
    passingExecutionCount: passingSelected.length,
    resiliencePassRate:
      qualifiedSelected.length === 0
        ? null
        : passingSelected.length / qualifiedSelected.length,
    recoverySecondsP50: nearestRank(recoverySeconds, 50),
    recoverySecondsP95: nearestRank(recoverySeconds, 95),
    recoverySampleCount: recoverySeconds.length,
    duplicateSideEffectsCount: selected.reduce(
      (sum, evidence) =>
        sum + (evidence.observed?.duplicateSideEffects ?? 0),
      0,
    ),
    dataInconsistenciesCount: selected.reduce(
      (sum, evidence) =>
        sum + (evidence.observed?.dataInconsistencies ?? 0),
      0,
    ),
    evidenceAgeHours,
    excludedMockTests: index.excludedMockTests,
    dqCountByRule: {
      "DQ-12": countBy("DQ-12"),
      "DQ-18": countBy("DQ-18"),
      "DQ-19": countBy("DQ-19"),
      "DQ-20": countBy("DQ-20"),
      "DQ-21": countBy("DQ-21"),
    },
    drillDown: finalDrillDown,
  };
}
