import { realpathSync } from "fs";
import { basename, dirname, join, resolve } from "path";

export function portablePath(path: string): string { return path.replace(/\\/g, "/"); }

/** Resolve aliases through the nearest existing ancestor, including deleted changed files. */
export function pathKey(path: string, base = process.cwd()): string {
  let ancestor = resolve(base, portablePath(path));
  const missing: string[] = [];
  while (true) {
    try { ancestor = realpathSync.native(ancestor); break; }
    catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) break;
      missing.unshift(basename(ancestor)); ancestor = parent;
    }
  }
  const absolute = portablePath(join(ancestor, ...missing));
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

export function pathWithin(path: string, directory: string): boolean {
  const root = pathKey(directory);
  const candidate = pathKey(path);
  return candidate === root || candidate.startsWith(root.endsWith("/") ? root : root + "/");
}
