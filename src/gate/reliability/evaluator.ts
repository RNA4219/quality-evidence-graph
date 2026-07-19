import type {
  Disqualification,
  GateBlocker,
  ResilienceExecutionEvidenceNode,
} from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import { buildReliabilityAccounting } from "./accounting.js";
import { evidenceBlockers, safetyBlockers } from "./blockers.js";
import type {
  EvidenceSelection,
  ReliabilityDrillDownSeed,
  ReliabilityEvaluation,
} from "./contracts.js";
import { buildReliabilityIndex } from "./indexing.js";
import { globalQualificationDqs, qualifyEvidence } from "./qualification.js";
import { selectEvidence } from "./selection.js";
import {
  dq,
  isPassing,
  sortBlockers,
  sortDisqualifications,
} from "./utils.js";

export function evaluateReliability(
  input: DQDetectorInput,
): ReliabilityEvaluation {
  if (!input.policy.reliabilityPolicy) {
    return {
      accounting: { enabled: false },
      disqualifications: [],
      blockers: [],
    };
  }

  const index = buildReliabilityIndex(input);
  const disqualifications: Disqualification[] = [
    ...globalQualificationDqs(input),
  ];
  const blockers: GateBlocker[] = [];
  const drillDown: ReliabilityDrillDownSeed[] = [];
  const selectionByTest = new Map<string, EvidenceSelection>();
  const qualificationByTest = new Map<string, readonly Disqualification[]>();
  const selectedByTest = new Map<string, ResilienceExecutionEvidenceNode>();
  const emittedTestDqs = new Set<string>();
  const qualifiedRiskIds = new Set<string>();
  const passingRiskIds = new Set<string>();

  for (const risk of index.requiredRisks) {
    const tests = index.testsByRiskId.get(risk.id) ?? [];
    if (tests.length === 0) {
      const mockOnly = index.resilienceTests.some(
        (test) =>
          !test.deleted &&
          test.coveredRiskIds.includes(risk.id) &&
          test.testExecutionMode === "mock",
      );
      disqualifications.push(
        dq(
          "DQ-18",
          mockOnly
            ? "Required risk has only mock resilience tests"
            : "Required risk has no real resilience test",
          [risk.id],
        ),
      );
      continue;
    }

    let riskQualified = true;
    let riskPassing = true;
    for (const test of tests) {
      let selection = selectionByTest.get(test.id);
      if (!selection) {
        selection = selectEvidence(input, test);
        selectionByTest.set(test.id, selection);
        if (selection.evidence) {
          selectedByTest.set(test.id, selection.evidence);
        }
      }
      const evidence = selection.evidence;
      let localDqs = qualificationByTest.get(test.id);
      if (!localDqs) {
        localDqs = evidence ? qualifyEvidence(input, test, evidence) : [];
        qualificationByTest.set(test.id, localDqs);
      }
      const localBlockers =
        evidence &&
        selection.disqualifications.length === 0 &&
        localDqs.length === 0
          ? evidenceBlockers(input, risk.id, test, evidence)
          : [];

      if (!emittedTestDqs.has(test.id)) {
        disqualifications.push(...selection.disqualifications, ...localDqs);
        emittedTestDqs.add(test.id);
      }
      blockers.push(...localBlockers);

      const qualified =
        evidence !== undefined &&
        selection.disqualifications.length === 0 &&
        localDqs.length === 0;
      const passing =
        qualified &&
        isPassing(evidence) &&
        localBlockers.every((item) => item.effective === false);
      if (!qualified) riskQualified = false;
      if (!passing) riskPassing = false;

      drillDown.push({
        riskId: risk.id,
        testId: test.id,
        ...(evidence ? { evidence } : {}),
        selectionReason: evidence
          ? "latest_current_execution"
          : "no_selectable_current_execution",
        ...(selection.exclusionReason
          ? { exclusionReason: selection.exclusionReason }
          : {}),
        disqualificationCodes: [
          ...new Set(
            [...selection.disqualifications, ...localDqs].map(
              (item) => item.code,
            ),
          ),
        ],
        blockerIds: localBlockers.map((item) => item.id),
      });
    }
    if (riskQualified) qualifiedRiskIds.add(risk.id);
    if (riskQualified && riskPassing) passingRiskIds.add(risk.id);
  }

  const safety = safetyBlockers(input, index);
  blockers.push(...safety);
  const sortedDqs = sortDisqualifications(disqualifications);
  const sortedBlockers = sortBlockers(blockers);
  return {
    accounting: buildReliabilityAccounting({
      input,
      index,
      selectedByTest,
      disqualifications: sortedDqs,
      blockers: sortedBlockers,
      safetyBlockers: safety,
      drillDown,
      qualifiedRiskIds,
      passingRiskIds,
    }),
    disqualifications: sortedDqs,
    blockers: sortedBlockers,
  };
}
