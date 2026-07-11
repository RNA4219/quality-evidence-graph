#!/usr/bin/env node
import { exit } from "process";
import {
  runBaselineCommand,
  runCheckCommand,
  runDoctorCommand,
  runEnumCheckCommand,
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
    console.log("Commands: validate, gate, record, report, baseline, doctor, explain, schema-check, enum-check, evidence, policy, repro-bundle, check, init, snapshot");
    exit(0);
  }
  if (args[0] === "--version" || args[0] === "-v") {
    console.log("0.2.0");
    exit(0);
  }

  if (args.length < 1) {
    console.error("Usage: qeg <command> <fixture-dir>");
    console.error("Commands: validate, gate, record, report, baseline, doctor, explain, schema-check, enum-check, evidence, policy, repro-bundle, check, init, snapshot");
    exit(1);
  }

  const [command, ...commandArgs] = args;
  const fixtureDir = commandArgs[0];

  switch (command) {
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
      if (commandArgs[0] !== "verify") {
        console.error("Usage: qeg evidence verify <fixture-dir-or-parent> [...]");
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
