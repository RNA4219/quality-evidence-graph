import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { CliError } from "./errors.js";

/** Same distribution root for dist/cli/*.js and the bundled Action. */
export async function starterRuntimeFiles(): Promise<ReadonlyMap<string, string>> {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const files = new Map<string, string>();
  const visit = async (relativePath: string): Promise<void> => {
    for (const entry of (await readdir(join(root, relativePath), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(relativePath, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.set(path, await readFile(join(root, path), "utf8"));
      else throw new CliError(`Unsupported packaged runtime entry ${path}`);
    }
  };
  try {
    await visit("qeg-report-action"); await visit("schemas");
    files.set("LICENSE", await readFile(join(root, "LICENSE"), "utf8"));
  } catch (error) { throw new CliError(`Read starter runtime in ${root}: ${String(error)}`); }
  return files;
}
