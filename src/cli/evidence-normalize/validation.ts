import type { ResilienceExecutionEvidenceNode } from "../../types.js";
import { loadSchemaRegistry } from "../../validation/schema.js";
import { CliError } from "../errors.js";
import { type JsonObject, type NormalizeContext } from "./model.js";


export async function validateContext(raw: JsonObject): Promise<NormalizeContext> {
  const registry = await loadSchemaRegistry();
  const validator = registry.validators.get("resilience-normalize-context.schema.json");
  if (!validator) throw new CliError("resilience normalization context schema is unavailable");
  if (!validator(raw)) throw new CliError(`Normalization context schema invalid: ${(validator.errors ?? []).map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
  return raw as NormalizeContext;
}


export async function validateEvidence(evidence: ResilienceExecutionEvidenceNode): Promise<void> {
  const registry = await loadSchemaRegistry();
  const validator = registry.ajv.getSchema("https://quality-harness.dev/schemas/qeg/reliability.schema.json#/$defs/resilienceExecutionEvidenceNode");
  if (!validator) throw new CliError("resilience evidence schema is unavailable");
  if (!validator(evidence)) throw new CliError(`Normalized evidence schema invalid: ${(validator.errors ?? []).map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
}
