import { readFile, writeFile } from "fs/promises";
import { join, relative } from "path";
import { exit } from "process";
import { collectReportTargets, createCiReport, type CiReport } from "./report.js";
import { CliError } from "./errors.js";

interface SnapshotOptions {
  readonly update: boolean;
  readonly targets: readonly string[];
}

interface SnapshotResult {
  readonly target: string;
  readonly status: "pass" | "updated" | "missing" | "mismatch";
  readonly path: string;
}

function parseSnapshotArgs(args: readonly string[]): SnapshotOptions {
  const targets: string[] = [];
  let update = false;
  for (const arg of args) {
    if (arg === "--update") {
      update = true;
    } else {
      targets.push(arg);
    }
  }
  if (targets.length === 0) {
    throw new CliError("Usage: qeg snapshot [--update] <fixture-dir-or-parent> [...]");
  }
  return { update, targets };
}

function normalizeString(value: string): string {
  const cwd = process.cwd().replace(/\\/g, "/");
  return value.replace(/\\/g, "/").replaceAll(cwd, "<repo>");
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") return normalizeString(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      normalized[key] = key === "generatedAt" ? "<snapshot>" : normalizeValue(child);
    }
    return normalized;
  }
  return value;
}

function normalizeReport(report: CiReport): unknown {
  return normalizeValue(report);
}

function snapshotPath(target: string): string {
  return join(target, "expected-report.json");
}

async function readSnapshot(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return undefined;
  }
}

async function checkTargetSnapshot(target: string, update: boolean): Promise<SnapshotResult> {
  const report = normalizeReport(await createCiReport([target]));
  const content = `${JSON.stringify(report, null, 2)}\n`;
  const path = snapshotPath(target);

  if (update) {
    await writeFile(path, content, "utf-8");
    return { target, status: "updated", path };
  }

  const expected = await readSnapshot(path);
  if (expected === undefined) {
    return { target, status: "missing", path };
  }
  return {
    target,
    status: expected === content ? "pass" : "mismatch",
    path,
  };
}

export async function runSnapshotCommand(args: readonly string[]): Promise<void> {
  const options = parseSnapshotArgs(args);
  const targets = await collectReportTargets(options.targets);
  const results: SnapshotResult[] = [];
  for (const target of targets) {
    results.push(await checkTargetSnapshot(target, options.update));
  }

  console.log("QEG Report Snapshots");
  for (const result of results) {
    console.log(`- ${result.status.toUpperCase()} ${relative(process.cwd(), result.target)} -> ${relative(process.cwd(), result.path)}`);
  }

  const failed = results.some((result) => result.status === "missing" || result.status === "mismatch");
  exit(failed ? 2 : 0);
}

