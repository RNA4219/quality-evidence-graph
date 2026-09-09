import { readFile, realpath, stat } from "fs/promises";
import { isAbsolute, relative, resolve } from "path";
import type { IngestManifest, LoadedArtifact } from "../types.js";
import { contentHash } from "../record.js";
import { validateOutput } from "../validation/output.js";
import { CliError } from "./errors.js";
import { isMissingFile } from "./file-errors.js";

function outside(base: string, target: string): boolean {
  const path = relative(base, target);
  return !path || path === ".." || path.startsWith("../") || path.startsWith("..\\") || isAbsolute(path);
}
export async function loadRawArtifacts(directory: string): Promise<{ manifest: IngestManifest; loaded: LoadedArtifact[] }> {
  const base = await realpath(resolve(directory));
  const path = resolve(base, "ingest-manifest.json");
  let raw: unknown;
  try { raw = JSON.parse(await readFile(path, "utf8")); }
  catch (error) { throw new CliError(`Read/parse ingest manifest ${path}: ${String(error)}`); }
  const validation = await validateOutput(raw, "ingest-manifest.schema.json");
  if (!validation.valid) throw new CliError(`Invalid ingest manifest ${path}: ${validation.issues.map(i => `${i.path} ${i.message}`).join("; ")}`);
  const manifest = raw as IngestManifest;
  const loaded: LoadedArtifact[] = [];
  for (const ref of manifest.artifacts) {
    const fail = (code: "DQ-01" | "DQ-06" | "DQ-12", message: string): void => { loaded.push({ ref, payload: undefined, failure: { code, message } }); };
    const target = resolve(base, ref.path);
    if (isAbsolute(ref.path) || /^[A-Za-z]:|^[/\\]/.test(ref.path) || outside(base, target)) { fail("DQ-06", `Artifact must be inside the ingest target: ${ref.path}`); continue; }
    let bytes: Buffer;
    try {
      if (outside(base, await realpath(target))) { fail("DQ-06", `Artifact symlink escapes target: ${ref.path}`); continue; }
      if (!(await stat(target)).isFile()) { fail("DQ-06", `Artifact is not a regular file: ${ref.path}`); continue; }
      bytes = await readFile(target);
    } catch (error) {
      if (isMissingFile(error)) { fail("DQ-06", `Artifact missing: ${ref.path}`); continue; }
      throw new CliError(`Read artifact ${target}: ${String(error)}`);
    }
    if (!ref.contentHash || ref.contentHash !== contentHash(bytes)) { fail("DQ-06", `Artifact contentHash missing or mismatched: ${ref.path}`); continue; }
    if (!ref.revision || ref.revision !== manifest.metadata.headRef) { fail("DQ-12", `Artifact revision missing or mismatched: ${ref.path}`); continue; }
    try { loaded.push({ ref, payload: JSON.parse(bytes.toString("utf8")) }); }
    catch (error) { fail("DQ-01", `Parse artifact ${ref.path}: ${String(error)}`); }
  }
  return { manifest, loaded };
}
