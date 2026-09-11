import { resolve } from "path";

export function portablePath(path: string): string { return path.replace(/\\/g, "/"); }

/** Lexical identity with an explicit base; never accept a partial filename suffix. */
export function pathKey(path: string, base = process.cwd()): string {
  const absolute = portablePath(resolve(base, portablePath(path)));
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

export function pathWithin(path: string, directory: string): boolean {
  const root = pathKey(directory);
  const candidate = pathKey(path);
  return candidate === root || candidate.startsWith(root.endsWith("/") ? root : root + "/");
}
