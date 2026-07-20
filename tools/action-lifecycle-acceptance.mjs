import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function parseArgs(argv) {
  const options = {
    out: resolve(repoRoot, ".qeg", "action-lifecycle", "evidence.json"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function sha256Buffer(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function sha256File(path) {
  return sha256Buffer(await readFile(path));
}

function sanitizeOutput(value, deploymentRoot) {
  return String(value ?? "")
    .replaceAll(deploymentRoot, "<deployment-root>")
    .replaceAll(repoRoot, "<repo-root>")
    .slice(0, 20000);
}

function observe(cliPath, args, deploymentRoot) {
  const startedAt = new Date().toISOString();
  console.log(`Lifecycle probe: ${args[0] ?? "--help"}`);
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000,
  });
  const endedAt = new Date().toISOString();
  if (result.error) throw result.error;
  const stdout = sanitizeOutput(result.stdout, deploymentRoot);
  const stderr = sanitizeOutput(result.stderr, deploymentRoot);
  return {
    command: sanitizeOutput(`node <action-bundle> ${args.join(" ")}`, deploymentRoot),
    exitCode: result.status ?? 1,
    startedAt,
    endedAt,
    stdout,
    stderr,
    stdoutSha256: sha256Buffer(stdout),
    stderrSha256: sha256Buffer(stderr),
  };
}

async function copyEvidenceFile(source, destination) {
  await copyFile(source, destination);
  return {
    path: basename(destination),
    sha256: await sha256File(destination),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const packageManifest = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
  const releaseVersion = packageManifest.version;
  if (releaseVersion !== "0.3.1") {
    throw new Error(`release lifecycle acceptance requires package version 0.3.1, got ${releaseVersion}`);
  }

  const sourceRevision = process.env.GITHUB_SHA ?? process.env.QEG_SOURCE_REVISION ?? "worktree";
  if (sourceRevision !== "worktree" && !/^[0-9a-f]{40}$/.test(sourceRevision)) {
    throw new Error("source revision must be worktree or a full lowercase Git SHA");
  }

  const sourceCli = join(repoRoot, "qeg-report-action", "dist", "cli.mjs");
  const sourceSchemas = join(repoRoot, "schemas");
  const evidenceSchemaPath = join(sourceSchemas, "action-lifecycle-evidence.schema.json");
  const tempRoot = await mkdtemp(join(tmpdir(), "qeg-action-lifecycle-"));
  const deploymentRoot = join(tempRoot, "release-root");
  const deployedCli = join(deploymentRoot, "qeg-report-action", "dist", "cli.mjs");
  const deployedSchemas = join(deploymentRoot, "schemas");
  const beforeReport = join(tempRoot, "before-report.json");
  const recoveredReport = join(tempRoot, "recovered-report.json");
  const outputDir = dirname(options.out);

  try {
    await mkdir(dirname(deployedCli), { recursive: true });
    await copyFile(sourceCli, deployedCli);
    await cp(sourceSchemas, deployedSchemas, { recursive: true });

    const bundleHash = await sha256File(sourceCli);
    const deployedBundleHash = await sha256File(deployedCli);
    const deployedAt = new Date().toISOString();
    const consumerRoot = join(deploymentRoot, "consumer");
    const initObservation = observe(deployedCli, ["init", "--root", consumerRoot], deploymentRoot);
    const target = join(consumerRoot, ".qeg");


    const versionObservation = observe(deployedCli, ["--version"], deploymentRoot);
    const beforeObservation = observe(
      deployedCli,
      ["report", "--json", "--out", beforeReport, target],
      deploymentRoot,
    );

    const faultTarget = join(deployedSchemas, "gate-input.schema.json");
    const originalSchema = await readFile(join(sourceSchemas, "gate-input.schema.json"));
    const faultStartedAt = new Date().toISOString();
    await writeFile(faultTarget, "{\n", "utf8");
    const faultObservation = observe(deployedCli, ["schema-check"], deploymentRoot);
    const faultEndedAt = new Date().toISOString();

    const recoveryStartedAt = new Date().toISOString();
    await writeFile(faultTarget, originalSchema);
    const recoveredSchemaHash = await sha256File(faultTarget);
    const schemaRecoveryObservation = observe(deployedCli, ["schema-check"], deploymentRoot);
    const recoveredObservation = observe(
      deployedCli,
      ["report", "--json", "--out", recoveredReport, target],
      deploymentRoot,
    );
    const recoveryEndedAt = new Date().toISOString();

    await mkdir(outputDir, { recursive: true });
    const beforeArtifact = await copyEvidenceFile(
      beforeReport,
      join(outputDir, "before-report.json"),
    );
    const recoveredArtifact = await copyEvidenceFile(
      recoveredReport,
      join(outputDir, "recovered-report.json"),
    );
    const faultArtifactPath = join(outputDir, "fault-observation.json");
    await writeFile(
      faultArtifactPath,
      `${JSON.stringify({
        schemaVersion: "qeg-action-fault-observation-v1",
        fault: "corrupt_gate_input_schema",
        expectedExitCode: 1,
        observation: faultObservation,
      }, null, 2)}\n`,
      "utf8",
    );
    const faultArtifact = {
      path: basename(faultArtifactPath),
      sha256: await sha256File(faultArtifactPath),
    };

    const checks = {
      bundleVersionPass:
        versionObservation.exitCode === 0 &&
        versionObservation.stdout.trim() === releaseVersion,
      initializedPass: initObservation.exitCode === 0,
      baselineReportPass: beforeObservation.exitCode === 0,
      faultDetected: faultObservation.exitCode === 1,
      schemaRecoveryPass: schemaRecoveryObservation.exitCode === 0,
      recoveredReportPass: recoveredObservation.exitCode === 0,
      deployedArtifactMatchesSource: bundleHash === deployedBundleHash,
      restoredSchemaMatchesSource:
        recoveredSchemaHash === sha256Buffer(originalSchema),
    };
    const verdict = Object.values(checks).every(Boolean) ? "go" : "no_go";

    const evidence = {
      schemaVersion: "qeg-action-lifecycle-evidence-v1",
      releaseVersion,
      sourceRevision,
      generatedAt: new Date().toISOString(),
      change: {
        id: "CHANGE-QEG-ACTION-BUNDLED-CLI",
        summary:
          "Replace the npm-published default command with a CLI bundle stored in the GitHub Action tag.",
        sourceRefs: [
          "qeg-report-action/action.yml",
          "qeg-report-action/dist/cli.mjs",
          "package.json",
        ],
      },
      risks: [
        {
          id: "RISK-ACTION-BUNDLE-MISSING",
          priority: "P0",
          scenario: "The tagged Action cannot start because its CLI bundle is absent or stale.",
          mitigation: "Build and commit the bundle, compare source/deployed hashes, and execute --version.",
        },
        {
          id: "RISK-ACTION-SCHEMA-UNAVAILABLE",
          priority: "P0",
          scenario: "The bundled CLI starts but cannot load the schemas shipped with the tag.",
          mitigation: "Run a real report, inject schema corruption, restore the schema, and rerun.",
        },
        {
          id: "RISK-ACTION-RECOVERY-NO-EVIDENCE",
          priority: "P1",
          scenario: "Recovery appears successful but produces no new machine-readable evidence.",
          mitigation: "Persist before, fault, recovery, and lifecycle evidence with SHA-256 hashes.",
        },
      ],
      tests: {
        profile: "strict",
        checks,
        target: "<deployment-root>/consumer/.qeg",
      },
      deployment: {
        type: "isolated_copy",
        environment: "ci",
        environmentId: "qeg-action-release-acceptance",
        deployedAt,
        logicalRoot: "<deployment-root>/release-root",
        artifactSha256: bundleHash,
        deployedArtifactSha256: deployedBundleHash,
      },
      observations: [
        { stage: "deployed", ...versionObservation },
        { stage: "initialized", ...initObservation },
        { stage: "steady_state", ...beforeObservation },
        { stage: "fault", ...faultObservation },
        { stage: "recovery_schema", ...schemaRecoveryObservation },
        { stage: "recovered", ...recoveredObservation },
      ].map(({ stdout, stderr, ...observation }) => observation),
      fault: {
        type: "schema_corruption",
        target: "schemas/gate-input.schema.json",
        startedAt: faultStartedAt,
        endedAt: faultEndedAt,
        expectedExitCode: 1,
        observedExitCode: faultObservation.exitCode,
      },
      recovery: {
        action: "restore_schema_from_tag_source",
        startedAt: recoveryStartedAt,
        endedAt: recoveryEndedAt,
        confirmed: checks.schemaRecoveryPass && checks.recoveredReportPass,
        restoredArtifactSha256: recoveredSchemaHash,
      },
      newEvidence: [
        {
          id: "qeg:action-before-report",
          evidenceKind: "test_result",
          ...beforeArtifact,
        },
        {
          id: "qeg:action-fault-observation",
          evidenceKind: "observability_log",
          ...faultArtifact,
        },
        {
          id: "qeg:action-recovered-report",
          evidenceKind: "test_result",
          ...recoveredArtifact,
        },
      ],
      verdict,
    };

    const evidenceSchema = JSON.parse(await readFile(evidenceSchemaPath, "utf8"));
    const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
    const validate = ajv.compile(evidenceSchema);
    if (!validate(evidence)) {
      throw new Error(`generated lifecycle evidence is invalid: ${ajv.errorsText(validate.errors)}`);
    }

    await writeFile(options.out, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(`Action lifecycle acceptance: ${verdict}`);
    console.log(`Evidence: ${options.out}`);
    if (verdict !== "go") process.exitCode = 1;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
