import { exit } from "process";
import { runGateCommand, runRecordCommand, runValidateCommand } from "./cli/commands.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: qeg <command> <fixture-dir>");
    console.error("Commands: validate, gate, record");
    exit(1);
  }

  const [command, fixtureDir] = args;

  switch (command) {
    case "validate":
      await runValidateCommand(fixtureDir);
      break;
    case "gate":
      await runGateCommand(fixtureDir);
      break;
    case "record":
      await runRecordCommand(fixtureDir);
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
