import { createHash } from "crypto";
import { readFile, realpath } from "fs/promises";
import { dirname, isAbsolute, relative, resolve } from "path";
import { CliError } from "../errors.js";


export function containedPath(baseDir: string, rawPath: string, label: string): string {
  const resolved = resolve(baseDir, rawPath);
  const offset = relative(baseDir, resolved);
  if (isAbsolute(rawPath) || isOutsideBase(offset)) {
    throw new CliError(`${label} must be contained within --base-dir`);
  }
  return resolved;
}


/** `relative()` uses the current platform separator; accept both forms for portable input. */
export function isOutsideBase(offset: string): boolean {
  return offset === "" || offset === ".." || offset.startsWith("../") || offset.startsWith("..\\") || isAbsolute(offset);
}


export async function assertRealContained(realBaseDir: string, path: string, label: string): Promise<string> {
  let actual: string;
  try {
    actual = await realpath(path);
  } catch (error) {
    throw new CliError(`Cannot resolve ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const offset = relative(realBaseDir, actual);
  if (offset !== "" && isOutsideBase(offset)) throw new CliError(`${label} resolves outside --base-dir`);
  return actual;
}


export async function assertOutputParentContained(realBaseDir: string, outPath: string): Promise<string> {
  let actualParent: string;
  try {
    actualParent = await realpath(dirname(outPath));
  } catch (error) {
    throw new CliError(`Cannot resolve --out parent directory: ${error instanceof Error ? error.message : String(error)}`);
  }
  const offset = relative(realBaseDir, actualParent);
  if (offset !== "" && isOutsideBase(offset)) throw new CliError("--out parent resolves outside --base-dir");
  return actualParent;
}


export function sameFilesystemPath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}


export async function readBytes(path: string, label: string): Promise<Buffer> {
  try {
    return await readFile(path);
  } catch (error) {
    throw new CliError(`Cannot read ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}


export function sha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
