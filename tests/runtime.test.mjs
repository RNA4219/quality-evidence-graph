import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateGateInput, verifyEvidenceArtifacts } from "../dist/index.js";

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
