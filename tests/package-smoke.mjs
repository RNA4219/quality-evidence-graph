import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRawProducerFixture, persistRawFixture } from "./helpers/raw-producer-fixture.mjs";
import { cliRunner, verifyPathSelection, verifyTargetDiscovery, verifyBaseline, verifyDiff, verifyDistribution } from "./helpers/cli-boundary-matrix.mjs";

const temp = await mkdtemp(join(tmpdir(), "qeg-package-smoke-"));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "npm_execpath is required; run this smoke test through npm run test:package");
const npmCacheResult = spawnSync(process.execPath, [npmCli, "config", "get", "cache"], { encoding: "utf-8" });
assert.equal(npmCacheResult.status, 0, npmCacheResult.stderr || npmCacheResult.stdout);
const npmCache = npmCacheResult.stdout.trim();
assert.ok(npmCache, "npm cache path is required");
const packed = spawnSync(process.execPath, [npmCli, "pack", "--json", "--pack-destination", temp, "--cache", npmCache], { encoding: "utf-8" });
assert.equal(packed.status, 0, packed.stderr || packed.stdout);
const [{ filename }] = JSON.parse(packed.stdout);
const tarball = join(temp, filename);
const installed = spawnSync(process.execPath, [npmCli, "install", tarball, "--prefix", temp, "--ignore-scripts", "--no-audit", "--no-fund", "--prefer-offline", "--cache", npmCache], { encoding: "utf-8" });
assert.equal(installed.status, 0, installed.stderr || installed.stdout);
const packageRoot = join(temp, "node_modules", "@quality-harness", "quality-evidence-graph");
const qegBin = join(temp, "node_modules", ".bin", process.platform === "win32" ? "qeg.cmd" : "qeg");
function runQeg(args) {
  if (process.platform === "win32") {
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/c", "call", qegBin, ...args], { encoding: "utf-8", cwd: temp });
  }
  return spawnSync(qegBin, args, { encoding: "utf-8", cwd: temp });
}
const help = runQeg(["--help"]);
assert.equal(help.status, 0, help.stderr || help.stdout);
assert.match(help.stdout, /Usage: qeg/);
const version = runQeg(["--version"]);
assert.equal(version.status, 0, version.stderr || version.stdout);
assert.equal(version.stdout.trim(), "0.4.0");
const schemaCheck = runQeg(["schema-check"]);
assert.equal(schemaCheck.status, 0, schemaCheck.stderr || schemaCheck.stdout);
const imported = await import(new URL(`file:///${join(packageRoot, "dist", "index.js").replaceAll("\\", "/")}`));
assert.equal(typeof imported.evaluateGate, "function");
assert.equal(typeof imported.validateGateInput, "function");
assert.equal(typeof imported.verifyEvidenceArtifacts, "function");
assert.equal(typeof imported.getExitCode, "function");
assert.equal(JSON.parse(await readFile(join(packageRoot, "package.json"), "utf-8")).version, "0.4.0");
assert.equal(typeof imported.buildGraph, "function");
assert.equal(typeof imported.placeTests, "function");
assert.equal(typeof imported.planConsumerMigration, "function");
assert.equal(typeof imported.readPublishedOutputs, "function");
const rawConsumer = join(temp, "raw-consumer");
const rawFixture = await createRawProducerFixture(rawConsumer, imported);
for (const command of ["build-graph", "place-tests", "gate", "record", "schema-check"]) {
  const result = runQeg([command, rawConsumer]);
  assert.equal(result.status, 0, `Packed ${command}: ${result.stderr || result.stdout}`);
}
const rawRecord = JSON.parse(await readFile(join(rawConsumer, "quality-evidence-record.json"), "utf8"));
assert.equal(rawRecord.gate.verdict, "go");
assert.equal(rawRecord.gate.evaluationScope.kind, "fixture");
assert.equal(rawRecord.gate.executionAccounting.selections[0].selectedRunId, "RUN-001");
assert.equal((await imported.readPublishedOutputs(rawConsumer)).files.size, 7);
assert.equal(runQeg(["outputs", "read", rawConsumer]).status, 0);
await writeFile(join(rawConsumer, "output-record.json"), "tampered");
assert.equal(runQeg(["outputs", "read", rawConsumer]).status, 1);
assert.equal(runQeg(["outputs", "recover", rawConsumer]).status, 0);
const migrationConsumer = join(temp, "migration-consumer");
await cp(rawConsumer, migrationConsumer, { recursive: true });
const oldInput = JSON.parse(await readFile(join(migrationConsumer, "gate-input.json"), "utf8"));
const migrationPolicy = structuredClone(oldInput.policy); migrationPolicy.policyHash = "sha256:" + "e".repeat(64);
delete oldInput.policy.inputContract;
await writeFile(join(migrationConsumer, "gate-input.json"), JSON.stringify(oldInput));
const missingMigration = await imported.planConsumerMigration(migrationConsumer);
const migrationConfig = { migrationVersion: "qeg-consumer-migration/v1", expectedInputHash: missingMigration.inputHash, policy: migrationPolicy };
const migrationPlan = await imported.planConsumerMigration(migrationConsumer, migrationConfig);
assert.equal(migrationPlan.status, "ready", JSON.stringify(migrationPlan));
assert.equal(migrationPlan.gate.verdict, "go", JSON.stringify(migrationPlan));
assert.equal((await imported.applyConsumerMigration(migrationConsumer, migrationConfig)).status, "applied");
assert.equal((await imported.applyConsumerMigration(migrationConsumer, migrationConfig)).status, "unchanged");
const liveReplay = join(temp, "live-replay");
await cp(join(packageRoot, "docs/evidence/eac-completion-2026-09-10/producer-replay/first"), liveReplay, { recursive: true });
for (const command of ["build-graph", "place-tests", "record"]) assert.equal(runQeg([command, liveReplay]).status, 2);
assert.equal(runQeg(["schema-check", liveReplay]).status, 0);
const actionReplay = spawnSync(process.execPath, [join(packageRoot, "qeg-report-action/dist/cli.mjs"), "build-graph", liveReplay], { encoding: "utf8" });
assert.equal(actionReplay.status, 2, actionReplay.stderr || actionReplay.stdout);
for (const [field, value, code] of [["build_id", "other-build", "DQ-12"], ["timestamp", "2026-09-10T00:00:00.001Z", "DQ-05"]]) {
  const copy = structuredClone(rawFixture); copy.loaded[12].payload[field] = value;
  await persistRawFixture(rawConsumer, copy.manifest, copy.loaded);
  for (const command of ["build-graph", "place-tests"]) assert.equal(runQeg([command, rawConsumer]).status, 0);
  const result = runQeg(["gate", rawConsumer]); assert.equal(result.status, 2);
  const gate = JSON.parse(result.stdout); assert.ok(gate.disqualifications.some(d => d.code === code));
  const graph = imported.buildGraph(copy.manifest, copy.loaded);
  const input = { metadata: graph.metadata, graph, policy: copy.manifest.policy, placementPlan: imported.placeTests(graph, copy.manifest.policy), waivers: [] };
  const evidenceVerification = await imported.verifyEvidenceArtifacts(input, { baseDir: rawConsumer });
  assert.deepEqual(imported.evaluateGate({ ...input, evidenceVerification }).executionAccounting, gate.executionAccounting);
}
const packedActionBundle = join(packageRoot, "qeg-report-action", "dist", "cli.mjs");
const packedActionVersion = spawnSync(process.execPath, [packedActionBundle, "--version"], {
  encoding: "utf-8",
  cwd: temp,
});
assert.equal(packedActionVersion.status, 0, packedActionVersion.stderr || packedActionVersion.stdout);
assert.equal(packedActionVersion.stdout.trim(), "0.4.0");
const thirdPartyNotices = await readFile(
  join(packageRoot, "qeg-report-action", "THIRD_PARTY_NOTICES.md"),
  "utf-8",
);
assert.match(thirdPartyNotices, /fast-uri/);
for (const license of [
  "ajv.txt",
  "fast-deep-equal.txt",
  "fast-uri.txt",
  "json-schema-traverse.txt",
    "require-from-string.txt",
    "code-to-gate-LICENSE.txt",
    "manual-bb-test-harness-LICENSE.txt",
    "manual-bb-test-harness-NOTICE.txt",
]) {
  const text = await readFile(join(packageRoot, "qeg-report-action", "licenses", license), "utf-8");
  assert.ok(text.trim().length > 0, `packed Action license is empty: ${license}`);
}

await writeFile(
  join(temp, "package.json"),
  JSON.stringify({ private: true, type: "module" }, null, 2) + "\n",
);
await writeFile(
  join(temp, "contract.ts"),
  await readFile(resolve("tests", "type-contract", "contract.ts"), "utf-8"),
);
await writeFile(
  join(temp, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        exactOptionalPropertyTypes: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ["contract.ts"],
    },
    null,
    2,
  ) + "\n",
);
const typeContract = spawnSync(
  process.execPath,
  [resolve("node_modules", "typescript", "bin", "tsc"), "-p", join(temp, "tsconfig.json")],
  { encoding: "utf-8", cwd: temp },
);
assert.equal(typeContract.status, 0, typeContract.stderr || typeContract.stdout);

const packedCli = cliRunner(join(packageRoot, 'dist/cli.js'), temp);
for (const [name, verify] of [['paths', verifyPathSelection], ['discovery', verifyTargetDiscovery], ['baseline', verifyBaseline], ['diff', verifyDiff], ['distribution', verifyDistribution]]) {
  await verify(packedCli, join(packageRoot, 'fixtures'), join(temp, 'boundary-' + name));
}
await verifyDistribution(cliRunner(packedActionBundle, temp), join(packageRoot, 'fixtures'), join(temp, 'boundary-packed-action'));
console.log("Packed CLI boundary matrix R8-R13 and Action diagnostics passed");
console.log("Clean tarball install, CLI/library/Action bundle smoke, and packed public type contract passed");
