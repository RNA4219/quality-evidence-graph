import { exit } from "process";
import {
  runGateCommand,
  runRecordCommand,
  runReportCommand,
  runValidateCommand,
} from "./cli/commands.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Usage: qeg <command> <fixture-dir>");
    console.error("Commands: validate, gate, record, report");
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
    default:
      console.error(`Unknown command: ${command}`);
      exit(1);
  }
}

main().catch((error) => {
  console.error(`Command failure: ${error}`);
  exit(1);
});
