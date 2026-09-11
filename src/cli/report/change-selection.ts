import { execFile } from "child_process";
import { promisify } from "util";
import { readGateInput, withOutputLease } from "../../output-publication.js";
import { validateGateInput } from "../../validation/schema.js";
import { pathKey, pathWithin, portablePath } from "../path-key.js";

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
async function changedFiles(): Promise<{ files: string[]; base: string; strategy: Exclude<ChangeSelectionStrategy, "all">; error?: string }> {
  let base = process.cwd();
  if (process.env.QEG_CHANGED_FILES !== undefined) {
    const files = process.env.QEG_CHANGED_FILES.split(/[,\r\n]+/).map(file => file.trim()).filter(Boolean).map(file => pathKey(file, base));
    return { files, base, strategy: "env" };
  }
  try { base = (await execFileAsync("git", ["rev-parse", "--show-toplevel"])).stdout.replace(/\r?\n$/, ""); }
  catch (error) { return { files: [], base, strategy: "worktree", error: "git repository detection failed: " + error }; }
  const attempts: readonly { strategy: "origin_main" | "head_parent"; args: string[] }[] = [
    { strategy: "origin_main", args: ["diff", "--name-only", "-z", "--no-relative", "--no-renames", "--diff-filter=ACDMRTUXB", "origin/main...HEAD"] },
    { strategy: "head_parent", args: ["diff", "--name-only", "-z", "--no-relative", "--no-renames", "--diff-filter=ACDMRTUXB", "HEAD~1...HEAD"] },
  ];
  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const { stdout } = await execFileAsync("git", attempt.args);
      return { files: stdout.split("\0").filter(Boolean).map(file => pathKey(file, base)), base, strategy: attempt.strategy };
    } catch (error) { errors.push(attempt.strategy + ": " + error); }
  }
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    const records = stdout.split("\0").filter(Boolean);
    const files: string[] = [];
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      files.push(pathKey(record.slice(3), base));
      if (/[RC]/.test(record.slice(0, 2)) && records[index + 1] !== undefined) files.push(pathKey(records[++index], base));
    }
    if (files.length > 0) return { files, base, strategy: "worktree" };
    errors.push("worktree: clean worktree cannot replace unavailable history");
  } catch (error) {
    errors.push("worktree: " + error);
  }
  return { files: [], base, strategy: "worktree", error: "all changed-file detection strategies failed: " + errors.join(" | ") };
}
async function targetMentionsChangedFile(target: string, files: readonly string[], base: string): Promise<boolean> {
  if (files.some(file => pathWithin(file, target))) return true;
  try {
    return await withOutputLease(target, async root => {
      const validation = await validateGateInput(JSON.parse(await readGateInput(root)));
      // Uncertain relevance must enter normal evaluation, which reports the actual input error/DQ.
      if (!validation.valid || !validation.input) return true;
      const input = validation.input;
      const artifacts = input.metadata.inputArtifacts.map(artifact => portablePath(artifact.path));
      const changedCode = input.graph.nodes.filter(node => node.kind === "changed_code").map(node => portablePath(node.path));
      // Artifact references are target-relative; retain legacy workspace-relative references conservatively.
      return [...artifacts, ...changedCode].some(path => files.includes(pathKey(path, root)) || files.includes(pathKey(path, base)));
    });
  } catch { return true; }
}
export async function selectChangedTargets(targets: readonly string[], changedOnly = false): Promise<ChangeSelectionResult> {
  if (!changedOnly) return { targets: [...targets], selection: { mode: "all", status: "selected", strategy: "all", changedFileCount: 0, selectedTargetCount: targets.length } };
  const detected = await changedFiles();
  if (detected.error) return { targets: [], selection: { mode: "changed_only", status: "detection_failed", strategy: detected.strategy, changedFileCount: 0, selectedTargetCount: 0, error: detected.error } };
  const selected: string[] = [];
  for (const target of targets) if (await targetMentionsChangedFile(target, detected.files, detected.base)) selected.push(target);
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
