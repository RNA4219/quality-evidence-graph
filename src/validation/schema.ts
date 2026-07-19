import { Ajv2020, type AnySchema, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { readdir, readFile } from "fs/promises";
import { basename, join } from "path";
import { fileURLToPath } from "url";
import type { QegGateInput } from "../types.js";

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
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function reliabilitySemanticIssues(raw: unknown): GateInputValidationIssue[] {
  if (!isObject(raw) || !isObject(raw.graph) || !Array.isArray(raw.graph.nodes)) return [];
  const issues: GateInputValidationIssue[] = [];
  const add = (path: string, message: string): void => {
    issues.push({ path, keyword: "reliabilityContract", message, scope: "graph" });
  };
  raw.graph.nodes.forEach((node, nodeIndex) => {
    if (!isObject(node)) return;
    if (node.kind === "test" && node.testType === "resilience" && isObject(node.resilienceScenario)) {
      const steadyState = isObject(node.resilienceScenario.steadyState) ? node.resilienceScenario.steadyState : undefined;
      const slos = Array.isArray(steadyState?.slos) ? steadyState.slos : [];
      const requiredMetrics = Array.isArray(steadyState?.requiredMetrics) ? steadyState.requiredMetrics : [];
      const names = new Set<string>();
      const tuples = new Set<string>();
      slos.forEach((slo, sloIndex) => {
        if (!isObject(slo)) return;
        const base = `/graph/nodes/${nodeIndex}/resilienceScenario/steadyState/slos/${sloIndex}`;
        if (typeof slo.name === "string" && names.has(slo.name)) add(`${base}/name`, `duplicate SLO name ${slo.name}`);
        if (typeof slo.name === "string") names.add(slo.name);
        const tuple = [slo.metricName, slo.semanticRole, slo.aggregation, slo.unit].map(String).join("\u0000");
        if (tuples.has(tuple)) add(base, "duplicate metricName/semanticRole/aggregation/unit SLO tuple");
        tuples.add(tuple);
        if (typeof slo.metricName === "string" && !requiredMetrics.includes(slo.metricName)) add(`${base}/metricName`, `SLO metric ${slo.metricName} is absent from requiredMetrics`);
        if (isObject(slo.target) && slo.target.targetType === "range" && typeof slo.target.min === "number" && typeof slo.target.max === "number" && slo.target.min >= slo.target.max) add(`${base}/target`, "SLO range min must be less than max");
      });
      const abortConditions = Array.isArray(node.resilienceScenario.abortConditions) ? node.resilienceScenario.abortConditions : [];
      const abortIds = abortConditions.map((condition) => isObject(condition) ? condition.id : undefined).filter((id): id is string => typeof id === "string");
      if (new Set(abortIds).size !== abortIds.length) add(`/graph/nodes/${nodeIndex}/resilienceScenario/abortConditions`, "abort condition IDs must be unique");
    }
    if (node.kind === "execution_evidence" && node.evidenceType === "resilience" && isObject(node.signalManifest)) {
      const entries = [node.signalManifest.metrics, node.signalManifest.traces, node.signalManifest.logs]
        .flatMap((value) => Array.isArray(value) ? value : [])
        .filter(isObject);
      const entryIds = entries.map((entry) => entry.id).filter((id): id is string => typeof id === "string");
      if (new Set(entryIds).size !== entryIds.length) add(`/graph/nodes/${nodeIndex}/signalManifest`, "signal entry IDs must be unique");
    }
  });
  return issues;
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
  const allIssues = [...formatSchemaErrors(validator.errors), ...reliabilitySemanticIssues(raw)];
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
