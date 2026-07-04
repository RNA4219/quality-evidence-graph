import { createHash } from "crypto";
import { readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import { exit } from "process";
import { collectReportTargets } from "./report.js";
import { CliError } from "./errors.js";

type VerifySeverity = "pass" | "warn" | "fail";

interface EvidenceVerifyItem {
  readonly target: string;
  readonly name: string;
  readonly severity: VerifySeverity;
  readonly message: string;
}

interface EvidenceVerifyReport {
  readonly reportVersion: "qeg-evidence-verify-v1";
  readonly generatedAt: string;
  readonly status: VerifySeverity;
  readonly items: readonly EvidenceVerifyItem[];
}

interface ArtifactLike {
  readonly id?: string;
  readonly artifactId?: string;
  readonly path?: string;
  readonly contentHash?: string;
  readonly hash?: string;
  readonly revision?: string;
}

interface GateInputLike {
  readonly metadata?: {
    readonly headRef?: string;
    readonly inputArtifacts?: readonly ArtifactLike[];
  };
  readonly evidencePackage?: {
    readonly inputArtifactHashes?: readonly ArtifactLike[];
    readonly qegOutputs?: Record<string, ArtifactLike | undefined>;
    readonly retention?: {
      readonly storageClassification?: string;
      readonly contentHash?: string;
      readonly storageLocation?: string;
    };
  };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function resolveArtifactPath(target: string, artifactPath: string): Promise<string | undefined> {
  const directPath = resolve(artifactPath);
  if (await exists(directPath)) return directPath;
  const targetRelativePath = resolve(target, artifactPath);
  if (await exists(targetRelativePath)) return targetRelativePath;
  return undefined;
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function verifyArtifact(target: string, artifact: ArtifactLike, label: string): Promise<EvidenceVerifyItem[]> {
  const items: EvidenceVerifyItem[] = [];
  const name = artifact.id ?? artifact.artifactId ?? label;
  if (!artifact.path) {
    items.push({ target, name, severity: "warn", message: "artifact has no path" });
    return items;
  }
  const path = await resolveArtifactPath(target, artifact.path);
  if (!path) {
    items.push({ target, name, severity: "warn", message: `artifact path does not exist: ${artifact.path}` });
    return items;
  }
  items.push({ target, name, severity: "pass", message: `artifact path exists: ${artifact.path}` });
  const expectedHash = artifact.contentHash ?? artifact.hash;
  if (expectedHash?.startsWith("sha256:")) {
    const actual = sha256(await readFile(path));
    items.push({
      target,
      name,
      severity: actual === expectedHash ? "pass" : "fail",
      message: actual === expectedHash ? "artifact hash matches" : `artifact hash mismatch: expected ${expectedHash}, got ${actual}`,
    });
  }
  return items;
}

function worst(items: readonly EvidenceVerifyItem[]): VerifySeverity {
  if (items.some((item) => item.severity === "fail")) return "fail";
  if (items.some((item) => item.severity === "warn")) return "warn";
  return "pass";
}

export async function createEvidenceVerifyReport(rawTargets: readonly string[]): Promise<EvidenceVerifyReport> {
  const targets = await collectReportTargets(rawTargets);
  const items: EvidenceVerifyItem[] = [];
  for (const target of targets) {
    try {
      const input = await readJson<GateInputLike>(join(target, "gate-input.json"));
      for (const artifact of input.metadata?.inputArtifacts ?? []) {
        items.push(...await verifyArtifact(target, artifact, "metadata.inputArtifacts"));
        if (input.metadata?.headRef && artifact.revision && artifact.revision !== input.metadata.headRef) {
          items.push({
            target,
            name: artifact.id ?? artifact.path ?? "artifact",
            severity: "fail",
            message: `artifact revision ${artifact.revision} does not match metadata.headRef ${input.metadata.headRef}`,
          });
        }
      }
      for (const artifact of input.evidencePackage?.inputArtifactHashes ?? []) {
        items.push(...await verifyArtifact(target, artifact, "evidencePackage.inputArtifactHashes"));
      }
      for (const [name, artifact] of Object.entries(input.evidencePackage?.qegOutputs ?? {})) {
        if (artifact) items.push(...await verifyArtifact(target, artifact, `qegOutputs.${name}`));
      }
      const storageClassification = input.evidencePackage?.retention?.storageClassification;
      if (!storageClassification) {
        items.push({ target, name: "retention", severity: "warn", message: "retention.storageClassification is missing" });
      } else if (storageClassification === "mutable" || storageClassification === "unknown") {
        items.push({ target, name: "retention", severity: "fail", message: `release evidence storageClassification is ${storageClassification}` });
      } else {
        items.push({ target, name: "retention", severity: "pass", message: `storageClassification is ${storageClassification}` });
      }
    } catch (error) {
      items.push({ target, name: "gate-input", severity: "fail", message: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    reportVersion: "qeg-evidence-verify-v1",
    generatedAt: new Date().toISOString(),
    status: worst(items),
    items,
  };
}

function formatEvidenceVerifyText(report: EvidenceVerifyReport): string {
  const lines = [
    "QEG Evidence Verify",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    "",
  ];
  for (const item of report.items) {
    lines.push(`- ${item.severity.toUpperCase()} ${item.target} ${item.name}: ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function runEvidenceVerifyCommand(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  if (targets.length === 0) {
    throw new CliError("Usage: qeg evidence verify [--json] <fixture-dir-or-parent> [...]");
  }
  const report = await createEvidenceVerifyReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatEvidenceVerifyText(report).trimEnd());
  exit(report.status === "fail" ? 1 : 0);
}
