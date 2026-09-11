import { createHash } from "crypto";
import { mkdir, readFile, readdir } from "fs/promises";
import { basename, join, resolve } from "path";
import { exit } from "process";
import { collectReportTargets } from "./report.js";
import { createDoctorReport } from "./doctor.js";
import { CliError } from "./errors.js";
import { optionalText } from "./file-errors.js";
import { distributionPath, readDistributionMetadata } from "./distribution.js";
import { publishFiles, readGateInput, readPublishedOutputs, withOutputLease } from "../output-publication.js";

interface ReproBundleManifest {
  readonly reportVersion: "qeg-repro-bundle-v1";
  readonly generatedAt: string;
  readonly package: { readonly name: string; readonly version: string };
  readonly reportPath?: string;
  readonly files: readonly { readonly path: string; readonly sha256: string; readonly sourceTarget?: string }[];
  readonly inputErrors: readonly { readonly target: string; readonly error: string }[];
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

async function safeRead(path: string): Promise<string | undefined> {
  return optionalText(path);
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    if (/token|secret|password|api[_-]?key|credential/i.test(value)) return "[REDACTED]";
    return value.replace(/(ghp_|github_pat_|sk-)[A-Za-z0-9_\-]+/g, "[REDACTED]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = /token|secret|password|api[_-]?key|credential/i.test(key) ? "[REDACTED]" : redact(child);
    }
    return out;
  }
  return value;
}

function stageJson(contents: Map<string, string>, outDir: string, name: string, data: unknown, sourceTarget?: string): ReproBundleManifest["files"][number] {
  if (contents.has(name)) throw new CliError(`Duplicate repro bundle filename: ${name}`);
  const path = join(outDir, name);
  const content = `${JSON.stringify(redact(data), null, 2)}\n`;
  contents.set(name, content);
  return { path, sha256: sha256(content), ...(sourceTarget ? { sourceTarget } : {}) };
}

async function schemaInventory(): Promise<unknown[]> {
  const schemaDir = distributionPath("schemas");
  const schemas = await readdir(schemaDir);
  const rows: unknown[] = [];
  for (const file of schemas.filter((name) => name.endsWith(".schema.json")).sort()) {
    const path = join(schemaDir, file);
    const content = await readFile(path, "utf-8");
    rows.push({ file, sha256: sha256(content), bytes: content.length });
  }
  return rows;
}

function parseArgs(args: readonly string[]): { reportPath?: string; outDir: string; targets: string[] } {
  const targets: string[] = [];
  let reportPath: string | undefined;
  let outDir = ".qeg/repro-bundle";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--report") {
      reportPath = args[index + 1];
      if (!reportPath) throw new CliError("Expected path after --report");
      index += 1;
      continue;
    }
    if (arg === "--out") {
      outDir = args[index + 1] ?? outDir;
      index += 1;
      continue;
    }
    targets.push(arg);
  }
  return { reportPath, outDir, targets };
}

export async function runReproBundleCommand(args: readonly string[]): Promise<void> {
  const options = parseArgs(args);
  const outDir = resolve(options.outDir);
  const pkg = (await readDistributionMetadata()).package;
  const targets = options.targets.length > 0 ? await collectReportTargets(options.targets) : [];
  const files: ReproBundleManifest["files"][number][] = [];
  const contents = new Map<string, string>();
  const inputErrors: { target: string; error: string }[] = [];

  if (options.reportPath) {
    const report = await readJson<unknown>(options.reportPath);
    files.push(stageJson(contents, outDir, "qeg-ci-report.json", report));
  }
  files.push(stageJson(contents, outDir, "doctor.json", await createDoctorReport(targets)));
  files.push(stageJson(contents, outDir, "schemas.json", await schemaInventory()));

  const workflow = await safeRead(".github/workflows/ci.yml");
  if (workflow !== undefined) {
    files.push(stageJson(contents, outDir, "workflow.json", { path: ".github/workflows/ci.yml", content: workflow }));
  }

  for (const target of targets) {
    let input: unknown;
    try {
      input = JSON.parse(await readGateInput(target));
    } catch (error) {
      inputErrors.push({ target, error: String(redact(error instanceof Error ? error.message : String(error))) });
      continue;
    }
    files.push(stageJson(contents, outDir, `gate-input-${sha256(target)}.json`, input, target));
  }

  const manifest: ReproBundleManifest = {
    reportVersion: "qeg-repro-bundle-v1",
    generatedAt: new Date().toISOString(),
    package: { name: pkg.name, version: pkg.version },
    reportPath: options.reportPath,
    files,
    inputErrors,
  };
  const manifestPath = join(outDir, "manifest.json");
  // Structural paths must remain usable even when directory names contain words such as "secret".
  // Payloads and diagnostic messages were redacted before their hashes were recorded.
  contents.set("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  await mkdir(outDir, { recursive: true });
  await withOutputLease(outDir, async root => {
    await publishFiles(root, contents);
    const published = await readPublishedOutputs(root);
    const sealed = JSON.parse(published.files.get("manifest.json")!) as ReproBundleManifest;
    if (sealed.files.length !== files.length || new Set(sealed.files.map(file => file.path)).size !== files.length) throw new CliError("Repro bundle manifest file set mismatch");
    for (const file of sealed.files) {
      const content = published.files.get(basename(file.path));
      if (content === undefined || sha256(content) !== file.sha256) throw new CliError(`Repro bundle hash mismatch: ${file.path}`);
    }
  });
  console.log(`QEG repro bundle written to: ${outDir}`);
  console.log(`Manifest: ${manifestPath}`);
  if (inputErrors.length) console.log(`Input capture diagnostics: ${inputErrors.length}; see manifest.inputErrors`);
  exit(0);
}
