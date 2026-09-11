import { readFile } from "fs/promises";
import { exit } from "process";
import { distributionPath, readDistributionMetadata } from "./distribution.js";
import checks from "./enum-contracts.json" with { type: "json" };

export interface EnumCheckItem {
  readonly name: string;
  readonly status: "pass" | "fail";
  readonly typeValues: readonly string[];
  readonly schemaValues: readonly string[];
  readonly missingInSchema: readonly string[];
  readonly missingInTypes: readonly string[];
}

export interface EnumCheckReport {
  readonly reportVersion: "qeg-enum-check-v1";
  readonly generatedAt: string;
  readonly status: "pass" | "fail";
  readonly items: readonly EnumCheckItem[];
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

function diff(left: readonly string[], right: readonly string[]): string[] {
  return left.filter((value) => !right.includes(value));
}

export async function createEnumCheckReport(): Promise<EnumCheckReport> {
  const items: EnumCheckItem[] = [];
  const metadata = await readDistributionMetadata();
  const schemaCache = new Map<string, { $defs: Record<string, { enum?: string[] }> }>();

  for (const check of checks) {
    let schema = schemaCache.get(check.schemaFile);
    if (!schema) {
      schema = await readJson<{ $defs: Record<string, { enum?: string[] }> }>(distributionPath(check.schemaFile));
      schemaCache.set(check.schemaFile, schema);
    }
    const packaged = metadata.enums[check.typeName];
    const typeValues = Array.isArray(packaged) && packaged.every(value => typeof value === "string") ? [...packaged].sort() : [];
    const schemaValues = [...(schema.$defs?.[check.schemaDef]?.enum ?? [])].sort();
    const missingInSchema = diff(typeValues, schemaValues);
    const missingInTypes = diff(schemaValues, typeValues);
    const status = typeValues.length > 0 && schemaValues.length > 0 && missingInSchema.length === 0 && missingInTypes.length === 0 ? "pass" : "fail";
    items.push({
      name: check.typeName,
      status,
      typeValues,
      schemaValues,
      missingInSchema,
      missingInTypes,
    });
  }

  return {
    reportVersion: "qeg-enum-check-v1",
    generatedAt: new Date().toISOString(),
    status: items.every((item) => item.status === "pass") ? "pass" : "fail",
    items,
  };
}

function formatEnumCheckText(report: EnumCheckReport): string {
  const lines = [
    "QEG Type/Schema Enum Check",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    "",
  ];

  for (const item of report.items) {
    lines.push(`- ${item.status.toUpperCase()} ${item.name}`);
    if (item.missingInSchema.length > 0) {
      lines.push(`  missing in schema: ${item.missingInSchema.join(", ")}`);
    }
    if (item.missingInTypes.length > 0) {
      lines.push(`  missing in types: ${item.missingInTypes.join(", ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export async function runEnumCheckCommand(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const report = await createEnumCheckReport();
  console.log(json ? JSON.stringify(report, null, 2) : formatEnumCheckText(report).trimEnd());
  exit(report.status === "pass" ? 0 : 2);
}
