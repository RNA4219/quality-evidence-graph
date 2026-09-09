import { lstat } from "fs/promises";
import { isAbsolute, resolve } from "path";
import { CliError } from "../errors.js";

export async function githubSummaryPath(environment: NodeJS.ProcessEnv): Promise<string> {
  const value = environment.GITHUB_STEP_SUMMARY;
  if (!value || !value.trim() || value.includes("\0") || !isAbsolute(value)) throw new CliError("--github-summary requires an absolute GITHUB_STEP_SUMMARY file path");
  const path = resolve(value);
  try {
    if (!(await lstat(path)).isFile()) throw new Error("not a regular file");
  } catch (error) { throw new CliError(`Inspect GITHUB_STEP_SUMMARY ${path}: ${String(error)}`); }
  return path;
}
