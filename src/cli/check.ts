import { exit } from "process";
import { createDoctorReport } from "./doctor.js";
import { createEnumCheckReport } from "./enum-check.js";
import { createCiReport } from "./report.js";
import { createSchemaCheckReport } from "./schema-check.js";
import { createSnapshotResults } from "./snapshot.js";
import { createEvidenceVerifyReport } from "./evidence-verify.js";
import { createPolicyLintReport } from "./policy-lint.js";

type CheckStatus = "pass" | "warn" | "fail";
interface CheckItem { readonly name: string; readonly status: CheckStatus; readonly message: string; }
interface CheckReport {
  readonly reportVersion: "qeg-check-v2";
  readonly generatedAt: string;
  readonly status: CheckStatus;
  readonly items: readonly CheckItem[];
}
function worst(items: readonly CheckItem[]): CheckStatus {
  if (items.some((item) => item.status === "fail")) return "fail";
  if (items.some((item) => item.status === "warn")) return "warn";
  return "pass";
}
export async function createCheckReport(rawTargets: readonly string[]): Promise<CheckReport> {
  const items: CheckItem[] = [];
  const schema = await createSchemaCheckReport(rawTargets);
  items.push({ name: "schema-check", status: schema.status === "pass" ? "pass" : "fail", message: `${schema.items.filter((item) => item.status === "fail").length} failing schema item(s)` });
  const enums = await createEnumCheckReport();
  items.push({ name: "enum-check", status: enums.status === "pass" ? "pass" : "fail", message: `${enums.items.filter((item) => item.status === "fail").length} enum drift item(s)` });
  const doctor = await createDoctorReport(rawTargets);
  items.push({ name: "doctor", status: doctor.status, message: `${doctor.checks.filter((check) => check.severity !== "pass").length} doctor finding(s)` });
  if (rawTargets.length === 0) {
    for (const name of ["evidence-verify", "policy-lint", "snapshot", "report"]) items.push({ name, status: "warn", message: "skipped because no targets were provided" });
  } else {
    const evidence = await createEvidenceVerifyReport(rawTargets);
    items.push({ name: "evidence-verify", status: evidence.status, message: `${evidence.items.filter((item) => item.severity === "fail").length} evidence failure(s)` });
    const policy = await createPolicyLintReport(rawTargets);
    items.push({ name: "policy-lint", status: policy.status, message: `${policy.items.filter((item) => item.severity === "fail").length} policy failure(s)` });
    const snapshots = await createSnapshotResults(rawTargets);
    const snapshotFailures = snapshots.filter((result) => result.status === "missing" || result.status === "mismatch");
    items.push({ name: "snapshot", status: snapshotFailures.length === 0 ? "pass" : "fail", message: `${snapshotFailures.length} snapshot failure(s)` });
    const report = await createCiReport(rawTargets);
    items.push({ name: "report", status: report.summary.cliErrors > 0 || report.summary.gateFailed > 0 ? "fail" : "pass", message: `${report.summary.gateFailed} gate failure(s), ${report.summary.cliErrors} CLI error(s)` });
  }
  return { reportVersion: "qeg-check-v2", generatedAt: new Date().toISOString(), status: worst(items), items };
}
function formatCheckText(report: CheckReport): string {
  const lines = ["QEG Check", `Generated at: ${report.generatedAt}`, `Overall: ${report.status.toUpperCase()}`, ""];
  for (const item of report.items) lines.push(`- ${item.status.toUpperCase()} ${item.name}: ${item.message}`);
  return `${lines.join("\n")}\n`;
}
export async function runCheckCommand(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  const report = await createCheckReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatCheckText(report).trimEnd());
  exit(report.status === "fail" ? 1 : 0);
}
