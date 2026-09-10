import { createHash } from "crypto";
import { readFile, realpath, stat } from "fs/promises";
import { isAbsolute, relative, resolve } from "path";
import type { ArtifactRef, QegGateInput, ResilienceExecutionEvidenceNode } from "../types.js";
import { executionArtifacts } from "./execution-artifacts.js";
import { executionFingerprint } from "../gate/execution/contracts.js";

export type EvidenceVerificationSeverity = "pass" | "warn" | "fail";
export interface EvidenceVerificationItem {
  readonly artifactId: string;
  readonly path?: string;
  readonly severity: EvidenceVerificationSeverity;
  readonly code: "PATH_MISSING" | "PATH_OUTSIDE_BASE" | "FILE_MISSING" | "IO_ERROR" | "HASH_MISSING" | "HASH_MISMATCH" | "REVISION_MISMATCH" | "PAYLOAD_MISMATCH" | "VERIFIED";
  readonly message: string;
}
export interface EvidenceVerificationOptions { readonly baseDir: string; readonly strict?: boolean; }
export interface EvidenceVerificationReport {
  readonly reportVersion: "qeg-evidence-verification-v2";
  readonly status: EvidenceVerificationSeverity;
  readonly items: readonly EvidenceVerificationItem[];
  readonly executionFingerprint?: string;
}

interface ArtifactCandidate {
  readonly historical?: boolean;
  readonly payloadKey?: string;
  readonly payloadMatches?: (value: unknown) => boolean;
  readonly artifact: Pick<ArtifactRef, "id" | "path" | "contentHash" | "revision">;
  readonly required: boolean;
  /** Explicit input requirements cannot be weakened by profile or diagnostic strictness. */
  readonly enforceRequired?: boolean;
  /** Resilience raw/signal artifacts must never escape the Gate target directory. */
  readonly requireContainedRelativePath?: boolean;
}

const OPTIONAL_ADAPTERS = new Set(["junit", "coverage", "sarif", "git-diff"]);

function hash(bytes: Buffer): string { return "sha256:" + createHash("sha256").update(bytes).digest("hex"); }
function severity(strict: boolean, required: boolean): "warn" | "fail" {
  return strict && required ? "fail" : "warn";
}
/** `relative()` uses the current platform separator; accept both forms for portable input. */
function isOutsideBase(offset: string): boolean {
  return offset === "" || offset === ".." || offset.startsWith("../") || offset.startsWith("..\\") || isAbsolute(offset);
}
function isResilienceEvidence(node: unknown): node is ResilienceExecutionEvidenceNode {
  return Boolean(node) && typeof node === "object" &&
    (node as { kind?: string }).kind === "execution_evidence" &&
    (node as { evidenceType?: string }).evidenceType === "resilience";
}
function allArtifacts(input: QegGateInput): ArtifactCandidate[] {
  const candidate = (artifact: ArtifactRef): ArtifactCandidate => {
    const declared = input.policy.inputContract?.requiredArtifacts.some(ref => ref.adapter === artifact.adapter && ref.kind === artifact.kind) ?? false;
    return { artifact, required: declared || !OPTIONAL_ADAPTERS.has(artifact.adapter), enforceRequired: declared };
  };
  const candidates: ArtifactCandidate[] = input.metadata.inputArtifacts.map(candidate);
  if (input.evidencePackage) {
    candidates.push(...input.evidencePackage.inputArtifactHashes.map(candidate));
    for (const [name, artifact] of Object.entries(input.evidencePackage.qegOutputs)) {
      if (artifact) candidates.push({ artifact, required: name !== "markdownSummary" });
    }
  }
  for (const evidence of input.graph.nodes.filter(isResilienceEvidence)) {
    candidates.push({ artifact: evidence.rawArtifactRef, required: true, requireContainedRelativePath: true });
    for (const signalRef of evidence.evidenceRefs) {
      candidates.push({ artifact: signalRef, required: true, requireContainedRelativePath: true });
    }
  }
  return [...candidates, ...executionArtifacts(input)];
}
function uniqueArtifacts(input: QegGateInput): ArtifactCandidate[] {
  const byKey = new Map<string, ArtifactCandidate>();
  for (const candidate of allArtifacts(input)) {
    const artifact = candidate.artifact;
    const key = [artifact.id, artifact.path, artifact.contentHash ?? "", artifact.revision ?? "", candidate.requireContainedRelativePath ? "contained" : "legacy", candidate.historical, candidate.payloadKey].join(String.fromCharCode(0));
    const previous = byKey.get(key);
    byKey.set(key, previous ? {
      ...candidate,
      artifact,
      required: previous.required || candidate.required,
      enforceRequired: previous.enforceRequired || candidate.enforceRequired,
      requireContainedRelativePath: previous.requireContainedRelativePath || candidate.requireContainedRelativePath,
    } : candidate);
  }
  return [...byKey.values()];
}

export async function verifyEvidenceArtifacts(input: QegGateInput, options: EvidenceVerificationOptions): Promise<EvidenceVerificationReport> {
  const strict = options.strict ?? (input.metadata.profile === "strict" || input.metadata.profile === "ipo_controlled");
  const baseDir = resolve(options.baseDir);
  let realBaseDir = baseDir;
  let baseResolutionError: string | undefined;
  try { realBaseDir = await realpath(baseDir); }
  catch (error) { baseResolutionError = `Cannot realpath ${baseDir}: ${String(error)}`; }
  const items: EvidenceVerificationItem[] = [];
  for (const { artifact, required, enforceRequired, requireContainedRelativePath, historical, payloadMatches } of uniqueArtifacts(input)) {
    const failureSeverity = severity(strict || Boolean(enforceRequired) || Boolean(requireContainedRelativePath), required);
    if (!artifact.path) {
      items.push({ artifactId: artifact.id, severity: failureSeverity, code: "PATH_MISSING", message: "artifact path is missing" });
      continue;
    }
    if (requireContainedRelativePath && isAbsolute(artifact.path)) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: "fail", code: "PATH_OUTSIDE_BASE", message: "resilience artifact path must be relative to the Gate target directory" });
      continue;
    }
    const path = isAbsolute(artifact.path) ? artifact.path : resolve(baseDir, artifact.path);
    const lexicalRelative = relative(baseDir, path);
    if (requireContainedRelativePath && isOutsideBase(lexicalRelative)) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: "fail", code: "PATH_OUTSIDE_BASE", message: "resilience artifact path escapes the Gate target directory" });
      continue;
    }
    let fileStat;
    try { fileStat = await stat(path); }
    catch (error) {
      const absent = (error as NodeJS.ErrnoException)?.code === "ENOENT";
      items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: absent ? "FILE_MISSING" : "IO_ERROR",
        message: absent ? "artifact file does not exist: " + artifact.path : `Cannot stat ${path}: ${String(error)}` });
      continue;
    }
    if (!fileStat.isFile()) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "IO_ERROR", message: `Cannot read ${path}: artifact is not a regular file` });
      continue;
    }
    if (requireContainedRelativePath) {
      if (baseResolutionError) {
        items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "IO_ERROR", message: baseResolutionError });
        continue;
      }
      let realArtifactPath;
      try { realArtifactPath = await realpath(path); }
      catch (error) {
        items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "IO_ERROR", message: `Cannot realpath ${path}: ${String(error)}` });
        continue;
      }
      const actualRelative = relative(realBaseDir, realArtifactPath);
      if (isOutsideBase(actualRelative)) {
        items.push({ artifactId: artifact.id, path: artifact.path, severity: "fail", code: "PATH_OUTSIDE_BASE", message: "resilience artifact symlink escapes the Gate target directory" });
        continue;
      }
    }
    if (!artifact.contentHash) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "HASH_MISSING", message: "artifact contentHash is missing" });
    } else {
      let bytes;
      try { bytes = await readFile(path); }
      catch (error) {
        items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "IO_ERROR", message: `Cannot read ${path}: ${String(error)}` });
        continue;
      }
      const actual = hash(bytes);
      if (payloadMatches) {
        let matches = false;
        try { matches = payloadMatches(JSON.parse(bytes.toString("utf8"))); } catch { /* Invalid JSON is a payload mismatch. */ }
        if (!matches) items.push({ artifactId: artifact.id, path: artifact.path, severity: "fail", code: "PAYLOAD_MISMATCH",
          message: "EAC-01/05 raw payload disagrees with normalized execution or build binding" });
      }
      items.push(actual === artifact.contentHash
        ? { artifactId: artifact.id, path: artifact.path, severity: "pass", code: "VERIFIED", message: "artifact path and hash verified" }
        : { artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "HASH_MISMATCH", message: "artifact hash mismatch: expected " + artifact.contentHash + ", got " + actual });
    }
    if (!historical && input.metadata.headRef && artifact.revision && artifact.revision !== input.metadata.headRef) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "REVISION_MISMATCH", message: "artifact revision " + artifact.revision + " does not match " + input.metadata.headRef });
    }
  }
  const status = items.some((item) => item.severity === "fail") ? "fail" : items.some((item) => item.severity === "warn") ? "warn" : "pass";
  return { reportVersion: "qeg-evidence-verification-v2", status, items, executionFingerprint: executionFingerprint(input) };
}
