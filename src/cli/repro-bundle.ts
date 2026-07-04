import { createHash } from "crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import { basename, join, resolve } from "path";
import { exit } from "process";
import { collectReportTargets } from "./report.js";
import { createDoctorReport } from "./doctor.js";
import { CliError } from "./errors.js";

interface ReproBundleManifest {
  readonly reportVersion: "qeg-repro-bundle-v1";
  readonly generatedAt: string;
  readonly package: { readonly name: string; readonly version: string };
  readonly reportPath?: string;
  readonly files: readonly { readonly path: string; readonly sha256: string }[];
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

async function safeRead(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return undefined;
  }
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

async function writeJson(outDir: string, name: string, data: unknown): Promise<{ path: string; sha256: string }> {
  const path = join(outDir, name);
  const content = `${JSON.stringify(redact(data), null, 2)}\n`;
  await writeFile(path, content, "utf-8");
  return { path, sha256: sha256(content) };
}

async function schemaInventory(): Promise<unknown[]> {
  const schemas = await readdir("schemas");
  const rows: unknown[] = [];
  for (const file of schemas.filter((name) => name.endsWith(".schema.json")).sort()) {
    const path = join("schemas", file);
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
  await mkdir(outDir, { recursive: true });
  const pkg = await readJson<{ name: string; version: string }>("package.json");
  const targets = options.targets.length > 0 ? await collectReportTargets(options.targets) : [];
  const files: { path: string; sha256: string }[] = [];

  if (options.reportPath) {
    const report = await readJson<unknown>(options.reportPath);
    files.push(await writeJson(outDir, "qeg-ci-report.json", report));
  }
  files.push(await writeJson(outDir, "doctor.json", await createDoctorReport(targets)));
  files.push(await writeJson(outDir, "schemas.json", await schemaInventory()));

  const workflow = await safeRead(".github/workflows/ci.yml");
  if (workflow !== undefined) {
    files.push(await writeJson(outDir, "workflow.json", { path: ".github/workflows/ci.yml", content: workflow }));
  }

  for (const target of targets) {
    const inputPath = join(target, "gate-input.json");
    try {
      if ((await stat(inputPath)).isFile()) {
        files.push(await writeJson(outDir, `gate-input-${basename(target)}.json`, await readJson<unknown>(inputPath)));
      }
    } catch {
      // Missing gate-input is already covered by doctor.
    }
  }

  const manifest: ReproBundleManifest = {
    reportVersion: "qeg-repro-bundle-v1",
    generatedAt: new Date().toISOString(),
    package: { name: pkg.name, version: pkg.version },
    reportPath: options.reportPath,
    files,
  };
  const manifestPath = join(outDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  console.log(`QEG repro bundle written to: ${outDir}`);
  console.log(`Manifest: ${manifestPath}`);
  exit(0);
}
