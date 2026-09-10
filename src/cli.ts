#!/usr/bin/env node
import { exit } from "process";
import { runBuildGraphCommand, runPlaceTestsCommand } from "./cli/pipeline.js";
import { QEG_VERSION } from "./version.js";
import { readPublishedOutputs, recoverOutputs } from "./output-publication.js";
import { readFile } from "fs/promises";
import { applyConsumerMigration, planConsumerMigration } from "./consumer-migration.js";
import {
  runBaselineCommand,
  runCheckCommand,
  runDoctorCommand,
  runEnumCheckCommand,
  runEvidenceNormalizeCommand,
  runEvidenceVerifyCommand,
  runExplainCommand,
  runGateCommand,
  runInitCommand,
  runPolicyLintCommand,
  runRecordCommand,
  runReportCommand,
  runReproBundleCommand,
  runSchemaCheckCommand,
  runSnapshotCommand,
  runValidateCommand,
} from "./cli/commands.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args[0] === "--help" || args[0] === "-h") {
    console.log("Usage: qeg <command> [options] <fixture-dir-or-parent>");
    console.log("Commands: build-graph, place-tests, validate, gate, record, outputs, migrate, report, baseline, doctor, explain, schema-check, enum-check, evidence, policy, repro-bundle, check, init, snapshot");
    exit(0);
  }
  if (args[0] === "--version" || args[0] === "-v") {
    console.log(QEG_VERSION);
    exit(0);
  }

  if (args.length < 1) {
    console.error("Usage: qeg <command> <fixture-dir>");
    console.error("Commands: build-graph, place-tests, validate, gate, record, outputs, migrate, report, baseline, doctor, explain, schema-check, enum-check, evidence, policy, repro-bundle, check, init, snapshot");
    exit(1);
  }

  const [command, ...commandArgs] = args;
  const fixtureDir = commandArgs[0];

  switch (command) {
    case "migrate": {
      const directory = commandArgs[0];
      const apply = commandArgs.includes("--apply");
      const configIndex = commandArgs.indexOf("--config");
      const configPath = configIndex >= 0 ? commandArgs[configIndex + 1] : undefined;
      const remaining = commandArgs.slice(1).filter((arg, i) => arg !== "--apply" && arg !== "--dry-run" && arg !== "--config" && i + 1 !== configIndex + 1);
      if (!directory || remaining.length || (configIndex >= 0 && !configPath) || (apply && (!configPath || commandArgs.includes("--dry-run")))) throw new Error("Usage: qeg migrate <target-dir> [--config <config.json>] [--dry-run|--apply]");
      const config = configPath ? JSON.parse(await readFile(configPath, "utf8")) : undefined;
      const report = apply ? await applyConsumerMigration(directory, config) : await planConsumerMigration(directory, config);
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = ["blocked", "needs_configuration"].includes(report.status) ? 2 : 0;
      break;
    }
    case "outputs": {
      const [action, directory, ...extra] = commandArgs;
      if (!directory || extra.length || !["read", "recover"].includes(action)) throw new Error("Usage: qeg outputs <read|recover> <target-dir>");
      if (action === "recover") console.log(`Recovered generation: ${await recoverOutputs(directory)}`);
      else {
        const output = await readPublishedOutputs(directory);
        console.log(JSON.stringify({ generation: output.generation, files: Object.fromEntries(output.files) }, null, 2));
      }
      break;
    }
    case "build-graph":
    case "place-tests":
      if (!fixtureDir || commandArgs.length !== 1) throw new Error(`Usage: qeg ${command} <target-dir>`);
      if (command === "build-graph") await runBuildGraphCommand(fixtureDir);
      else await runPlaceTestsCommand(fixtureDir);
      break;
    case "validate":
      if (!fixtureDir) {
        console.error("Usage: qeg validate <fixture-dir>");
        exit(1);
      }
      await runValidateCommand(fixtureDir);
      break;
    case "gate":
      if (!fixtureDir) {
        console.error("Usage: qeg gate <fixture-dir>");
        exit(1);
      }
      await runGateCommand(fixtureDir);
      break;
    case "record":
      if (!fixtureDir) {
        console.error("Usage: qeg record <fixture-dir>");
        exit(1);
      }
      await runRecordCommand(fixtureDir);
      break;
    case "report":
      await runReportCommand(commandArgs);
      break;
    case "baseline":
      await runBaselineCommand(commandArgs);
      break;
    case "doctor":
      await runDoctorCommand(commandArgs);
      break;
    case "explain":
      await runExplainCommand(commandArgs);
      break;
    case "schema-check":
      await runSchemaCheckCommand(commandArgs);
      break;
    case "enum-check":
      await runEnumCheckCommand(commandArgs);
      break;
    case "evidence":
      if (commandArgs[0] === "normalize") {
        await runEvidenceNormalizeCommand(commandArgs.slice(1));
        break;
      }
      if (commandArgs[0] !== "verify") {
        console.error("Usage: qeg evidence verify <fixture-dir-or-parent> [...] | qeg evidence normalize --adapter <kind> --input <raw.json> --context <context.json> --out <evidence.json>");
        exit(1);
      }
      await runEvidenceVerifyCommand(commandArgs.slice(1));
      break;
    case "policy":
      if (commandArgs[0] !== "lint") {
        console.error("Usage: qeg policy lint <fixture-dir-or-parent> [...]");
        exit(1);
      }
      await runPolicyLintCommand(commandArgs.slice(1));
      break;
    case "repro-bundle":
      await runReproBundleCommand(commandArgs);
      break;
    case "check":
      await runCheckCommand(commandArgs);
      break;
    case "init":
      await runInitCommand(commandArgs);
      break;
    case "snapshot":
      await runSnapshotCommand(commandArgs);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      exit(1);
  }
}

main().catch((error) => {
  console.error(`Command failure: ${error}`);
  exit(1);
});
