import { readFile } from "fs/promises";
import { join } from "path";
import { exit } from "process";
import { collectReportTargets } from "./report.js";
import { CliError } from "./errors.js";
import { validateGateInput } from "../validation/schema.js";
import { verifyEvidenceArtifacts, type EvidenceVerificationItem, type EvidenceVerificationSeverity } from "../validation/evidence.js";

interface EvidenceVerifyItem extends EvidenceVerificationItem { readonly target: string; }
interface EvidenceVerifyReport {
  readonly reportVersion: "qeg-evidence-verify-v2";
  readonly generatedAt: string;
  readonly status: EvidenceVerificationSeverity;
  readonly items: readonly EvidenceVerifyItem[];
}
function worst(items: readonly EvidenceVerifyItem[]): EvidenceVerificationSeverity {
  if (items.some((item) => item.severity === "fail")) return "fail";
  if (items.some((item) => item.severity === "warn")) return "warn";
  return "pass";
}
export async function createEvidenceVerifyReport(rawTargets: readonly string[]): Promise<EvidenceVerifyReport> {
  const targets = await collectReportTargets(rawTargets);
  const items: EvidenceVerifyItem[] = [];
  for (const target of targets) {
    try {
      const validation = await validateGateInput(JSON.parse(await readFile(join(target, "gate-input.json"), "utf-8")));
      if (!validation.valid || !validation.input) {
        items.push({ target, artifactId: "gate-input", severity: "fail", code: "PATH_MISSING", message: `schema invalid: ${validation.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}` });
        continue;
      }
      const report = await verifyEvidenceArtifacts(validation.input, { baseDir: target });
      items.push(...report.items.map((item) => ({ ...item, target })));
    } catch (error) {
      items.push({ target, artifactId: "gate-input", severity: "fail", code: "PATH_MISSING", message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { reportVersion: "qeg-evidence-verify-v2", generatedAt: new Date().toISOString(), status: worst(items), items };
}
function formatEvidenceVerifyText(report: EvidenceVerifyReport): string {
  const lines = ["QEG Evidence Verify", `Generated at: ${report.generatedAt}`, `Overall: ${report.status.toUpperCase()}`, ""];
  for (const item of report.items) lines.push(`- ${item.severity.toUpperCase()} ${item.target} ${item.artifactId}: ${item.message}`);
  return `${lines.join("\n")}\n`;
}
export async function runEvidenceVerifyCommand(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  if (targets.length === 0) throw new CliError("Usage: qeg evidence verify [--json] <fixture-dir-or-parent> [...]");
  const report = await createEvidenceVerifyReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatEvidenceVerifyText(report).trimEnd());
  exit(report.status === "fail" ? 1 : 0);
}
