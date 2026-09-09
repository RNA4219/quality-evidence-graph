import { randomUUID } from "crypto";
import { lstat, open, rename, unlink } from "fs/promises";
import { basename, dirname, resolve } from "path";
import { CliError } from "../errors.js";
import { isMissingFile } from "../file-errors.js";

/** Caller has verified the real output parent is contained in the evidence base. */
export async function publishNormalizedEvidence(outPath: string, content: string, force: boolean): Promise<void> {
  try {
    const destination = await lstat(outPath);
    if (!destination.isFile()) throw new CliError(`Output is not a regular file: ${outPath}`);
    if (!force) throw new CliError(`Output already exists: ${outPath} (use --force to replace it)`);
  } catch (error) {
    if (!isMissingFile(error)) throw new CliError(`Inspect normalization output ${outPath}: ${String(error)}`);
  }
  const tempPath = resolve(dirname(outPath), `.${basename(outPath)}.${process.pid}.${randomUUID()}.tmp`);
  let owned = false;
  try {
    const handle = await open(tempPath, "wx");
    owned = true;
    try { await handle.writeFile(content, "utf8"); } finally { await handle.close(); }
    await rename(tempPath, outPath);
    owned = false;
  } catch (error) {
    if (owned) {
      try { await unlink(tempPath); }
      catch (cleanup) {
        if (!isMissingFile(cleanup)) throw new CliError(`Publish ${outPath}: ${String(error)}; cleanup ${tempPath}: ${String(cleanup)}`);
      }
    }
    throw new CliError(`Publish normalized evidence ${outPath}: ${String(error)}`);
  }
}
