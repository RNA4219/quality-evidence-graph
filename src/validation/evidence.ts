import { createHash } from "crypto";
import { readFile, stat } from "fs/promises";
import { isAbsolute, resolve } from "path";
import type { ArtifactRef, QegGateInput } from "../types.js";

export type EvidenceVerificationSeverity = "pass" | "warn" | "fail";
export interface EvidenceVerificationItem {
  readonly artifactId: string;
  readonly path?: string;
  readonly severity: EvidenceVerificationSeverity;
  readonly code: "PATH_MISSING" | "FILE_MISSING" | "HASH_MISSING" | "HASH_MISMATCH" | "REVISION_MISMATCH" | "VERIFIED";
  readonly message: string;
}
export interface EvidenceVerificationOptions { readonly baseDir: string; readonly strict?: boolean; }
export interface EvidenceVerificationReport {
  readonly reportVersion: "qeg-evidence-verification-v2";
  readonly status: EvidenceVerificationSeverity;
  readonly items: readonly EvidenceVerificationItem[];
}

interface ArtifactCandidate {
  readonly artifact: ArtifactRef;
  readonly required: boolean;
}

const OPTIONAL_ADAPTERS = new Set(["junit", "coverage", "sarif", "git-diff"]);

async function isFile(path: string): Promise<boolean> {
  try { return (await stat(path)).isFile(); } catch { return false; }
}
function hash(bytes: Buffer): string { return "sha256:" + createHash("sha256").update(bytes).digest("hex"); }
function severity(strict: boolean, required: boolean): "warn" | "fail" {
  return strict && required ? "fail" : "warn";
}
function allArtifacts(input: QegGateInput): ArtifactCandidate[] {
  const candidates: ArtifactCandidate[] = input.metadata.inputArtifacts.map((artifact) => ({
    artifact,
    required: !OPTIONAL_ADAPTERS.has(artifact.adapter),
  }));
  if (!input.evidencePackage) return candidates;
  candidates.push(...input.evidencePackage.inputArtifactHashes.map((artifact) => ({
    artifact,
    required: !OPTIONAL_ADAPTERS.has(artifact.adapter),
  })));
  for (const [name, artifact] of Object.entries(input.evidencePackage.qegOutputs)) {
    if (artifact) candidates.push({ artifact, required: name !== "markdownSummary" });
  }
  return candidates;
}
function uniqueArtifacts(input: QegGateInput): ArtifactCandidate[] {
  const byKey = new Map<string, ArtifactCandidate>();
  for (const candidate of allArtifacts(input)) {
    const artifact = candidate.artifact;
    const key = [artifact.id, artifact.path, artifact.contentHash ?? "", artifact.revision ?? ""].join(String.fromCharCode(0));
    const previous = byKey.get(key);
    byKey.set(key, previous ? { artifact, required: previous.required || candidate.required } : candidate);
  }
  return [...byKey.values()];
}

export async function verifyEvidenceArtifacts(input: QegGateInput, options: EvidenceVerificationOptions): Promise<EvidenceVerificationReport> {
  const strict = options.strict ?? (input.metadata.profile === "strict" || input.metadata.profile === "ipo_controlled");
  const items: EvidenceVerificationItem[] = [];
  for (const { artifact, required } of uniqueArtifacts(input)) {
    const failureSeverity = severity(strict, required);
    if (!artifact.path) {
      items.push({ artifactId: artifact.id, severity: failureSeverity, code: "PATH_MISSING", message: "artifact path is missing" });
      continue;
    }
    const path = isAbsolute(artifact.path) ? artifact.path : resolve(options.baseDir, artifact.path);
    if (!(await isFile(path))) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "FILE_MISSING", message: "artifact file does not exist: " + artifact.path });
      continue;
    }
    if (!artifact.contentHash) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "HASH_MISSING", message: "artifact contentHash is missing" });
    } else {
      const actual = hash(await readFile(path));
      items.push(actual === artifact.contentHash
        ? { artifactId: artifact.id, path: artifact.path, severity: "pass", code: "VERIFIED", message: "artifact path and hash verified" }
        : { artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "HASH_MISMATCH", message: "artifact hash mismatch: expected " + artifact.contentHash + ", got " + actual });
    }
    if (input.metadata.headRef && artifact.revision && artifact.revision !== input.metadata.headRef) {
      items.push({ artifactId: artifact.id, path: artifact.path, severity: failureSeverity, code: "REVISION_MISMATCH", message: "artifact revision " + artifact.revision + " does not match " + input.metadata.headRef });
    }
  }
  const status = items.some((item) => item.severity === "fail") ? "fail" : items.some((item) => item.severity === "warn") ? "warn" : "pass";
  return { reportVersion: "qeg-evidence-verification-v2", status, items };
}
