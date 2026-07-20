import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { evaluateGate, validateGateInput, verifyEvidenceArtifacts } from "../dist/index.js";

const cli = resolve("dist/cli.js");
const positive = resolve("fixtures/positive-release-go");
const run = (args, options = {}) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf-8", ...options });

test("positive fixture passes runtime schema and evidence verification", async () => {
  const input = JSON.parse(await readFile(join(positive, "gate-input.json"), "utf-8"));
  const schema = await validateGateInput(input);
  assert.equal(schema.valid, true);
  const evidence = await verifyEvidenceArtifacts(schema.input, { baseDir: positive });
  assert.equal(evidence.status, "pass");
});

test("hash mismatch becomes DQ-06", () => {
  const result = run(["validate", "fixtures/negative-evidence-hash-mismatch"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Actual DQ codes: DQ-06/);
});

test("changed-only distinguishes no changes from detection failure", async () => {
  const noChanges = run(["report", "--json", "--changed-only", positive], { env: { ...process.env, QEG_CHANGED_FILES: "" } });
  assert.equal(noChanges.status, 0, noChanges.stderr);
  const noChangesReport = JSON.parse(noChanges.stdout);
  assert.equal(noChangesReport.selection.status, "no_relevant_changes");
  assert.equal(noChangesReport.selection.selectedTargetCount, 0);
  assert.equal(noChangesReport.summary.cliErrors, 0);
  const nonRepo = await mkdtemp(join(tmpdir(), "qeg-non-repo-"));
  const failed = run(["report", "--json", "--changed-only", positive], { cwd: nonRepo, env: { ...process.env, QEG_CHANGED_FILES: undefined } });
  assert.equal(failed.status, 1, failed.stderr || failed.stdout);
  const failedReport = JSON.parse(failed.stdout);
  assert.equal(failedReport.selection.status, "detection_failed");
  assert.equal(failedReport.errors.length, 1);
  assert.equal(failedReport.summary.cliErrors, 1);
});

test("packaged CLI help contract is available before package smoke", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: qeg/);
});

async function clonePositive(prefix) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  await cp(positive, dir, { recursive: true });
  return dir;
}

test("malformed JSON is a CLI error with exit 1", async () => {
  const fixture = await clonePositive("qeg-malformed-");
  await writeFile(join(fixture, "gate-input.json"), "{not-json", "utf-8");
  const result = run(["gate", fixture]);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /not found or invalid/);
});

test("parseable required-component schema failure is DQ-01 with exit 2", async () => {
  const fixture = await clonePositive("qeg-schema-invalid-");
  const inputPath = join(fixture, "gate-input.json");
  const input = JSON.parse(await readFile(inputPath, "utf-8"));
  input.graph.nodes = "invalid";
  await writeFile(inputPath, JSON.stringify(input), "utf-8");
  const result = run(["gate", fixture]);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const gate = JSON.parse(result.stdout);
  assert.equal(gate.verdict, "disqualified");
  assert.ok(gate.disqualifications.some((item) => item.code === "DQ-01"));
});

test("required evidence failures fail but optional evidence failures only warn", async () => {
  const input = JSON.parse(await readFile(join(positive, "gate-input.json"), "utf-8"));
  input.metadata.profile = "ipo_controlled";
  input.policy.profile = "ipo_controlled";

  const required = structuredClone(input);
  required.metadata.inputArtifacts[0].path = "artifacts/does-not-exist.json";
  const requiredReport = await verifyEvidenceArtifacts(required, { baseDir: positive });
  assert.equal(requiredReport.status, "fail");
  assert.ok(requiredReport.items.some((item) => item.code === "FILE_MISSING" && item.severity === "fail"));

  const optional = structuredClone(input);
  optional.metadata.inputArtifacts.push({
    id: "junit:optional-missing",
    adapter: "junit",
    kind: "junit",
    path: "artifacts/optional-does-not-exist.xml",
    contentHash: "sha256:deadbeef",
    revision: "wrong-revision"
  });
  const optionalReport = await verifyEvidenceArtifacts(optional, { baseDir: positive });
  const optionalItems = optionalReport.items.filter((item) => item.artifactId === "junit:optional-missing");
  assert.equal(optionalReport.status, "warn");
  assert.ok(optionalItems.length > 0);
  assert.ok(optionalItems.every((item) => item.severity === "warn"));
});

test("required hash and revision mismatches fail evidence verification", async () => {
  const input = JSON.parse(await readFile(join(positive, "gate-input.json"), "utf-8"));
  input.metadata.profile = "ipo_controlled";
  input.policy.profile = "ipo_controlled";
  input.metadata.inputArtifacts[0].contentHash = "sha256:deadbeef";
  input.metadata.headRef = "refs/heads/main";
  input.metadata.inputArtifacts[0].revision = "wrong-revision";
  const report = await verifyEvidenceArtifacts(input, { baseDir: positive });
  assert.equal(report.status, "fail");
  assert.ok(report.items.some((item) => item.code === "HASH_MISMATCH" && item.severity === "fail"));
  assert.ok(report.items.some((item) => item.code === "REVISION_MISMATCH" && item.severity === "fail"));
});

test("changed-only fails closed with unavailable history and detects untracked worktree files", async () => {
  const cleanRepo = await mkdtemp(join(tmpdir(), "qeg-clean-initial-repo-"));
  assert.equal(spawnSync("git", ["init"], { cwd: cleanRepo }).status, 0);
  const clean = run(["report", "--json", "--changed-only", positive], {
    cwd: cleanRepo,
    env: { ...process.env, QEG_CHANGED_FILES: undefined },
  });
  assert.equal(clean.status, 1, clean.stderr || clean.stdout);
  assert.equal(JSON.parse(clean.stdout).selection.status, "detection_failed");

  const worktreeRepo = await mkdtemp(join(tmpdir(), "qeg-worktree-repo-"));
  assert.equal(spawnSync("git", ["init"], { cwd: worktreeRepo }).status, 0);
  const target = join(worktreeRepo, "fixture");
  await cp(positive, target, { recursive: true });
  const selected = run(["report", "--json", "--changed-only", target], {
    cwd: worktreeRepo,
    env: { ...process.env, QEG_CHANGED_FILES: undefined },
  });
  assert.equal(selected.status, 0, selected.stderr || selected.stdout);
  const report = JSON.parse(selected.stdout);
  assert.equal(report.selection.status, "selected");
  assert.equal(report.selection.strategy, "worktree");
  assert.equal(report.selection.selectedTargetCount, 1);
});

test("CLI maps required missing evidence to DQ-06 and optional missing evidence to warning-only", async () => {
  const requiredFixture = await clonePositive("qeg-required-missing-");
  const requiredPath = join(requiredFixture, "gate-input.json");
  const requiredInput = JSON.parse(await readFile(requiredPath, "utf-8"));
  requiredInput.metadata.inputArtifacts[0].path = "artifacts/missing-required.json";
  await writeFile(requiredPath, JSON.stringify(requiredInput), "utf-8");
  const requiredResult = run(["gate", requiredFixture]);
  assert.equal(requiredResult.status, 2, requiredResult.stderr || requiredResult.stdout);
  assert.ok(JSON.parse(requiredResult.stdout).disqualifications.some((item) => item.code === "DQ-06"));

  const optionalFixture = await clonePositive("qeg-optional-missing-");
  const optionalPath = join(optionalFixture, "gate-input.json");
  const optionalInput = JSON.parse(await readFile(optionalPath, "utf-8"));
  optionalInput.metadata.inputArtifacts.push({
    id: "qeg:optional-junit-cli",
    adapter: "junit",
    kind: "junit",
    path: "artifacts/missing-optional.xml",
    contentHash: "sha256:deadbeef"
  });
  await writeFile(optionalPath, JSON.stringify(optionalInput), "utf-8");
  const optionalResult = run(["gate", optionalFixture]);
  assert.equal(optionalResult.status, 0, optionalResult.stderr || optionalResult.stdout);
  assert.equal(JSON.parse(optionalResult.stdout).verdict, "go");
});

test("check returns non-zero for DQ-level inconsistencies", () => {
  const result = run(["check", "fixtures/negative-evidence-hash-mismatch"]);
  assert.notEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Overall: FAIL/);
});

test("invalid optionalEvidence is recorded as a warning and does not disqualify", async () => {
  const input = JSON.parse(await readFile(join(positive, "gate-input.json"), "utf-8"));
  input.optionalEvidence = ["invalid-optional-shape"];
  const validation = await validateGateInput(input);
  assert.equal(validation.valid, true);
  assert.equal(validation.issues.length, 0);
  assert.ok(validation.warnings.some((item) => item.scope === "optionalEvidence"));
  assert.equal(validation.input.optionalEvidence, undefined);

  const fixture = await clonePositive("qeg-optional-schema-warning-");
  await writeFile(join(fixture, "gate-input.json"), JSON.stringify(input), "utf-8");
  const result = run(["gate", fixture]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stderr, /Warning: optional artifact/);
  assert.equal(JSON.parse(result.stdout).verdict, "go");
});

test("qeg init generates a schema-valid 0.2 wire contract with the 0.3.1 Action", async () => {
  const root = await mkdtemp(join(tmpdir(), "qeg-init-v02-"));
  const initialized = run(["init", "--root", root]);
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  const input = JSON.parse(await readFile(join(root, ".qeg", "gate-input.json"), "utf-8"));
  assert.equal(input.metadata.qegVersion, "0.2");
  assert.equal(input.graph.metadata.qegVersion, "0.2");
  const schema = await validateGateInput(input);
  assert.equal(schema.valid, true, JSON.stringify(schema.issues));
  const workflow = await readFile(join(root, ".github", "workflows", "qeg.yml"), "utf-8");
  assert.match(workflow, /qeg-report-action@v0\.3\.1/);
  assert.doesNotMatch(workflow, /enforce: "false"/);
});

test("mock tests remain auditable but do not count as Gate evidence", async () => {
  const source = resolve("fixtures/positive-placement-change-retirement");
  const fixture = await mkdtemp(join(tmpdir(), "qeg-mock-evidence-"));
  await cp(source, fixture, { recursive: true });
  const inputPath = join(fixture, "gate-input.json");
  const input = JSON.parse(await readFile(inputPath, "utf-8"));
  const replacement = input.graph.nodes.find((node) => node.id === "hate:AETE-login-001");
  replacement.testExecutionMode = "mock";
  await writeFile(inputPath, JSON.stringify(input), "utf-8");

  const result = run(["gate", fixture]);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const gate = JSON.parse(result.stdout);
  assert.equal(gate.verdict, "disqualified");
  assert.ok(gate.disqualifications.some(
    (item) => item.code === "DQ-14" && item.message.includes("mock test evidence is not Gate-eligible")
  ));
  assert.deepEqual(gate.testEvidenceAccounting.countedTestIds, []);
  assert.deepEqual(
    gate.testEvidenceAccounting.excludedMockTests.map((item) => item.testId),
    ["hate:AETE-login-001"]
  );
});

const REL_SHA = "a".repeat(40);
const REL_HASH = `sha256:${"b".repeat(64)}`;
const REL_CREATED = "2026-01-02T00:00:00.000Z";
const relSource = [{ id: "qeg:sr-reliability", path: "docs/spec/reliability-extension.md" }];

function reliabilityInput() {
  const metadata = {
    qegVersion: "0.2",
    runId: "qeg:reliability-run",
    createdAt: REL_CREATED,
    headRef: REL_SHA,
    profile: "strict",
    policyId: "qeg:policy-reliability",
    policyHash: REL_HASH,
    inputArtifacts: [],
  };
  const test = {
    id: "qeg:test-resilience",
    kind: "test",
    title: "dependency timeout recovery",
    traceability: { sourceRefs: relSource, assumptions: [], confidence: "high" },
    sourceArtifactIds: ["qeg:artifact-scenario"],
    layer: "integration",
    testExecutionMode: "real",
    existing: true,
    testType: "resilience",
    coveredRiskIds: ["qeg:risk-resilience"],
    resilienceScenario: {
      faultModel: "dependency_timeout",
      steadyState: {
        slos: [{ name: "traffic", metricName: "requests", semanticRole: "traffic_count", aggregation: "count", unit: "count", evaluationPhases: ["steady_state", "fault", "recovery"], target: { targetType: "min", value: 1 } }],
        requiredMetrics: ["requests"], requiredTraces: false, requiredLogs: false,
      },
      blastRadius: { environment: "ci", allowedTargets: ["dependency-a"], maxTargets: 1, maxDurationSeconds: 30 },
      abortConditions: [{ id: "qeg:abort-error", source: "metric", signal: "errors", aggregation: "rate", operator: "gt", threshold: 0.9, unit: "ratio" }],
    },
  };
  const evidence = {
    id: "qeg:evidence-resilience",
    kind: "execution_evidence",
    title: "current resilience run",
    traceability: { sourceRefs: relSource, assumptions: [], confidence: "high" },
    sourceArtifactIds: ["qeg:artifact-raw"],
    evidenceRefs: [{ id: "qeg:signal-evidence", path: "artifacts/signal.json", contentHash: REL_HASH, evidenceKind: "observability_metric", capturedAt: "2026-01-01T00:02:00.000Z", revision: REL_SHA }],
    evidenceType: "resilience",
    testId: test.id,
    adapter: "shell",
    adapterVersion: "v1",
    normalizationVersion: "qeg-resilience-evidence-v1",
    experimentId: "qeg:experiment-resilience",
    attempt: 1,
    rawArtifactRef: { id: "qeg:artifact-raw", path: "artifacts/raw.json", contentHash: REL_HASH, revision: REL_SHA },
    targetRevision: REL_SHA,
    environment: "ci",
    environmentId: "ci:unit",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:02:00.000Z",
    status: "pass",
    passed: true,
    steadyStateConfirmed: true,
    fault: { type: "dependency_timeout", parameters: {}, faultStartedAt: "2026-01-01T00:00:30.000Z", faultEndedAt: "2026-01-01T00:01:00.000Z", actualTargetIds: ["dependency-a"], appliedDurationMs: 30000 },
    recovered: true,
    recoveryConfirmedAt: "2026-01-01T00:01:30.000Z",
    recoveryDurationMs: 30000,
    observed: { requestCount: 100, errorRate: 0.01, latencyP95Ms: 30, saturationPct: 10, duplicateSideEffects: 0, dataInconsistencies: 0 },
    signalManifest: {
      metrics: [
        { id: "qeg:metric-steady_state", phase: "steady_state", metricName: "requests", semanticRole: "traffic_count", aggregation: "count", windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:00:30.000Z", observedValue: 100, unit: "count", evidenceRefId: "qeg:signal-evidence" },
        { id: "qeg:metric-fault", phase: "fault", metricName: "requests", semanticRole: "traffic_count", aggregation: "count", windowStart: "2026-01-01T00:00:30.000Z", windowEnd: "2026-01-01T00:01:00.000Z", observedValue: 100, unit: "count", evidenceRefId: "qeg:signal-evidence" },
        { id: "qeg:metric-recovery", phase: "recovery", metricName: "requests", semanticRole: "traffic_count", aggregation: "count", windowStart: "2026-01-01T00:01:00.000Z", windowEnd: "2026-01-01T00:01:30.000Z", observedValue: 100, unit: "count", evidenceRefId: "qeg:signal-evidence" },
        { id: "qeg:metric-error", phase: "fault", metricName: "errors", semanticRole: "error_rate", aggregation: "rate", windowStart: "2026-01-01T00:00:30.000Z", windowEnd: "2026-01-01T00:01:00.000Z", observedValue: 0.01, unit: "ratio", evidenceRefId: "qeg:signal-evidence" },
        { id: "qeg:metric-latency", phase: "fault", metricName: "latency", semanticRole: "latency_p95", aggregation: "p95", windowStart: "2026-01-01T00:00:30.000Z", windowEnd: "2026-01-01T00:01:00.000Z", observedValue: 30, unit: "ms", evidenceRefId: "qeg:signal-evidence" },
        { id: "qeg:metric-saturation", phase: "fault", metricName: "saturation", semanticRole: "saturation", aggregation: "max", windowStart: "2026-01-01T00:00:30.000Z", windowEnd: "2026-01-01T00:01:00.000Z", observedValue: 10, unit: "percent", evidenceRefId: "qeg:signal-evidence" },
        { id: "qeg:metric-duplicates", phase: "experiment", metricName: "duplicates", semanticRole: "duplicate_side_effects", aggregation: "count", windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:02:00.000Z", observedValue: 0, unit: "count", evidenceRefId: "qeg:signal-evidence" },
        { id: "qeg:metric-inconsistencies", phase: "experiment", metricName: "inconsistencies", semanticRole: "data_inconsistencies", aggregation: "count", windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:02:00.000Z", observedValue: 0, unit: "count", evidenceRefId: "qeg:signal-evidence" },
      ],
      traces: [], logs: [],
    },
  };
  const policy = {
    policyId: metadata.policyId, policyHash: metadata.policyHash, profile: "strict", effectiveDate: REL_CREATED, approver: "qa", sourceRefs: relSource,
    dqScope: ["DQ-01", "DQ-02", "DQ-03", "DQ-04", "DQ-05", "DQ-06", "DQ-07", "DQ-08", "DQ-09", "DQ-10", "DQ-11", "DQ-12", "DQ-13", "DQ-14", "DQ-15", "DQ-16", "DQ-17", "DQ-18", "DQ-19", "DQ-20", "DQ-21"],
    exitCodePolicy: { go: 0, conditional_go: 2, no_go: 2, disqualified: 2 },
    reliabilityPolicy: {
      enabled: true, requiredForSeverities: ["high"], requiredEnvironment: "ci", allowedExecutionModes: ["real"], maxEvidenceAgeHours: 48,
      requireRevisionMatch: true, requireSteadyStateBeforeFault: true, requireRecoveryObservation: true,
      requiredSignals: { metrics: true, traces: false, logs: false },
      thresholds: { minRequestCount: 10, maxErrorRate: 0.1, maxLatencyP95Ms: 100, maxSaturationPct: 90, maxRecoverySeconds: 60, maxDuplicateSideEffects: 0, maxDataInconsistencies: 0 },
      safety: { allowedEnvironments: ["ci"], forbidProduction: true, maxBlastRadiusTargets: 1, maxFaultDurationSeconds: 30 }, sourceRefs: relSource,
    },
  };
  return {
    metadata,
    graph: { metadata: structuredClone(metadata), nodes: [{ id: "qeg:risk-resilience", kind: "risk", title: "dependency timeout", traceability: { sourceRefs: relSource, assumptions: [], confidence: "high" }, sourceArtifactIds: ["qeg:artifact-risk"], priority: "P1", severity: "high", likelihood: 0.5, businessImpact: 0.5, complianceCriticality: 0, evidenceGap: 0, novelty: 0 }, test, evidence], edges: [], completeness: { score: 1, partial: false, parserFailures: [], unsupportedClaims: [] } },
    policy, waivers: [], evidenceVerification: { reportVersion: "qeg-evidence-verification-v2", status: "pass", items: [] },
  };
}

function reliabilityEvidenceEdge(id, from, to) {
  return {
    id,
    kind: "evidenced_by",
    from,
    to,
    traceability: {
      sourceRefs: relSource,
      assumptions: [],
      confidence: "high",
    },
  };
}

test("reliability schema and evaluator select one current real execution", async () => {
  const input = reliabilityInput();
  const { evidenceVerification: _evidenceVerification, ...gateInput } = input;
  const schema = await validateGateInput(gateInput);
  assert.equal(schema.valid, true, JSON.stringify(schema.issues));
  const result = evaluateGate(input);
  assert.equal(result.verdict, "go");
  assert.deepEqual(result.reliability.enabled, true);
  assert.equal(result.reliability.riskCoverageRate, 1);
  assert.equal(result.reliability.recoverySecondsP95, 30);
});

test("reliability accepts absent or matching evidenced_by provenance and rejects contradictions", () => {
  const matching = reliabilityInput();
  matching.graph.edges.push(
    reliabilityEvidenceEdge(
      "qeg:edge-resilience-matching",
      "qeg:test-resilience",
      "qeg:evidence-resilience",
    ),
    reliabilityEvidenceEdge(
      "qeg:edge-resilience-matching-duplicate",
      "qeg:test-resilience",
      "qeg:evidence-resilience",
    ),
  );
  assert.equal(evaluateGate(matching).verdict, "go");

  const contradictory = reliabilityInput();
  const expectedTest = contradictory.graph.nodes.find(
    (node) => node.id === "qeg:test-resilience",
  );
  const wrongTest = structuredClone(expectedTest);
  wrongTest.id = "qeg:test-resilience-other";
  wrongTest.title = "other resilience test";
  wrongTest.deleted = true;
  contradictory.graph.nodes.push(wrongTest);

  const prior = contradictory.graph.nodes.find(
    (node) => node.id === "qeg:evidence-resilience",
  );
  const latest = structuredClone(prior);
  latest.id = "qeg:evidence-resilience-latest-conflict";
  latest.title = "latest evidence with contradictory provenance";
  latest.attempt = 2;
  latest.endedAt = "2026-01-01T00:03:00.000Z";
  contradictory.graph.nodes.push(latest);
  contradictory.graph.edges.push(
    reliabilityEvidenceEdge(
      "qeg:edge-resilience-latest-correct",
      expectedTest.id,
      latest.id,
    ),
    reliabilityEvidenceEdge(
      "qeg:edge-resilience-latest-wrong",
      wrongTest.id,
      latest.id,
    ),
  );

  const result = evaluateGate(contradictory);
  assert.equal(result.verdict, "disqualified");
  assert.deepEqual(
    [...new Set(result.disqualifications.map((item) => item.code))],
    ["DQ-18"],
  );
  assert.ok(result.disqualifications[0].nodeIds.includes(latest.id));
  assert.equal(result.reliability.qualifiedExecutionCount, 0);
  assert.equal(result.reliability.passingExecutionCount, 0);
});

test("reliability fails closed without artifact verification and never falls back from latest failure", () => {
  const missingReport = reliabilityInput();
  delete missingReport.evidenceVerification;
  assert.ok(evaluateGate(missingReport).disqualifications.some((item) => item.code === "DQ-06"));

  const latestFailure = reliabilityInput();
  const evidence = latestFailure.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  evidence.status = "fail";
  evidence.passed = false;
  evidence.endedAt = "2026-01-01T00:03:00.000Z";
  const result = evaluateGate(latestFailure);
  assert.equal(result.verdict, "no_go");
  assert.ok(result.blockers.some((item) => item.ruleId === "BLK-REL-03" && item.effective));
});

test("reliability waives only linked risk/test threshold blockers and never safety blockers", () => {
  const waived = reliabilityInput();
  const evidence = waived.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  evidence.observed.errorRate = 0.5;
  evidence.signalManifest.metrics.find((metric) => metric.semanticRole === "error_rate").observedValue = 0.5;
  waived.waivers.push({ id: "qeg:waiver-resilience", linkedRiskIds: ["qeg:risk-resilience"], linkedTestIds: ["qeg:test-resilience"], approver: "qa", approvalAuthority: "qa", reason: "temporary", expiry: "2026-02-01T00:00:00.000Z", impactScope: "ci", rollbackOrContainment: "stop", followUpOwner: "qa", recheckCondition: "rerun", sourceRefs: relSource });
  const conditional = evaluateGate(waived);
  assert.equal(conditional.verdict, "conditional_go");
  assert.ok(conditional.blockers.some((item) => item.ruleId === "BLK-REL-01" && item.effective === false));

  const unsafe = reliabilityInput();
  const unsafeEvidence = unsafe.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  unsafeEvidence.fault.actualTargetIds.push("dependency-b");
  unsafe.waivers.push(...waived.waivers);
  const noGo = evaluateGate(unsafe);
  assert.equal(noGo.verdict, "no_go");
  assert.ok(noGo.blockers.some((item) => item.ruleId === "BLK-REL-04" && item.effective));
});

test("reliability detects policy identity and latest-evidence ambiguity", () => {
  const mismatch = reliabilityInput();
  mismatch.graph.metadata.policyHash = `sha256:${"c".repeat(64)}`;
  assert.ok(evaluateGate(mismatch).disqualifications.some((item) => item.code === "DQ-21"));

  const invalidProfile = reliabilityInput();
  invalidProfile.metadata.profile = "lean";
  invalidProfile.graph.metadata.profile = "lean";
  invalidProfile.policy.profile = "lean";
  assert.ok(evaluateGate(invalidProfile).disqualifications.some((item) => item.code === "DQ-21"));

  const incompleteScope = reliabilityInput();
  incompleteScope.policy.dqScope = incompleteScope.policy.dqScope.filter((code) => code !== "DQ-20");
  assert.ok(evaluateGate(incompleteScope).disqualifications.some((item) => item.code === "DQ-21"));

  const ambiguous = reliabilityInput();
  const first = ambiguous.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  const second = structuredClone(first);
  second.id = "qeg:evidence-resilience-conflict";
  second.status = "fail";
  second.passed = false;
  ambiguous.graph.nodes.push(second);
  assert.ok(evaluateGate(ambiguous).disqualifications.some((item) => item.code === "DQ-19"));
});

test("reliability accounting excludes DQ evidence and does not emit blockers for it", () => {
  const input = reliabilityInput();
  const evidence = input.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  evidence.signalManifest.metrics.find((metric) => metric.semanticRole === "error_rate").observedValue = 0.5;
  const result = evaluateGate(input);
  assert.equal(result.verdict, "disqualified");
  assert.ok(result.disqualifications.some((item) => item.code === "DQ-20"));
  assert.equal(result.blockers.length, 0);
  assert.equal(result.reliability.qualifiedExecutionCount, 0);
  assert.equal(result.reliability.passingExecutionCount, 0);
  assert.equal(result.reliability.resiliencePassRate, null);
});

test("non-completing resilience statuses remain qualified blockers without fabricated lifecycle DQs", () => {
  const input = reliabilityInput();
  const evidence = input.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  evidence.status = "error";
  evidence.passed = false;
  delete evidence.steadyStateConfirmed;
  delete evidence.fault;
  delete evidence.recovered;
  delete evidence.recoveryConfirmedAt;
  delete evidence.recoveryDurationMs;
  delete evidence.observed;
  delete evidence.signalManifest;
  const result = evaluateGate(input);
  assert.equal(result.verdict, "no_go");
  assert.equal(result.disqualifications.some((item) => ["DQ-18", "DQ-20"].includes(item.code)), false);
  assert.deepEqual(result.blockers.map((item) => item.ruleId), ["BLK-REL-03"]);
  assert.equal(result.reliability.qualifiedExecutionCount, 1);
  assert.equal(result.reliability.passingExecutionCount, 0);
});

test("reliability canonicalizes decision fingerprints and treats passed as optional", () => {
  const input = reliabilityInput();
  const first = input.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  delete first.passed;
  first.fault.parameters = { alpha: 1, beta: 2 };
  const duplicate = structuredClone(first);
  duplicate.id = "qeg:evidence-resilience-duplicate";
  duplicate.fault.parameters = { beta: 2, alpha: 1 };
  input.graph.nodes.push(duplicate);
  const result = evaluateGate(input);
  assert.equal(result.verdict, "go");
  assert.equal(result.disqualifications.some((item) => item.code === "DQ-19"), false);
  assert.equal(result.reliability.passingExecutionCount, 1);
});

test("reliability propagates an unsafe attempt to every covered required risk", () => {
  const input = reliabilityInput();
  const firstRisk = input.graph.nodes.find((node) => node.id === "qeg:risk-resilience");
  const secondRisk = structuredClone(firstRisk);
  secondRisk.id = "qeg:risk-resilience-secondary";
  secondRisk.title = "secondary impact";
  input.graph.nodes.push(secondRisk);
  const resilienceTest = input.graph.nodes.find((node) => node.id === "qeg:test-resilience");
  resilienceTest.coveredRiskIds.push(secondRisk.id);
  const evidence = input.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  evidence.fault.actualTargetIds.push("dependency-b");
  const result = evaluateGate(input);
  assert.equal(result.verdict, "no_go");
  assert.deepEqual(result.blockers.filter((item) => item.ruleId === "BLK-REL-04").map((item) => item.riskIds[0]).sort(), [firstRisk.id, secondRisk.id].sort());
  assert.equal(result.reliability.passingRiskCount, 0);
  assert.equal(result.reliability.passingExecutionCount, 0);
});

test("reliability fails closed on invalid clocks and invalid current timestamps", () => {
  const invalidClock = reliabilityInput();
  invalidClock.metadata.createdAt = "not-a-date";
  const clockResult = evaluateGate(invalidClock);
  assert.ok(clockResult.disqualifications.some((item) => item.code === "DQ-01"));
  assert.deepEqual(clockResult.reliability.evidenceAgeHours, {});

  const invalidEvidence = reliabilityInput();
  invalidEvidence.graph.nodes.find((node) => node.id === "qeg:evidence-resilience").endedAt = "not-a-date";
  const evidenceResult = evaluateGate(invalidEvidence);
  assert.ok(evidenceResult.disqualifications.some((item) => item.code === "DQ-18"));
  assert.equal(evidenceResult.reliability.qualifiedExecutionCount, 0);
});

test("reliability reports are stable across graph and signal enumeration order", () => {
  const first = reliabilityInput();
  const firstEvidence = first.graph.nodes.find(
    (node) => node.id === "qeg:evidence-resilience",
  );
  firstEvidence.status = "fail";
  firstEvidence.passed = false;
  firstEvidence.observed.errorRate = 0.5;
  firstEvidence.signalManifest.metrics.find(
    (metric) => metric.semanticRole === "error_rate",
  ).observedValue = 0.5;
  firstEvidence.recovered = false;
  firstEvidence.fault.actualTargetIds.push("dependency-b");

  const reordered = structuredClone(first);
  reordered.graph.nodes.reverse();
  const reorderedEvidence = reordered.graph.nodes.find(
    (node) => node.id === "qeg:evidence-resilience",
  );
  reorderedEvidence.evidenceRefs.reverse();
  reorderedEvidence.signalManifest.metrics.reverse();

  const left = evaluateGate(first);
  const right = evaluateGate(reordered);
  assert.deepEqual(right.disqualifications, left.disqualifications);
  assert.deepEqual(right.blockers, left.blockers);
  assert.deepEqual(right.reliability, left.reliability);
});

test("reliability semantic validator is shared by schema preflight and direct evaluation", async () => {
  const invalid = reliabilityInput();
  const evidence = invalid.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  evidence.status = "fail";
  evidence.passed = true;

  const validation = await validateGateInput(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((item) => item.keyword === "REL-SEM-007"));

  const result = evaluateGate(invalid);
  assert.ok(
    result.disqualifications.some(
      (item) => item.code === "DQ-01" && item.message.includes("REL-SEM-007"),
    ),
  );
});

test("artifact failures classify DQ-06 and DQ-12 by artifact with non-revision priority", () => {
  const revisionOnly = reliabilityInput();
  const revisionEvidence = revisionOnly.graph.nodes.find(
    (node) => node.id === "qeg:evidence-resilience",
  );
  revisionEvidence.rawArtifactRef.revision = "c".repeat(40);
  revisionOnly.evidenceVerification = {
    reportVersion: "qeg-evidence-verification-v2",
    status: "fail",
    items: [
      {
        artifactId: revisionEvidence.rawArtifactRef.id,
        severity: "fail",
        code: "REVISION_MISMATCH",
        message: "revision mismatch",
      },
    ],
  };
  const revisionResult = evaluateGate(revisionOnly);
  assert.ok(revisionResult.disqualifications.some((item) => item.code === "DQ-12"));
  assert.equal(revisionResult.disqualifications.some((item) => item.code === "DQ-06"), false);

  const mixed = reliabilityInput();
  const mixedEvidence = mixed.graph.nodes.find(
    (node) => node.id === "qeg:evidence-resilience",
  );
  mixedEvidence.rawArtifactRef.revision = "c".repeat(40);
  mixed.evidenceVerification = {
    reportVersion: "qeg-evidence-verification-v2",
    status: "fail",
    items: [
      {
        artifactId: mixedEvidence.rawArtifactRef.id,
        severity: "fail",
        code: "HASH_MISMATCH",
        message: "hash mismatch",
      },
      {
        artifactId: mixedEvidence.rawArtifactRef.id,
        severity: "fail",
        code: "REVISION_MISMATCH",
        message: "revision mismatch",
      },
    ],
  };
  const mixedResult = evaluateGate(mixed);
  assert.ok(mixedResult.disqualifications.some((item) => item.code === "DQ-06"));
  assert.equal(mixedResult.disqualifications.some((item) => item.code === "DQ-12"), false);
});

test("reliability schema enforces strict discriminators and semantic invariants", async () => {
  const missingDiscriminator = reliabilityInput();
  const evidence = missingDiscriminator.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  delete evidence.evidenceType;
  assert.equal((await validateGateInput(missingDiscriminator)).valid, false);

  const leakedResilienceField = reliabilityInput();
  leakedResilienceField.graph.nodes = leakedResilienceField.graph.nodes
    .filter((node) => node.kind !== "execution_evidence");
  leakedResilienceField.graph.nodes.push({
    id: "qeg:legacy-evidence-with-adapter", kind: "execution_evidence", title: "invalid legacy evidence",
    traceability: { sourceRefs: relSource, assumptions: [], confidence: "high" }, sourceArtifactIds: [], adapter: "shell",
  });
  assert.equal((await validateGateInput(leakedResilienceField)).valid, false);

  const missingBaseField = reliabilityInput();
  delete missingBaseField.graph.nodes.find((node) => node.id === "qeg:test-resilience").layer;
  assert.equal((await validateGateInput(missingBaseField)).valid, false);

  const unsafePolicy = reliabilityInput();
  unsafePolicy.policy.reliabilityPolicy.safety.allowedEnvironments = ["staging"];
  assert.equal((await validateGateInput(unsafePolicy)).valid, false);

  const invalidRange = reliabilityInput();
  invalidRange.graph.nodes.find((node) => node.id === "qeg:test-resilience").resilienceScenario.steadyState.slos[0].target = { targetType: "range", min: 2, max: 1 };
  assert.equal((await validateGateInput(invalidRange)).valid, false);

  const invalidCountAbort = reliabilityInput();
  invalidCountAbort.graph.nodes.find((node) => node.id === "qeg:test-resilience").resilienceScenario.abortConditions[0] = { id: "qeg:abort-trace", source: "trace_count", signal: "errors", aggregation: "count", operator: "gt", threshold: 0, unit: "matches" };
  assert.equal((await validateGateInput(invalidCountAbort)).valid, false);
});

function normalizeContext(signalHash) {
  return {
    node: { id: "qeg:evidence-normalized", title: "normalized", traceability: { sourceRefs: relSource, assumptions: [], confidence: "high" }, sourceArtifactIds: ["qeg:artifact-normalize"] },
    testId: "qeg:test-normalize", environment: "ci", environmentId: "ci:normalize", adapterVersion: "v1", targetRevision: REL_SHA,
    lifecycle: { startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:01:00.000Z", status: "pass", steadyStateConfirmed: true, recovered: true, recoveryDurationMs: 1000 },
    observed: { requestCount: 1, errorRate: 0, latencyP95Ms: 1, saturationPct: 1, duplicateSideEffects: 0, dataInconsistencies: 0 },
    evidenceRefs: [{ id: "qeg:signal-normalize", path: "signal.json", contentHash: signalHash, evidenceKind: "observability_metric", capturedAt: "2026-01-01T00:01:00.000Z", revision: REL_SHA }],
    signalManifest: { metrics: [], traces: [], logs: [] },
  };
}

test("evidence normalize supports four MVP adapters and fails safely on bad paths/conflicts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qeg-normalize-"));
  const signal = "signal\n";
  const signalHash = `sha256:${createHash("sha256").update(signal).digest("hex")}`;
  await writeFile(join(dir, "signal.json"), signal, "utf-8");
  await writeFile(join(dir, "context.json"), JSON.stringify(normalizeContext(signalHash)), "utf-8");
  const cases = [
    ["lakda", { contractVersion: "HATE/v1", runId: "qeg:run-lakda", attempt: 1, commit: REL_SHA, startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:01:00.000Z", status: "pass" }],
    ["toxiproxy", { runId: "qeg:run-toxi", attempt: 1, commit: REL_SHA, startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:01:00.000Z", status: "pass", toxic: { type: "timeout", attributes: {} }, faultStartedAt: "2026-01-01T00:00:10.000Z", faultEndedAt: "2026-01-01T00:00:20.000Z", targetIds: ["dependency-a"] }],
    ["shell", { schema: "qeg-resilience-shell-v1", runId: "qeg:run-shell", attempt: 1, commit: REL_SHA, startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:01:00.000Z", status: "pass" }],
    ["ci", { schema: "qeg-resilience-ci-v1", providerRunId: "qeg:run-ci", attempt: 1, headSha: REL_SHA, startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:01:00.000Z", conclusion: "success" }],
  ];
  for (const [adapter, raw] of cases) {
    const rawName = `${adapter}.json`;
    const outName = `${adapter}.evidence.json`;
    await writeFile(join(dir, rawName), JSON.stringify(raw), "utf-8");
    const result = run(["evidence", "normalize", "--adapter", adapter, "--input", rawName, "--context", "context.json", "--out", outName, "--base-dir", dir]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(await readFile(join(dir, outName), "utf-8")).adapter, adapter);
  }
  const normalizedToxiproxy = JSON.parse(await readFile(join(dir, "toxiproxy.evidence.json"), "utf-8"));
  assert.equal(normalizedToxiproxy.fault.type, "dependency_timeout");
  assert.equal(normalizedToxiproxy.fault.appliedDurationMs, 10000);

  await writeFile(join(dir, "toxiproxy-incomplete.json"), JSON.stringify({ runId: "qeg:run-toxi-incomplete", attempt: 1, commit: REL_SHA, startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:01:00.000Z", status: "pass", toxic: { type: "timeout", attributes: {} } }), "utf-8");
  const incompleteToxiproxy = run(["evidence", "normalize", "--adapter", "toxiproxy", "--input", "toxiproxy-incomplete.json", "--context", "context.json", "--out", "toxiproxy-incomplete.evidence.json", "--base-dir", dir]);
  assert.equal(incompleteToxiproxy.status, 1);
  assert.doesNotMatch(incompleteToxiproxy.stderr, /undefined|null/);
  await assert.rejects(readFile(join(dir, "toxiproxy-incomplete.evidence.json")));
  const existing = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "context.json", "--out", "shell.evidence.json", "--base-dir", dir]);
  assert.equal(existing.status, 1);
  const forced = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "context.json", "--out", "shell.evidence.json", "--base-dir", dir, "--force"]);
  assert.equal(forced.status, 0, forced.stderr || forced.stdout);
  assert.equal(JSON.parse(await readFile(join(dir, "shell.evidence.json"), "utf-8")).adapter, "shell");

  await mkdir(join(dir, "rename-failure.evidence.json"));
  const renameFailure = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "context.json", "--out", "rename-failure.evidence.json", "--base-dir", dir, "--force"]);
  assert.equal(renameFailure.status, 1);
  assert.deepEqual(
    (await readdir(dir)).filter(
      (name) => name.startsWith(".rename-failure.evidence.json.") && name.endsWith(".tmp"),
    ),
    [],
  );

  const schemaInvalidRaw = JSON.parse(await readFile(join(dir, "shell.json"), "utf-8"));
  schemaInvalidRaw.attempt = "not-a-number";
  await writeFile(join(dir, "schema-invalid.json"), JSON.stringify(schemaInvalidRaw), "utf-8");
  const schemaInvalid = run(["evidence", "normalize", "--adapter", "shell", "--input", "schema-invalid.json", "--context", "context.json", "--out", "schema-invalid.evidence.json", "--base-dir", dir]);
  assert.equal(schemaInvalid.status, 1);
  await assert.rejects(readFile(join(dir, "schema-invalid.evidence.json")));
  assert.deepEqual(
    (await readdir(dir)).filter(
      (name) => name.startsWith(".schema-invalid.evidence.json.") && name.endsWith(".tmp"),
    ),
    [],
  );

  const escaped = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "context.json", "--out", "../escape.json", "--base-dir", dir]);
  assert.equal(escaped.status, 1);
  const unsupported = run(["evidence", "normalize", "--adapter", "custom", "--input", "shell.json", "--context", "context.json", "--out", "custom.json", "--base-dir", dir]);
  assert.equal(unsupported.status, 1);
  const conflict = structuredClone(normalizeContext(signalHash));
  conflict.targetRevision = "b".repeat(40);
  await writeFile(join(dir, "conflict.json"), JSON.stringify(conflict), "utf-8");
  const conflictResult = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "conflict.json", "--out", "conflict.evidence.json", "--base-dir", dir]);
  assert.equal(conflictResult.status, 1);
  assert.doesNotMatch(conflictResult.stderr, new RegExp("b{40}"));

  await writeFile(join(dir, "secret-invalid.json"), "password=supersecret", "utf-8");
  const invalidJson = run(["evidence", "normalize", "--adapter", "shell", "--input", "secret-invalid.json", "--context", "context.json", "--out", "invalid.evidence.json", "--base-dir", dir]);
  assert.equal(invalidJson.status, 1);
  assert.doesNotMatch(invalidJson.stderr, /supersecret/);

  const originalRaw = await readFile(join(dir, "shell.json"), "utf-8");
  const overwriteInput = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "context.json", "--out", "shell.json", "--base-dir", dir, "--force"]);
  assert.equal(overwriteInput.status, 1);
  assert.equal(await readFile(join(dir, "shell.json"), "utf-8"), originalRaw);
  if (process.platform === "win32") {
    const caseVariantOverwrite = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "context.json", "--out", "SHELL.JSON", "--base-dir", dir, "--force"]);
    assert.equal(caseVariantOverwrite.status, 1);
    assert.equal(await readFile(join(dir, "shell.json"), "utf-8"), originalRaw);
  }

  const signalConflictRaw = JSON.parse(originalRaw);
  signalConflictRaw.signalManifest = { metrics: [{ id: "different" }], traces: [], logs: [] };
  await writeFile(join(dir, "signal-conflict.json"), JSON.stringify(signalConflictRaw), "utf-8");
  const signalConflict = run(["evidence", "normalize", "--adapter", "shell", "--input", "signal-conflict.json", "--context", "context.json", "--out", "signal-conflict.evidence.json", "--base-dir", dir]);
  assert.equal(signalConflict.status, 1);

  if (process.platform !== "win32") {
    const outside = await mkdtemp(join(tmpdir(), "qeg-normalize-outside-"));
    await writeFile(join(outside, "outside.json"), originalRaw, "utf-8");
    await symlink(join(outside, "outside.json"), join(dir, "outside-input.json"));
    const linkedInput = run(["evidence", "normalize", "--adapter", "shell", "--input", "outside-input.json", "--context", "context.json", "--out", "linked-input.evidence.json", "--base-dir", dir]);
    assert.equal(linkedInput.status, 1);
    await symlink(outside, join(dir, "outside-output"), "dir");
    const linkedOutput = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "context.json", "--out", "outside-output/evidence.json", "--base-dir", dir]);
    assert.equal(linkedOutput.status, 1);
  }
});

test("text report exposes reliability accounting and drill-down", () => {
  const report = run(["report", "fixtures/positive-reliability-go"]);
  assert.equal(report.status, 0, report.stderr || report.stdout);
  assert.match(report.stdout, /Reliability/);
  assert.match(report.stdout, /enabled: true/);
  assert.match(report.stdout, /risk coverage: 1\/1/);
  assert.match(report.stdout, /DQ counts: DQ-12=0, DQ-18=0, DQ-19=0, DQ-20=0, DQ-21=0/);
  assert.match(report.stdout, /selection: risk=qeg:risk-reliability-fixture/);
  assert.match(report.stdout, /adapter=shell/);

  const legacyReport = run(["report", "fixtures/positive-release-go"]);
  assert.equal(legacyReport.status, 0, legacyReport.stderr || legacyReport.stdout);
  assert.match(legacyReport.stdout, /Reliability/);
  assert.match(legacyReport.stdout, /enabled: false/);
});
