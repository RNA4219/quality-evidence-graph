import { createHash } from "crypto";
import type {
  ResilienceExecutionEvidenceNode
} from "../../types.js";
import { lexicalCompare } from "./collections.js";


export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => lexicalCompare(left, right));
    return "{" + entries
      .map(([key, child]) => JSON.stringify(key) + ":" + canonicalJson(child))
      .join(",") + "}";
  }
  return JSON.stringify(value);
}


export function decisionFingerprint(evidence: ResilienceExecutionEvidenceNode): string {
  const {
    id: _id,
    title: _title,
    traceability: _traceability,
    sourceArtifactIds: _sourceArtifactIds,
    ...decisionFields
  } = evidence;
  return createHash("sha256").update(canonicalJson(decisionFields)).digest("hex");
}
