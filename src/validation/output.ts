import { loadSchemaRegistry, formatSchemaErrors, type GateInputValidationIssue } from "./schema.js";

export interface OutputValidationReport {
  readonly valid: boolean;
  readonly schema: string;
  readonly issues: readonly GateInputValidationIssue[];
}

export const OUTPUT_SCHEMAS: Readonly<Record<string, string>> = {
  "qeg.bundle.json": "qeg.bundle.schema.json",
  "test-placement-plan.json": "test-placement-plan.schema.json",
  "gate-verdict.json": "gate-verdict.schema.json",
  "quality-evidence-record.json": "quality-evidence-record.schema.json",
  "output-record.json": "quality-evidence-record.schema.json",
  "output-manifest.json": "output-manifest.schema.json",
};

export async function validateOutput(value: unknown, schema: string): Promise<OutputValidationReport> {
  const registry = await loadSchemaRegistry();
  const validator = registry.validators.get(schema);
  if (!validator) throw new Error(`Output schema unavailable: ${schema}`);
  const valid = Boolean(validator(value));
  return { valid, schema, issues: formatSchemaErrors(validator.errors) };
}

export async function assertValidOutput(value: unknown, schema: string): Promise<void> {
  const result = await validateOutput(value, schema);
  if (!result.valid) throw new Error(`Own-output validation failed (${schema}): ${result.issues.map(i => `${i.path} ${i.message}`).join("; ")}`);
}
