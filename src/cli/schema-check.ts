import { Ajv2020, type AnySchema, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { readdir, readFile } from "fs/promises";
import { basename, join, resolve } from "path";
import { exit } from "process";
import { pathToFileURL } from "url";
import { collectReportTargets } from "./report.js";
import { CliError } from "./errors.js";

export type SchemaCheckStatus = "pass" | "fail";

export interface SchemaCheckItem {
  readonly name: string;
  readonly status: SchemaCheckStatus;
  readonly message: string;
  readonly errors: readonly string[];
}

export interface SchemaCheckReport {
  readonly reportVersion: "qeg-schema-check-v1";
  readonly generatedAt: string;
  readonly status: SchemaCheckStatus;
  readonly items: readonly SchemaCheckItem[];
}

interface FixtureInputLike {
  readonly graph?: unknown;
  readonly policy?: unknown;
  readonly evidencePackage?: unknown;
  readonly placementPlan?: unknown;
  readonly waivers?: readonly unknown[];
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf-8"));
}

async function schemaFiles(schemaDir: string): Promise<string[]> {
  return (await readdir(schemaDir))
    .filter((file) => file.endsWith(".schema.json"))
    .sort()
    .map((file) => join(schemaDir, file));
}

export async function createAjv(schemaDir = "schemas"): Promise<Ajv2020> {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });

  for (const file of await schemaFiles(schemaDir)) {
    const schema = await readJson(file) as AnySchema;
    ajv.addSchema(schema, basename(file));
    ajv.addSchema(schema, pathToFileURL(resolve(file)).href);
  }

  return ajv;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    const location = error.instancePath || "/";
    return `${location} ${error.message ?? "schema validation failed"}`;
  });
}

function checkWithValidator(name: string, validator: ValidateFunction | undefined, data: unknown): SchemaCheckItem {
  if (!validator) {
    return {
      name,
      status: "fail",
      message: "schema validator not found",
      errors: [],
    };
  }

  const valid = validator(data);
  return {
    name,
    status: valid ? "pass" : "fail",
    message: valid ? "valid" : "schema validation failed",
    errors: formatErrors(validator.errors),
  };
}

async function compileSchemas(ajv: Ajv2020, schemaDir: string): Promise<SchemaCheckItem[]> {
  const items: SchemaCheckItem[] = [];
  for (const file of await schemaFiles(schemaDir)) {
    try {
      ajv.getSchema(basename(file)) ?? ajv.compile(await readJson(file) as AnySchema);
      items.push({
        name: `schema:${basename(file)}`,
        status: "pass",
        message: "compiled",
        errors: [],
      });
    } catch (error) {
      items.push({
        name: `schema:${basename(file)}`,
        status: "fail",
        message: error instanceof Error ? error.message : String(error),
        errors: [],
      });
    }
  }
  return items;
}

async function validateFixture(target: string, ajv: Ajv2020): Promise<SchemaCheckItem[]> {
  const inputPath = join(target, "gate-input.json");
  const input = await readJson(inputPath) as FixtureInputLike;
  const items: SchemaCheckItem[] = [];

  if (input.graph !== undefined) {
    items.push(checkWithValidator(`${target}:graph`, ajv.getSchema("qeg.bundle.schema.json"), input.graph));
  }
  if (input.policy !== undefined) {
    items.push(checkWithValidator(`${target}:policy`, ajv.getSchema("gate-policy.schema.json"), input.policy));
  }
  if (input.evidencePackage !== undefined) {
    items.push(checkWithValidator(`${target}:evidencePackage`, ajv.getSchema("evidence-package.schema.json"), input.evidencePackage));
  }
  if (input.placementPlan !== undefined) {
    items.push(checkWithValidator(`${target}:placementPlan`, ajv.getSchema("test-placement-plan.schema.json"), input.placementPlan));
  }
  for (const [index, waiver] of (input.waivers ?? []).entries()) {
    items.push(checkWithValidator(`${target}:waivers[${index}]`, ajv.getSchema("waiver.schema.json"), waiver));
  }

  return items;
}

export async function createSchemaCheckReport(rawTargets: readonly string[] = []): Promise<SchemaCheckReport> {
  const schemaDir = "schemas";
  const ajv = await createAjv(schemaDir);
  const items = await compileSchemas(ajv, schemaDir);
  const targets = rawTargets.length > 0 ? await collectReportTargets(rawTargets) : [];

  for (const target of targets) {
    try {
      items.push(...await validateFixture(target, ajv));
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
    reportVersion: "qeg-schema-check-v1",
    generatedAt: new Date().toISOString(),
    status: items.every((item) => item.status === "pass") ? "pass" : "fail",
    items,
  };
}

function formatSchemaCheckText(report: SchemaCheckReport): string {
  const lines = [
    "QEG Schema Check",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    "",
  ];
  for (const item of report.items) {
    lines.push(`- ${item.status.toUpperCase()} ${item.name}: ${item.message}`);
    for (const error of item.errors.slice(0, 8)) {
      lines.push(`  - ${error}`);
    }
    if (item.errors.length > 8) {
      lines.push(`  - ${item.errors.length - 8} more error(s)`);
    }
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
  if (report.status !== "pass") {
    throw new CliError("Schema compile check failed");
  }
}
