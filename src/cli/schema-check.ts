import { readFile } from "fs/promises";
import { join } from "path";
import { exit } from "process";
import { collectReportTargets } from "./report.js";
import { CliError } from "./errors.js";
import { loadSchemaRegistry, validateGateInput } from "../validation/schema.js";

export type SchemaCheckStatus = "pass" | "fail";
export interface SchemaCheckItem {
  readonly name: string;
  readonly status: SchemaCheckStatus;
  readonly message: string;
  readonly errors: readonly string[];
}
export interface SchemaCheckReport {
  readonly reportVersion: "qeg-schema-check-v2";
  readonly generatedAt: string;
  readonly status: SchemaCheckStatus;
  readonly items: readonly SchemaCheckItem[];
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf-8"));
}

export async function createSchemaCheckReport(rawTargets: readonly string[] = []): Promise<SchemaCheckReport> {
  const registry = await loadSchemaRegistry();
  const items: SchemaCheckItem[] = [...registry.validators.keys()].sort().map((name) => ({
    name: `schema:${name}`,
    status: "pass",
    message: "compiled",
    errors: [],
  }));
  const targets = rawTargets.length > 0 ? await collectReportTargets(rawTargets) : [];
  for (const target of targets) {
    try {
      const report = await validateGateInput(await readJson(join(target, "gate-input.json")));
      items.push({
        name: `${target}:gate-input`,
        status: report.valid ? "pass" : "fail",
        message: report.valid ? "valid" : "schema validation failed",
        errors: report.issues.map((issue) => `${issue.path} ${issue.message}`),
      });
    } catch (error) {
      items.push({
        name: `${target}:gate-input`,
        status: "fail",
        message: error instanceof Error ? error.message : String(error),
        errors: [],
      });
    }
  }
  return {
    reportVersion: "qeg-schema-check-v2",
    generatedAt: new Date().toISOString(),
    status: items.every((item) => item.status === "pass") ? "pass" : "fail",
    items,
  };
}

function formatSchemaCheckText(report: SchemaCheckReport): string {
  const lines = ["QEG Schema Check", `Generated at: ${report.generatedAt}`, `Overall: ${report.status.toUpperCase()}`, ""];
  for (const item of report.items) {
    lines.push(`- ${item.status.toUpperCase()} ${item.name}: ${item.message}`);
    for (const error of item.errors.slice(0, 8)) lines.push(`  - ${error}`);
    if (item.errors.length > 8) lines.push(`  - ${item.errors.length - 8} more error(s)`);
  }
  return `${lines.join("\n")}\n`;
}

export async function runSchemaCheckCommand(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  const report = await createSchemaCheckReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatSchemaCheckText(report).trimEnd());
  exit(report.status === "pass" ? 0 : 2);
}

export async function assertSchemasCompile(): Promise<void> {
  const report = await createSchemaCheckReport([]);
  if (report.status !== "pass") throw new CliError("Schema compile check failed");
}
