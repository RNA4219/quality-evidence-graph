import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { CliError } from "./errors.js";

// Both dist/cli/*.js and qeg-report-action/dist/cli.mjs are two levels below the distribution root.
const root = fileURLToPath(new URL("../../", import.meta.url));
export function distributionPath(...segments: string[]): string { return join(root, ...segments); }
export interface DistributionMetadata {
  readonly runtimeVersion: "qeg-runtime/v1";
  readonly package: { readonly name: string; readonly version: string; readonly engines?: { readonly node?: string } };
  readonly enums: Readonly<Record<string, readonly string[]>>;
}
export async function readDistributionMetadata(): Promise<DistributionMetadata> {
  const path = distributionPath("qeg-report-action", "runtime-metadata.json");
  const value = JSON.parse(await readFile(path, "utf8"));
  if (value?.runtimeVersion !== "qeg-runtime/v1" || typeof value.package?.name !== "string" || typeof value.package?.version !== "string" || !value.enums || typeof value.enums !== "object") throw new CliError(`Invalid packaged runtime metadata: ${path}`);
  return value as DistributionMetadata;
}
