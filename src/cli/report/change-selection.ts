import { execFile } from "child_process";
import { readFile } from "fs/promises";
import { join, relative } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
export type ChangeSelectionStrategy = "all" | "env" | "origin_main" | "head_parent" | "worktree";
export type ChangeSelectionStatus = "selected" | "no_relevant_changes" | "detection_failed";
export interface ReportSelection {
  readonly mode: "all" | "changed_only";
  readonly status: ChangeSelectionStatus;
  readonly strategy: ChangeSelectionStrategy;
  readonly changedFileCount: number;
  readonly selectedTargetCount: number;
  readonly error?: string;
}
export interface ChangeSelectionResult { readonly targets: readonly string[]; readonly selection: ReportSelection; }
interface GateInputForChangedOnly {
  readonly graph?: { readonly nodes?: readonly { readonly kind?: string; readonly path?: string }[] };
  readonly metadata?: { readonly inputArtifacts?: readonly { readonly path?: string }[] };
}
function portable(path: string): string { return path.split(String.fromCharCode(92)).join("/"); }
function relativeTarget(target: string): string { return portable(relative(process.cwd(), target)); }
async function changedFiles(): Promise<{ files: string[]; strategy: Exclude<ChangeSelectionStrategy, "all">; error?: string }> {
  if (process.env.QEG_CHANGED_FILES !== undefined) {
    const files = process.env.QEG_CHANGED_FILES.split(/[,\r\n]+/).map((file) => portable(file.trim())).filter(Boolean);
    return { files, strategy: "env" };
  }
  try { await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"]); }
  catch (error) { return { files: [], strategy: "worktree", error: "git repository detection failed: " + error }; }
  const attempts: readonly { strategy: "origin_main" | "head_parent"; args: string[] }[] = [
    { strategy: "origin_main", args: ["diff", "--name-only", "--diff-filter=ACMRTUXB", "origin/main...HEAD"] },
    { strategy: "head_parent", args: ["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD~1...HEAD"] },
  ];
  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const { stdout } = await execFileAsync("git", attempt.args);
      return { files: stdout.split(/\r?\n/).map((file) => portable(file.trim())).filter(Boolean), strategy: attempt.strategy };
    } catch (error) { errors.push(attempt.strategy + ": " + error); }
  }
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
    const files = stdout.split(/\r?\n/).filter(Boolean)
      .map((line) => line.slice(3).trim())
      .map((path) => path.includes(" -> ") ? path.split(" -> ").at(-1) ?? path : path)
      .map(portable);
    if (files.length > 0) return { files, strategy: "worktree" };
    errors.push("worktree: clean worktree cannot replace unavailable history");
  } catch (error) {
    errors.push("worktree: " + error);
  }
  return { files: [], strategy: "worktree", error: "all changed-file detection strategies failed: " + errors.join(" | ") };
}
async function targetMentionsChangedFile(target: string, files: readonly string[]): Promise<boolean> {
  const relTarget = relativeTarget(target);
  if (files.some((file) => file === relTarget || file.startsWith(relTarget + "/"))) return true;
  try {
    const input = JSON.parse(await readFile(join(target, "gate-input.json"), "utf-8")) as GateInputForChangedOnly;
    const artifacts = (input.metadata?.inputArtifacts ?? []).map((artifact) => artifact.path).filter((path): path is string => Boolean(path)).map(portable);
    const changedCode = (input.graph?.nodes ?? []).filter((node) => node.kind === "changed_code" && node.path).map((node) => portable(node.path as string));
    return [...artifacts, ...changedCode].some((path) => files.includes(path));
  } catch { return false; }
}
export async function selectChangedTargets(targets: readonly string[], changedOnly = false): Promise<ChangeSelectionResult> {
  if (!changedOnly) return { targets: [...targets], selection: { mode: "all", status: "selected", strategy: "all", changedFileCount: 0, selectedTargetCount: targets.length } };
  const detected = await changedFiles();
  if (detected.error) return { targets: [], selection: { mode: "changed_only", status: "detection_failed", strategy: detected.strategy, changedFileCount: 0, selectedTargetCount: 0, error: detected.error } };
  const selected: string[] = [];
  for (const target of targets) if (await targetMentionsChangedFile(target, detected.files)) selected.push(target);
  return {
    targets: selected,
    selection: {
      mode: "changed_only",
      status: selected.length > 0 ? "selected" : "no_relevant_changes",
      strategy: detected.strategy,
      changedFileCount: detected.files.length,
      selectedTargetCount: selected.length,
    },
  };
}
