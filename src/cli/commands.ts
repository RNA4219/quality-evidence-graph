import { exit } from "process";
import { getExitCode } from "../gate.js";
import { CliError } from "./errors.js";
import { evaluateFixture, readExpectedVerdict } from "./fixture-io.js";
import { runReportCommand } from "./report.js";
import { writeOutputRecord } from "./record.js";
import { validateEvaluatedFixture } from "./validation.js";

export async function runValidateCommand(fixtureDir: string): Promise<void> {
  try {
    const expected = await readExpectedVerdict(fixtureDir);
    const evaluated = await evaluateFixture(fixtureDir);
    validateEvaluatedFixture(expected, evaluated);
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      exit(1);
    }
    throw error;
  }
}

export async function runGateCommand(fixtureDir: string): Promise<void> {
  try {
    const evaluated = await evaluateFixture(fixtureDir);
    console.log(JSON.stringify(evaluated.gateResult, null, 2));
    exit(getExitCode(evaluated.gateResult.verdict, evaluated.policy));
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      exit(1);
    }
    throw error;
  }
}

export async function runRecordCommand(fixtureDir: string): Promise<void> {
  try {
    const evaluated = await evaluateFixture(fixtureDir);
    await writeOutputRecord(evaluated);
    exit(getExitCode(evaluated.gateResult.verdict, evaluated.policy));
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      exit(1);
    }
    throw error;
  }
}

export { runReportCommand };
