import { writeFile } from "fs/promises";
import { join, relative } from "path";
import { exit } from "process";
import { collectReportTargets, createCiReport, type CiReport } from "./report.js";
import { CliError } from "./errors.js";
import { optionalText } from "./file-errors.js";
import { pathKey, portablePath } from "./path-key.js";

interface SnapshotOptions {
  readonly update: boolean;
  readonly targets: readonly string[];
}

export interface SnapshotResult {
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

function legacyValue(value: unknown, target: string, anchor: string): unknown {
  // The recorded target defines the old anchor. Never infer it from the invocation cwd.
  if (typeof value === "string") return portablePath(value).split(target).join(anchor);
  if (Array.isArray(value)) return value.map(child => legacyValue(child, target, anchor));
  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      normalized[key] = key === "generatedAt" ? "<snapshot>" : legacyValue(child, target, anchor);
    }
    return normalized;
  }
  return value;
}

function normalizeReport(report: CiReport): unknown {
  // Only volatile report fields are canonicalized; source refs and free text retain their meaning.
  return { snapshotVersion: "qeg-report-snapshot-v1", report: {
    ...report, generatedAt: "<snapshot>", targets: report.targets.map(target => ({ ...target, target: "<target>" })),
  } };
}

function matchesSnapshot(expected: string, report: CiReport): boolean {
  let parsed: { snapshotVersion?: unknown; targets?: { target?: unknown }[] };
  try { parsed = JSON.parse(expected); } catch { return false; }
  if (!parsed || typeof parsed !== "object") return false;
  if (parsed.snapshotVersion !== undefined) return JSON.stringify(parsed) === JSON.stringify(normalizeReport(report));
  const anchor = parsed.targets?.length === 1 ? parsed.targets[0]?.target : undefined;
  if (typeof anchor !== "string" || !anchor || report.targets.length !== 1) return false;
  return JSON.stringify(parsed) === JSON.stringify(legacyValue(report, portablePath(report.targets[0]!.target), anchor));
}

function snapshotPath(target: string): string {
  return join(target, "expected-report.json");
}

async function readSnapshot(path: string): Promise<string | undefined> {
  return optionalText(path);
}

async function checkTargetSnapshot(target: string, update: boolean): Promise<SnapshotResult> {
  const report = await createCiReport([pathKey(target)]);
  const content = `${JSON.stringify(normalizeReport(report), null, 2)}\n`;
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
    status: matchesSnapshot(expected, report) ? "pass" : "mismatch",
    path,
  };
}

export async function createSnapshotResults(
  rawTargets: readonly string[],
  update = false
): Promise<SnapshotResult[]> {
  const targets = await collectReportTargets(rawTargets);
  const results: SnapshotResult[] = [];
  for (const target of targets) {
    results.push(await checkTargetSnapshot(target, update));
  }
  return results;
}

export async function runSnapshotCommand(args: readonly string[]): Promise<void> {
  const options = parseSnapshotArgs(args);
  const results = await createSnapshotResults(options.targets, options.update);
  console.log("QEG Report Snapshots");
  for (const result of results) {
    console.log(`- ${result.status.toUpperCase()} ${relative(process.cwd(), result.target)} -> ${relative(process.cwd(), result.path)}`);
  }

  const failed = results.some((result) => result.status === "missing" || result.status === "mismatch");
  exit(failed ? 2 : 0);
}
