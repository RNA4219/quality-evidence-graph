import { lstat, readFile } from "fs/promises";
import { join } from "path";
import { contentHash } from "../record.js";
import { validateOutput } from "../validation/output.js";
import { optionalText } from "./file-errors.js";
import { readPublishedOutputs } from "../output-publication.js";

export async function verifyOutputManifest(directory: string): Promise<string[] | undefined> {
  if (await optionalText(join(directory, ".qeg-current.json")) !== undefined) {
    const snapshot = await readPublishedOutputs(directory);
    const content = snapshot.files.get("output-manifest.json");
    if (!content) return ["Current generation is an intermediate result, not a completed record"];
    return checkManifest(content, async name => {
      const bytes = snapshot.files.get(name);
      if (bytes === undefined) throw new Error(`Output absent from generation: ${name}`);
      return bytes;
    });
  }
  try {
    await lstat(join(directory, ".qeg-generations"));
    return ["Output publication was interrupted or its pointer is missing; no completed generation"];
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const content = await optionalText(join(directory, "output-manifest.json"));
  if (content === undefined) return undefined;
  return checkManifest(content, name => readFile(join(directory, name), "utf8"));
}

async function checkManifest(content: string, read: (name: string) => Promise<string>): Promise<string[]> {
  const raw = JSON.parse(content);
  const schema = await validateOutput(raw, "output-manifest.schema.json");
  if (!schema.valid) return schema.issues.map(i => `${i.path} ${i.message}`);
  const files = raw.files as { path: string; contentHash: string }[];
  const errors: string[] = [];
  if (new Set(files.map(f => f.path)).size !== files.length) errors.push("Duplicate output manifest path");
  // Schema constrains filenames to the six supported outputs, before any file read.
  for (const file of files) {
    try { if (contentHash(await read(file.path)) !== file.contentHash) errors.push(`Hash mismatch: ${file.path}`); }
    catch (error) { errors.push(`Read output ${file.path}: ${String(error)}`); }
  }
  return errors;
}
