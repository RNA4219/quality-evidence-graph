import { exit } from "process";
import { getExitCode } from "../gate.js";
import { runBaselineCommand } from "./baseline.js";
import { runCheckCommand } from "./check.js";
import { runDoctorCommand } from "./doctor.js";
import { runEnumCheckCommand } from "./enum-check.js";
import { runEvidenceVerifyCommand } from "./evidence-verify.js";
import { runExplainCommand } from "./dq-explain.js";
import { CliError } from "./errors.js";
import { evaluateFixture, readExpectedVerdict } from "./fixture-io.js";
import { runInitCommand } from "./init.js";
import { runPolicyLintCommand } from "./policy-lint.js";
import { runReportCommand } from "./report.js";
import { runReproBundleCommand } from "./repro-bundle.js";
import { writeOutputRecord } from "./record.js";
import { runSchemaCheckCommand } from "./schema-check.js";
import { runSnapshotCommand } from "./snapshot.js";
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

export {
  runBaselineCommand,
  runCheckCommand,
  runDoctorCommand,
  runEnumCheckCommand,
  runEvidenceVerifyCommand,
  runExplainCommand,
  runInitCommand,
  runPolicyLintCommand,
  runReportCommand,
  runReproBundleCommand,
  runSchemaCheckCommand,
  runSnapshotCommand,
};
