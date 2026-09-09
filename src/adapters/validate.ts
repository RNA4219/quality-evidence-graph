import { Ajv2020, type AnySchema, type ValidateFunction } from "ajv/dist/2020.js";
import schemas from "./producer-schemas.json" with { type: "json" };
import type { IngestArtifact } from "../types.js";

const validators = new Map<string, ValidateFunction>();
function validator(producer: keyof typeof schemas, filename: string): ValidateFunction {
  const key = `${producer}/${filename}`;
  let validate = validators.get(key);
  if (!validate) {
    const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
    const entries = schemas[producer] as Record<string, AnySchema>;
    for (const schema of Object.values(entries)) ajv.addSchema(schema);
    const schema = entries[filename] as { $id: string } | undefined;
    if (!schema) throw new Error(`Unsupported producer schema ${key}`);
    validate = ajv.getSchema(schema.$id)!;
    validators.set(key, validate);
  }
  return validate;
}
export function validateProducerPayload(ref: IngestArtifact, payload: unknown): void {
  if (ref.adapter !== "code-to-gate" && ref.adapter !== "manual-bb-test-harness") return;
  const filename = `${ref.adapter === "code-to-gate" ? ref.kind.replaceAll("_", "-") : ref.kind}.schema.json`;
  const validate = validator(ref.adapter, filename);
  if (!validate(payload)) throw new Error(`Producer schema ${filename}: ${(validate.errors ?? []).slice(0, 6).map(e => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
}
