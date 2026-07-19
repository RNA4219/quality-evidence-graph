import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

test("qeg init generates a schema-valid 0.2 enforced integration", async () => {
  const root = await mkdtemp(join(tmpdir(), "qeg-init-v02-"));
  const initialized = run(["init", "--root", root]);
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  const input = JSON.parse(await readFile(join(root, ".qeg", "gate-input.json"), "utf-8"));
  assert.equal(input.metadata.qegVersion, "0.2");
  assert.equal(input.graph.metadata.qegVersion, "0.2");
  const schema = await validateGateInput(input);
  assert.equal(schema.valid, true, JSON.stringify(schema.issues));
  const workflow = await readFile(join(root, ".github", "workflows", "qeg.yml"), "utf-8");
  assert.match(workflow, /qeg-report-action@v0\.2\.0/);
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
        slos: [{ name: "traffic", metricName: "requests", semanticRole: "traffic_count", aggregation: "count", unit: "requests", evaluationPhases: ["steady_state", "fault", "recovery"], target: { targetType: "min", value: 1 } }],
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
      metrics: ["steady_state", "fault", "recovery"].map((phase) => ({ id: `qeg:metric-${phase}`, phase, metricName: "requests", semanticRole: "traffic_count", aggregation: "count", windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:02:00.000Z", observedValue: 100, unit: "requests", evidenceRefId: "qeg:signal-evidence" })),
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

  const ambiguous = reliabilityInput();
  const first = ambiguous.graph.nodes.find((node) => node.id === "qeg:evidence-resilience");
  const second = structuredClone(first);
  second.id = "qeg:evidence-resilience-conflict";
  second.status = "fail";
  second.passed = false;
  ambiguous.graph.nodes.push(second);
  assert.ok(evaluateGate(ambiguous).disqualifications.some((item) => item.code === "DQ-19"));
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
    ["toxiproxy", { runId: "qeg:run-toxi", attempt: 1, commit: REL_SHA, startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:01:00.000Z", status: "pass", toxic: { type: "timeout", attributes: {} } }],
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
  const existing = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "context.json", "--out", "shell.evidence.json", "--base-dir", dir]);
  assert.equal(existing.status, 1);
  const escaped = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "context.json", "--out", "../escape.json", "--base-dir", dir]);
  assert.equal(escaped.status, 1);
  const unsupported = run(["evidence", "normalize", "--adapter", "custom", "--input", "shell.json", "--context", "context.json", "--out", "custom.json", "--base-dir", dir]);
  assert.equal(unsupported.status, 1);
  const conflict = structuredClone(normalizeContext(signalHash));
  conflict.targetRevision = "b".repeat(40);
  await writeFile(join(dir, "conflict.json"), JSON.stringify(conflict), "utf-8");
  const conflictResult = run(["evidence", "normalize", "--adapter", "shell", "--input", "shell.json", "--context", "conflict.json", "--out", "conflict.evidence.json", "--base-dir", dir]);
  assert.equal(conflictResult.status, 1);
});
