import { readFile } from "fs/promises";
import { join } from "path";
import { contentHash } from "../record.js";
import { validateOutput } from "../validation/output.js";
import { optionalText } from "./file-errors.js";

export async function verifyOutputManifest(directory: string): Promise<string[] | undefined> {
  const content = await optionalText(join(directory, "output-manifest.json"));
  if (content === undefined) return undefined;
  const raw = JSON.parse(content);
  const schema = await validateOutput(raw, "output-manifest.schema.json");
  if (!schema.valid) return schema.issues.map(i => `${i.path} ${i.message}`);
  const files = raw.files as { path: string; contentHash: string }[];
  const errors: string[] = [];
  if (new Set(files.map(f => f.path)).size !== files.length) errors.push("Duplicate output manifest path");
  // Schema constrains filenames to the six supported outputs, before any file read.
  for (const file of files) {
    try { if (contentHash(await readFile(join(directory, file.path))) !== file.contentHash) errors.push(`Hash mismatch: ${file.path}`); }
    catch (error) { errors.push(`Read output ${join(directory, file.path)}: ${String(error)}`); }
  }
  return errors;
}
