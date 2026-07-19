import type {
  Disqualification,
  GateBlocker,
  ReliabilityAccounting,
  ReliabilityDrillDown,
  ResilienceExecutionEvidenceNode,
  ResilienceTestNode,
  SignalSemanticRole,
  SourceRef,
  TestNode,
} from "../types.js";
import type { DQDetectorInput } from "./context.js";

export interface ReliabilityEvaluation {
  readonly accounting: ReliabilityAccounting;
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
}

const RELIABILITY_REF: SourceRef = {
  id: "qeg:reliability-extension",
  path: "docs/spec/reliability-extension.md",
};

function isResilienceTest(node: TestNode): node is ResilienceTestNode {
  return node.testType === "resilience" && node.resilienceScenario !== undefined;
}

function isResilienceEvidence(node: unknown): node is ResilienceExecutionEvidenceNode {
  return Boolean(node) && typeof node === "object" &&
    (node as { kind?: string }).kind === "execution_evidence" &&
    (node as { evidenceType?: string }).evidenceType === "resilience";
}

function dq(code: Disqualification["code"], message: string, nodeIds: readonly string[]): Disqualification {
  return { code, message, nodeIds, sourceRefs: [RELIABILITY_REF] };
}

function isFullGitObjectId(value: string | undefined): boolean {
  return Boolean(value && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value));
}

function isSha256(value: string | undefined): boolean {
  return Boolean(value && /^sha256:[a-f0-9]{64}$/.test(value));
}

function sameNumber(left: number | undefined, right: number | undefined): boolean {
  return left !== undefined && right !== undefined && Math.abs(left - right) < 1e-9;
}

function nearestRank(values: readonly number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((percentile / 100) * sorted.length) - 1] ?? null;
}

function uniqueNodeIds(disqualifications: readonly Disqualification[]): readonly string[] {
  return [...new Set(disqualifications.flatMap((item) => item.nodeIds))];
}

function decisionFingerprint(evidence: ResilienceExecutionEvidenceNode): string {
  // Node title/ID/source labels are audit decoration and must not affect a
  // selection decision.  Everything that can change the Gate outcome does.
  return JSON.stringify({
    testId: evidence.testId,
    adapter: evidence.adapter,
    adapterVersion: evidence.adapterVersion,
    experimentId: evidence.experimentId,
    attempt: evidence.attempt,
    targetRevision: evidence.targetRevision,
    environment: evidence.environment,
    status: evidence.status,
    passed: evidence.passed,
    steadyStateConfirmed: evidence.steadyStateConfirmed,
    fault: evidence.fault,
    abortRecord: evidence.abortRecord,
    recovered: evidence.recovered,
    recoveryConfirmedAt: evidence.recoveryConfirmedAt,
    recoveryDurationMs: evidence.recoveryDurationMs,
    observed: evidence.observed,
    signalManifest: evidence.signalManifest,
    rawArtifactRef: evidence.rawArtifactRef,
  });
}

function hasValidRelWaiver(
  input: DQDetectorInput,
  riskId: string,
  testId: string
): string | undefined {
  return input.validWaivers.find(
    (waiver) => waiver.linkedRiskIds.includes(riskId) &&
      Boolean(waiver.linkedTestIds?.includes(testId))
  )?.id;
}

function blocker(
  ruleId: GateBlocker["ruleId"],
  riskId: string,
  testId: string,
  evidenceId: string | undefined,
  message: string,
  waiverId?: string
): GateBlocker {
  const unwaivable = ruleId === "BLK-REL-04";
  return {
    id: ["blocker", "rel", ruleId?.slice(-2) ?? "00", riskId, testId, evidenceId ?? "none"].join(":"),
    message,
    riskIds: [riskId],
    sourceRefs: [RELIABILITY_REF],
    ruleId,
    testId,
    ...(evidenceId ? { evidenceId } : {}),
    effective: unwaivable || !waiverId,
    ...(!unwaivable && waiverId ? { waiverId } : {}),
  };
}

function metricValue(
  evidence: ResilienceExecutionEvidenceNode,
  role: SignalSemanticRole
): number | undefined {
  const metrics = evidence.signalManifest?.metrics ?? [];
  return metrics.find((metric) => metric.phase === "fault" && metric.semanticRole === role)?.observedValue;
}

function abortTriggered(condition: ResilienceTestNode["resilienceScenario"]["abortConditions"][number], observed: number): boolean {
  switch (condition.operator) {
    case "gt": return observed > condition.threshold;
    case "gte": return observed >= condition.threshold;
    case "lt": return observed < condition.threshold;
    case "lte": return observed <= condition.threshold;
    case "eq": return observed === condition.threshold;
    case "ne": return observed !== condition.threshold;
  }
}

function evidenceIntegrityDqs(
  input: DQDetectorInput,
  evidence: ResilienceExecutionEvidenceNode
): Disqualification[] {
  const head = input.metadata.headRef;
  const mismatches: string[] = [];
  if (!head || evidence.targetRevision !== head) mismatches.push("targetRevision");
  if (evidence.rawArtifactRef.revision !== head) mismatches.push("rawArtifactRef.revision");
  for (const ref of evidence.evidenceRefs) {
    if (ref.revision !== head) mismatches.push(`evidenceRef:${ref.id}`);
  }
  if (mismatches.length === 0) return [];
  return [dq("DQ-12", `Resilience evidence revision mismatch (${mismatches.join(", ")})`, [evidence.id])];
}

function policyIntegrityDqs(input: DQDetectorInput): Disqualification[] {
  const { metadata, graph, policy } = input;
  const valuesMatch =
    metadata.profile === policy.profile &&
    graph.metadata.profile === policy.profile &&
    metadata.policyId === policy.policyId &&
    graph.metadata.policyId === policy.policyId &&
    metadata.policyHash === policy.policyHash &&
    graph.metadata.policyHash === policy.policyHash &&
    metadata.headRef === graph.metadata.headRef;
  if (
    !isFullGitObjectId(metadata.headRef) ||
    !isFullGitObjectId(graph.metadata.headRef) ||
    !isSha256(policy.policyHash) ||
    !isSha256(metadata.policyHash) ||
    !isSha256(graph.metadata.policyHash) ||
    !valuesMatch
  ) {
    return [dq("DQ-21", "Reliability policy identity, SHA-256 hash, profile, or full revision does not match across Gate, graph, and policy", [])];
  }
  return [];
}

function lifecycleDqs(
  input: DQDetectorInput,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode
): Disqualification[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const evaluationMs = Date.parse(input.metadata.createdAt);
  const start = Date.parse(evidence.startedAt);
  const end = Date.parse(evidence.endedAt);
  const ageMs = evaluationMs - end;
  const scenario = test.resilienceScenario;
  const reasons: string[] = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end > evaluationMs) reasons.push("invalid or future execution timestamps");
  if (Number.isFinite(ageMs) && ageMs > policy.maxEvidenceAgeHours * 60 * 60 * 1000) reasons.push("evidence exceeds maximum age");
  if (evidence.environment !== policy.requiredEnvironment) reasons.push("environment differs from requiredEnvironment");
  if (policy.requireSteadyStateBeforeFault && evidence.steadyStateConfirmed !== true) reasons.push("steady state is not confirmed");
  if (!evidence.fault || evidence.fault.type !== scenario.faultModel) reasons.push("fault is absent or differs from scenario");
  if (evidence.fault && (Date.parse(evidence.fault.faultStartedAt) < start || Date.parse(evidence.fault.faultEndedAt) > end || Date.parse(evidence.fault.faultStartedAt) > Date.parse(evidence.fault.faultEndedAt))) reasons.push("fault interval is outside execution");
  if (evidence.status === "aborted") {
    const condition = scenario.abortConditions.find((item) => item.id === evidence.abortRecord?.conditionId);
    if (!evidence.abortRecord || !condition || !abortTriggered(condition, evidence.abortRecord.observedValue)) reasons.push("abort record is absent or does not satisfy its condition");
  }
  return reasons.length > 0 ? [dq("DQ-18", `Resilience lifecycle invalid: ${reasons.join("; ")}`, [evidence.id, test.id])] : [];
}

function signalDqs(
  input: DQDetectorInput,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode
): Disqualification[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const scenario = test.resilienceScenario;
  const manifest = evidence.signalManifest;
  const reasons: string[] = [];
  if (!manifest) return [dq("DQ-20", "Resilience signalManifest is missing", [evidence.id, test.id])];
  const refs = new Map(evidence.evidenceRefs.map((ref) => [ref.id, ref]));
  const signalRefs = [...manifest.metrics, ...manifest.traces, ...manifest.logs].map((signal) => refs.get(signal.evidenceRefId));
  if (signalRefs.some((ref) => !ref || !ref.contentHash || ref.revision !== input.metadata.headRef)) reasons.push("signal reference is missing, unhashed, or revision-mismatched");
  if (policy.requiredSignals.metrics && manifest.metrics.length === 0) reasons.push("policy requires metrics");
  for (const requiredMetric of scenario.steadyState.requiredMetrics) {
    if (!manifest.metrics.some((metric) => metric.metricName === requiredMetric)) reasons.push(`required metric ${requiredMetric} is missing`);
  }
  for (const slo of scenario.steadyState.slos) {
    for (const phase of slo.evaluationPhases) {
      if (!manifest.metrics.some((metric) => metric.metricName === slo.metricName && metric.semanticRole === slo.semanticRole && metric.phase === phase)) {
        reasons.push(`SLO ${slo.name} has no ${phase} signal`);
      }
    }
  }
  if ((policy.requiredSignals.traces || scenario.steadyState.requiredTraces) && manifest.traces.length === 0) reasons.push("required traces are missing");
  if ((policy.requiredSignals.logs || scenario.steadyState.requiredLogs) && manifest.logs.length === 0) reasons.push("required logs are missing");
  const observed = evidence.observed;
  if (!observed) reasons.push("observed summary is missing");
  if (observed) {
    const expected: readonly [SignalSemanticRole, number][] = [
      ["traffic_count", observed.requestCount], ["error_rate", observed.errorRate], ["latency_p95", observed.latencyP95Ms],
      ["saturation", observed.saturationPct], ["duplicate_side_effects", observed.duplicateSideEffects], ["data_inconsistencies", observed.dataInconsistencies],
    ];
    for (const [role, value] of expected) {
      const measured = metricValue(evidence, role);
      if (measured !== undefined && !sameNumber(measured, value)) reasons.push(`observed ${role} differs from signal manifest`);
    }
  }
  return reasons.length > 0 ? [dq("DQ-20", `Resilience signals invalid: ${[...new Set(reasons)].join("; ")}`, [evidence.id, test.id])] : [];
}

function safetyBlockers(input: DQDetectorInput, testsById: ReadonlyMap<string, ResilienceTestNode>): GateBlocker[] {
  const policy = input.policy.reliabilityPolicy;
  const head = input.metadata.headRef;
  if (!policy || !head) return [];
  const blockers: GateBlocker[] = [];
  for (const candidate of input.graph.nodes.filter(isResilienceEvidence)) {
    const test = testsById.get(candidate.testId);
    if (!test || test.testExecutionMode !== "real" || candidate.targetRevision !== head) continue;
    const violation =
      candidate.environment === "production" ||
      !policy.safety.allowedEnvironments.includes(candidate.environment as never) ||
      !candidate.fault ||
      candidate.fault.actualTargetIds.length > policy.safety.maxBlastRadiusTargets ||
      candidate.fault.appliedDurationMs > policy.safety.maxFaultDurationSeconds * 1000 ||
      candidate.environment !== test.resilienceScenario.blastRadius.environment ||
      candidate.fault.actualTargetIds.length > test.resilienceScenario.blastRadius.maxTargets ||
      candidate.fault.actualTargetIds.some((targetId) => !test.resilienceScenario.blastRadius.allowedTargets.includes(targetId)) ||
      candidate.fault.appliedDurationMs > test.resilienceScenario.blastRadius.maxDurationSeconds * 1000;
    if (violation) {
      const riskId = test.coveredRiskIds[0] ?? test.id;
      blockers.push(blocker("BLK-REL-04", riskId, test.id, candidate.id, "Safety policy violated by a current real resilience attempt"));
    }
  }
  return blockers;
}

function selectedEvidence(
  input: DQDetectorInput,
  test: ResilienceTestNode
): { evidence?: ResilienceExecutionEvidenceNode; disqualifications: Disqualification[]; exclusionReason?: string } {
  const all = input.graph.nodes.filter(isResilienceEvidence).filter((evidence) => evidence.testId === test.id);
  const current = all.filter((evidence) => evidence.targetRevision === input.metadata.headRef);
  if (current.length === 0) {
    const revisionDqs = all.flatMap((evidence) => evidenceIntegrityDqs(input, evidence));
    return { disqualifications: revisionDqs.length > 0 ? revisionDqs : [dq("DQ-18", "No current resilience evidence exists for required test", [test.id])], exclusionReason: "no_current_real_evidence" };
  }
  const newestTime = Math.max(...current.map((evidence) => Date.parse(evidence.endedAt)));
  const newest = current.filter((evidence) => Date.parse(evidence.endedAt) === newestTime);
  const fingerprints = new Set(newest.map(decisionFingerprint));
  if (fingerprints.size > 1) {
    return { disqualifications: [dq("DQ-19", "Latest current resilience evidence has conflicting decision fingerprints", newest.map((evidence) => evidence.id))], exclusionReason: "ambiguous_latest_evidence" };
  }
  return { evidence: [...newest].sort((left, right) => left.id.localeCompare(right.id))[0], disqualifications: [] };
}

function blockersForEvidence(
  input: DQDetectorInput,
  riskId: string,
  test: ResilienceTestNode,
  evidence: ResilienceExecutionEvidenceNode
): GateBlocker[] {
  const policy = input.policy.reliabilityPolicy;
  if (!policy) return [];
  const waiverId = hasValidRelWaiver(input, riskId, test.id);
  const threshold = policy.thresholds;
  const observed = evidence.observed;
  const blockers: GateBlocker[] = [];
  if (observed && (
    observed.requestCount < threshold.minRequestCount ||
    observed.errorRate > threshold.maxErrorRate ||
    observed.latencyP95Ms > threshold.maxLatencyP95Ms ||
    observed.saturationPct > threshold.maxSaturationPct ||
    observed.duplicateSideEffects > threshold.maxDuplicateSideEffects ||
    observed.dataInconsistencies > threshold.maxDataInconsistencies
  )) blockers.push(blocker("BLK-REL-01", riskId, test.id, evidence.id, "Resilience SLO threshold exceeded", waiverId));
  if (policy.requireRecoveryObservation && (
    evidence.recovered !== true || evidence.recoveryDurationMs === undefined || evidence.recoveryDurationMs > threshold.maxRecoverySeconds * 1000
  )) blockers.push(blocker("BLK-REL-02", riskId, test.id, evidence.id, "Recovery is absent or exceeds the resilience threshold", waiverId));
  if (evidence.status !== "pass" || evidence.passed !== true) blockers.push(blocker("BLK-REL-03", riskId, test.id, evidence.id, `Resilience execution status is ${evidence.status}`, waiverId));
  return blockers;
}

export function evaluateReliability(input: DQDetectorInput): ReliabilityEvaluation {
  if (!input.policy.reliabilityPolicy) return { accounting: { enabled: false }, disqualifications: [], blockers: [] };
  const policy = input.policy.reliabilityPolicy;
  const allTests = input.graph.nodes.filter((node): node is TestNode => node.kind === "test");
  const resilienceTests = allTests.filter(isResilienceTest);
  const testsById = new Map(resilienceTests.map((test) => [test.id, test]));
  const requiredRisks = (input.riskNodes ?? input.graph.nodes.filter((node) => node.kind === "risk"))
    .filter((risk) => policy.requiredForSeverities.includes(risk.severity));
  const excludedMockTests = resilienceTests.filter((test) => test.testExecutionMode === "mock").map((test) => ({ testId: test.id, reason: "mock_test" as const, sourceRefs: test.traceability.sourceRefs }));
  const disqualifications: Disqualification[] = [...policyIntegrityDqs(input)];
  const blockers: GateBlocker[] = [];
  const drillDown: ReliabilityDrillDown[] = [];
  const selectedByTest = new Map<string, ResilienceExecutionEvidenceNode>();
  const qualifiedRiskIds = new Set<string>();
  const passingRiskIds = new Set<string>();

  if (!input.evidenceVerification || input.evidenceVerification.status === "fail") {
    disqualifications.push(dq("DQ-06", "Reliability policy is enabled but artifact verification report is missing or failed", []));
  }

  for (const risk of requiredRisks) {
    const tests = resilienceTests.filter((test) => !test.deleted && test.coveredRiskIds.includes(risk.id) && test.testExecutionMode === "real");
    if (tests.length === 0) {
      const mockOnly = resilienceTests.some((test) => !test.deleted && test.coveredRiskIds.includes(risk.id));
      disqualifications.push(dq("DQ-18", mockOnly ? "Required risk has only mock resilience tests" : "Required risk has no real resilience test", [risk.id]));
      continue;
    }
    let riskQualified = true;
    let riskPassing = true;
    for (const test of tests) {
      let selection = selectedByTest.get(test.id) ? { evidence: selectedByTest.get(test.id), disqualifications: [] as Disqualification[] } : selectedEvidence(input, test);
      if (selection.evidence) selectedByTest.set(test.id, selection.evidence);
      disqualifications.push(...selection.disqualifications);
      const evidence = selection.evidence;
      const localDqs: Disqualification[] = [];
      const localBlockers: GateBlocker[] = [];
      if (evidence) {
        const integrity = evidenceIntegrityDqs(input, evidence);
        localDqs.push(...integrity);
        if (integrity.length === 0) {
          const lifecycle = lifecycleDqs(input, test, evidence);
          localDqs.push(...lifecycle);
          if (lifecycle.length === 0) localDqs.push(...signalDqs(input, test, evidence));
        }
        localBlockers.push(...blockersForEvidence(input, risk.id, test, evidence));
      }
      if (!evidence || localDqs.length > 0 || selection.disqualifications.length > 0) riskQualified = false;
      if (!evidence || localDqs.length > 0 || selection.disqualifications.length > 0 || evidence.status !== "pass" || evidence.passed !== true || localBlockers.some((item) => item.effective !== false)) riskPassing = false;
      disqualifications.push(...localDqs);
      blockers.push(...localBlockers);
      drillDown.push({
        riskId: risk.id,
        testId: test.id,
        ...(evidence ? { selectedEvidenceId: evidence.id, adapter: evidence.adapter, experimentId: evidence.experimentId, attempt: evidence.attempt, targetRevision: evidence.targetRevision, environmentId: evidence.environmentId } : {}),
        selectionReason: evidence ? "latest_current_execution" : "no_selectable_current_execution",
        ...(selection.exclusionReason ? { exclusionReason: selection.exclusionReason } : {}),
        disqualificationCodes: [...new Set([...selection.disqualifications, ...localDqs].map((item) => item.code))],
        blockerIds: localBlockers.map((item) => item.id),
      });
    }
    if (riskQualified) qualifiedRiskIds.add(risk.id);
    if (riskQualified && riskPassing) passingRiskIds.add(risk.id);
  }
  blockers.push(...safetyBlockers(input, testsById));
  const selected = [...selectedByTest.values()];
  const unsafeRiskIds = new Set(blockers.filter((item) => item.ruleId === "BLK-REL-04" && item.effective !== false).flatMap((item) => item.riskIds));
  const effectiveBlockerTestIds = new Set(blockers.filter((item) => item.effective !== false).map((item) => item.testId));
  const dqEvidenceIds = new Set(uniqueNodeIds(disqualifications));
  const passingSelected = selected.filter((evidence) => evidence.status === "pass" && evidence.passed === true && !effectiveBlockerTestIds.has(evidence.testId));
  const recoverySeconds = selected
    .filter((evidence) => evidence.status === "pass" && evidence.passed === true && evidence.recoveryDurationMs !== undefined && !dqEvidenceIds.has(evidence.id))
    .map((evidence) => (evidence.recoveryDurationMs ?? 0) / 1000);
  const evidenceAgeHours: Record<string, number> = {};
  for (const evidence of selected) evidenceAgeHours[evidence.id] = Math.max(0, (Date.parse(input.metadata.createdAt) - Date.parse(evidence.endedAt)) / 3_600_000);
  const countBy = (code: "DQ-12" | "DQ-18" | "DQ-19" | "DQ-20" | "DQ-21") => disqualifications.filter((item) => item.code === code).length;
  const uniqueDqs = disqualifications.filter((item, index, all) => all.findIndex((candidate) => candidate.code === item.code && candidate.message === item.message && candidate.nodeIds.join("\u0000") === item.nodeIds.join("\u0000")) === index);
  return {
    accounting: {
      enabled: true,
      requiredRiskCount: requiredRisks.length,
      qualifiedRiskCount: qualifiedRiskIds.size,
      passingRiskCount: [...passingRiskIds].filter((riskId) => !unsafeRiskIds.has(riskId)).length,
      riskCoverageRate: requiredRisks.length === 0 ? null : qualifiedRiskIds.size / requiredRisks.length,
      requiredExecutionCount: new Set(drillDown.map((item) => item.testId)).size,
      qualifiedExecutionCount: selected.filter((evidence) => !uniqueDqs.some((item) => item.nodeIds.includes(evidence.id))).length,
      passingExecutionCount: passingSelected.length,
      resiliencePassRate: selected.length === 0 ? null : passingSelected.length / selected.length,
      recoverySecondsP50: nearestRank(recoverySeconds, 50),
      recoverySecondsP95: nearestRank(recoverySeconds, 95),
      recoverySampleCount: recoverySeconds.length,
      duplicateSideEffectsCount: selected.reduce((sum, evidence) => sum + (evidence.observed?.duplicateSideEffects ?? 0), 0),
      dataInconsistenciesCount: selected.reduce((sum, evidence) => sum + (evidence.observed?.dataInconsistencies ?? 0), 0),
      evidenceAgeHours,
      excludedMockTests,
      dqCountByRule: { "DQ-12": countBy("DQ-12"), "DQ-18": countBy("DQ-18"), "DQ-19": countBy("DQ-19"), "DQ-20": countBy("DQ-20"), "DQ-21": countBy("DQ-21") },
      drillDown,
    },
    disqualifications: uniqueDqs,
    blockers,
  };
}
