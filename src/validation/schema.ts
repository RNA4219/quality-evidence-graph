import { Ajv2020, type AnySchema, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { readdir, readFile } from "fs/promises";
import { basename, join } from "path";
import { fileURLToPath } from "url";
import type { QegGateInput } from "../types.js";
import { validateReliabilitySemantics } from "./reliability-semantics.js";

export interface GateInputValidationIssue {
  readonly path: string;
  readonly keyword: string;
  readonly message: string;
  readonly scope: "envelope" | "metadata" | "graph" | "policy" | "evidencePackage" | "placementPlan" | "waiver" | "optionalEvidence";
}
export interface GateInputValidationReport {
  readonly reportVersion: "qeg-gate-input-validation-v2";
  readonly valid: boolean;
  readonly issues: readonly GateInputValidationIssue[];
  readonly warnings: readonly GateInputValidationIssue[];
  readonly input?: QegGateInput;
}
export interface SchemaRegistry {
  readonly ajv: Ajv2020;
  readonly validators: ReadonlyMap<string, ValidateFunction>;
  readonly schemaDir: string;
}

const DEFAULT_SCHEMA_DIR = fileURLToPath(new URL("../../schemas/", import.meta.url));
let defaultRegistry: Promise<SchemaRegistry> | undefined;

function issueScope(path: string): GateInputValidationIssue["scope"] {
  const segment = path.split("/").filter(Boolean)[0];
  if (segment === "metadata" || segment === "graph" || segment === "policy" ||
      segment === "evidencePackage" || segment === "placementPlan" || segment === "optionalEvidence") return segment;
  if (segment === "waivers") return "waiver";
  return "envelope";
}
export function formatSchemaErrors(errors: ErrorObject[] | null | undefined): GateInputValidationIssue[] {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || "/",
    keyword: error.keyword,
    message: error.message ?? "schema validation failed",
    scope: issueScope(error.instancePath || "/"),
  }));
}
async function schemaFiles(schemaDir: string): Promise<string[]> {
  return (await readdir(schemaDir)).filter((file) => file.endsWith(".schema.json")).sort().map((file) => join(schemaDir, file));
}
export async function loadSchemaRegistry(schemaDir = DEFAULT_SCHEMA_DIR): Promise<SchemaRegistry> {
  if (schemaDir === DEFAULT_SCHEMA_DIR && defaultRegistry) return defaultRegistry;
  const load = (async (): Promise<SchemaRegistry> => {
    const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
    const schemas = new Map<string, AnySchema>();
    for (const file of await schemaFiles(schemaDir)) {
      const schema = JSON.parse(await readFile(file, "utf-8")) as AnySchema;
      schemas.set(basename(file), schema);
      ajv.addSchema(schema);
    }
    const validators = new Map<string, ValidateFunction>();
    for (const [name, schema] of schemas) {
      const id = typeof schema === "object" && schema !== null && "$id" in schema ? String((schema as { $id: unknown }).$id) : name;
      validators.set(name, ajv.getSchema(id) ?? ajv.compile(schema));
    }
    return { ajv, validators, schemaDir };
  })();
  if (schemaDir === DEFAULT_SCHEMA_DIR) defaultRegistry = load;
  return load;
}
export async function validateGateInput(raw: unknown): Promise<GateInputValidationReport> {
  const { validators } = await loadSchemaRegistry();
  const validator = validators.get("gate-input.schema.json");
  if (!validator) {
    return { reportVersion: "qeg-gate-input-validation-v2", valid: false, issues: [{ path: "/", keyword: "schema", message: "gate-input.schema.json is unavailable", scope: "envelope" }], warnings: [] };
  }
  validator(raw);
  const semanticIssues = validateReliabilitySemantics(raw).map((issue) => ({
    path: issue.path,
    keyword: issue.ruleId,
    message: issue.message,
    scope: issueScope(issue.path),
  }));
  const allIssues = [...formatSchemaErrors(validator.errors), ...semanticIssues];
  const warnings = allIssues.filter((issue) => issue.scope === "optionalEvidence");
  const issues = allIssues.filter((issue) => issue.scope !== "optionalEvidence");
  const valid = issues.length === 0;
  let input: QegGateInput | undefined;
  if (valid && raw && typeof raw === "object" && !Array.isArray(raw)) {
    const sanitized = { ...raw } as Record<string, unknown>;
    if (warnings.length > 0) delete sanitized.optionalEvidence;
    input = sanitized as unknown as QegGateInput;
  }
  return { reportVersion: "qeg-gate-input-validation-v2", valid, issues, warnings, ...(input ? { input } : {}) };
}
