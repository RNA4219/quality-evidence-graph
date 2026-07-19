import { readFile } from "fs/promises";
import { exit } from "process";

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

const CHECKS = [
  { typeName: "GateProfile", schemaDef: "gateProfile", typeFile: "src/types/primitives.ts", schemaFile: "schemas/shared-defs.schema.json" },
  { typeName: "GateVerdict", schemaDef: "gateVerdict", typeFile: "src/types/primitives.ts", schemaFile: "schemas/shared-defs.schema.json" },
  { typeName: "DisqualificationCode", schemaDef: "disqualificationCode", typeFile: "src/types/primitives.ts", schemaFile: "schemas/shared-defs.schema.json" },
  { typeName: "EvidenceKind", schemaDef: "evidenceKind", typeFile: "src/types/evidence.ts", schemaFile: "schemas/shared-defs.schema.json" },
  { typeName: "TestType", schemaDef: "testType", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
  { typeName: "ResilienceAdapter", schemaDef: "resilienceAdapter", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
  { typeName: "ResilienceFaultModel", schemaDef: "resilienceFaultModel", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
  { typeName: "SignalPhase", schemaDef: "signalPhase", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
  { typeName: "SignalSemanticRole", schemaDef: "signalSemanticRole", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
  { typeName: "SignalAggregation", schemaDef: "signalAggregation", typeFile: "src/types/primitives.ts", schemaFile: "schemas/reliability.schema.json" },
] as const;

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

function extractStringUnion(source: string, typeName: string): string[] {
  const match = source.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`));
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((value) => value[1]).sort();
}

function diff(left: readonly string[], right: readonly string[]): string[] {
  return left.filter((value) => !right.includes(value));
}

export async function createEnumCheckReport(): Promise<EnumCheckReport> {
  const items: EnumCheckItem[] = [];
  const sourceCache = new Map<string, string>();
  const schemaCache = new Map<string, { $defs: Record<string, { enum?: string[] }> }>();

  for (const check of CHECKS) {
    let typeSource = sourceCache.get(check.typeFile);
    if (!typeSource) {
      typeSource = await readFile(check.typeFile, "utf-8");
      sourceCache.set(check.typeFile, typeSource);
    }
    let schema = schemaCache.get(check.schemaFile);
    if (!schema) {
      schema = await readJson<{ $defs: Record<string, { enum?: string[] }> }>(check.schemaFile);
      schemaCache.set(check.schemaFile, schema);
    }
    const typeValues = extractStringUnion(typeSource, check.typeName);
    const schemaValues = [...(schema.$defs[check.schemaDef]?.enum ?? [])].sort();
    const missingInSchema = diff(typeValues, schemaValues);
    const missingInTypes = diff(schemaValues, typeValues);
    const status = missingInSchema.length === 0 && missingInTypes.length === 0 ? "pass" : "fail";
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
