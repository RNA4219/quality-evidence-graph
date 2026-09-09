import { readFile, stat } from "fs/promises";
import { CliError } from "./errors.js";

export function isMissingFile(error: unknown): boolean { return (error as NodeJS.ErrnoException)?.code === "ENOENT"; }

export async function optionalText(path: string): Promise<string | undefined> {
  try { return await readFile(path, "utf8"); }
  catch (error) {
    if (isMissingFile(error)) return undefined;
    throw new CliError(`Cannot read ${path}: ${String(error)}`);
  }
}

export async function optionalStat(path: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try { return await stat(path); }
  catch (error) {
    if (isMissingFile(error)) return null;
    throw new CliError(`Cannot stat ${path}: ${String(error)}`);
  }
}
