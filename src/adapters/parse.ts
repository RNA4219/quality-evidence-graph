import { parseDocument } from "yaml";
import type { IngestArtifact } from "../types.js";

/** Hash the original bytes before calling this parser. YAML is a CTG risk-register contract. */
export function parseProducerArtifact(ref: IngestArtifact, content: string): unknown {
  if (!/\.ya?ml$/i.test(ref.path)) return JSON.parse(content);
  if (ref.adapter !== "code-to-gate" || ref.kind !== "risk_register") throw new Error("YAML is supported only for code-to-gate risk_register");
  const document = parseDocument(content, { schema: "core", uniqueKeys: true });
  if (document.errors.length) throw new Error(document.errors.map(error => error.message).join("; "));
  return document.toJS({ maxAliasCount: 0 });
}
