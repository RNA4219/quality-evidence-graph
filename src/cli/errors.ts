/**
 * CliError - CLI command failure exception
 *
 * Used for CLI-level failures (missing input, invalid arguments) that should
 * result in exit code 1. The command layer catches this and calls exit(1).
 * Gate verdict failures (exit code 2) use the normal GateResult flow.
 */
export class CliError extends Error {
  constructor(
    message: string,
    readonly cause?: Error
  ) {
    super(message);
    this.name = "CliError";
  }
}