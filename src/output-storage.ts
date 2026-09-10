import { createHash, randomUUID } from "crypto";
import { lstat, open, readFile, rename, unlink } from "fs/promises";
import { join } from "path";
import { CliError } from "./cli/errors.js";

export const POINTER = ".qeg-current.json";
export const GENERATIONS = ".qeg-generations";
export const digest = (bytes: string | Buffer) => "sha256:" + createHash("sha256").update(bytes).digest("hex");
export const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";
export const filename = (name: string) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) && name !== "generation.json";
export async function regular(path: string): Promise<void> {
  if (!(await lstat(path)).isFile()) throw new CliError(`Output is not a regular file: ${path}`);
}
export async function writeSynced(path: string, bytes: string): Promise<void> {
  const file = await open(path, "wx");
  try { await file.writeFile(bytes, "utf8"); await file.sync(); } finally { await file.close(); }
}
export async function replace(root: string, name: string, bytes: string): Promise<void> {
  const target = join(root, name);
  try { await regular(target); } catch (error) { if (!missing(error)) throw error; }
  const temporary = join(root, `.qeg-replace-${randomUUID()}`);
  await writeSynced(temporary, bytes);
  try { await rename(temporary, target); }
  catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
}
export async function optionalRegular(path: string): Promise<string | undefined> {
  try { await regular(path); return await readFile(path, "utf8"); }
  catch (error) { if (missing(error)) return undefined; throw error; }
}
