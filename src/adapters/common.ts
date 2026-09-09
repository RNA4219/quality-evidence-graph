import type { Confidence, EvidenceRef, IngestArtifact, NodeKind, QegNodeBase, SourceRef, Traceability } from "../types.js";

export type RawObject = Record<string, unknown>;
export function object(value: unknown, label: string): RawObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as RawObject;
}
export function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}
export function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}
export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
export function rows(value: unknown, label: string): RawObject[] { return list(value, label).map((v, i) => object(v, `${label}[${i}]`)); }
export function required(raw: RawObject, fields: readonly string[]): void {
  for (const key of fields) if (raw[key] === undefined || raw[key] === null) throw new Error(`Required field ${key} is missing`);
}
export function producerPrefix(adapter: IngestArtifact["adapter"]): string {
  return adapter === "RanD" ? "rand" : adapter === "code-to-gate" ? "ctg" : "mbb";
}
export function stableId(producer: string, kind: string, local: string): string {
  const prefixed = /^(rand|ctg|mbb|hate|qeg):(.+)$/s.exec(local);
  if (prefixed) return /\s/.test(local) ? `${prefixed[1]}:${encodeURIComponent(prefixed[2])}` : local;
  return `${producer}:${kind}:${encodeURIComponent(local.replaceAll("\\", "/"))}`;
}
export function source(ref: IngestArtifact, pointer: string, label?: string): SourceRef {
  return { id: stableId(producerPrefix(ref.adapter), "source", `${ref.path}/${pointer}`), path: ref.path,
    ...(ref.revision ? { revision: ref.revision } : {}), label: `${pointer}${label ? `: ${label}` : ""}` };
}
export function confidence(value: unknown): Confidence {
  if (value === "low" || value === "medium" || value === "high") return value;
  if (typeof value === "number" && value >= 0 && value <= 1) return value >= 0.8 ? "high" : value >= 0.5 ? "medium" : "low";
  return "medium";
}
export function trace(ref: IngestArtifact, pointer: string, raw: RawObject = {}): Traceability {
  const evidence = [...(Array.isArray(raw.evidence) ? raw.evidence : []), ...(Array.isArray(raw.source_refs) ? raw.source_refs : []),
    ...strings(raw.evidence_refs), ...strings(raw.source_ref && typeof raw.source_ref === "object" ? (raw.source_ref as RawObject).refs : undefined)];
  const sourceRefs: SourceRef[] = [source(ref, pointer)];
  for (const [index, value] of evidence.entries()) {
    const entry = value && typeof value === "object" ? value as RawObject : undefined;
    const path = entry?.path ?? entry?.source_ref ?? entry?.url ?? (typeof value === "string" && /[/\\.]|^https?:/.test(value) ? value : undefined);
    sourceRefs.push({ ...source(ref, `${pointer}/source/${index}`, typeof value === "string" ? value : typeof entry?.id === "string" ? entry.id : undefined),
      ...(typeof path === "string" ? { path } : {}), ...(typeof entry?.startLine === "number" ? { startLine: entry.startLine } : {}),
      ...(typeof entry?.endLine === "number" ? { endLine: entry.endLine } : {}) });
  }
  return { sourceRefs, confidence: confidence(raw.confidence), assumptions: [...strings(raw.assumptions),
    ...(raw.confidence === undefined ? ["producer契約にconfidenceがないためmediumとして扱う"] : [])] };
}
export function base(ref: IngestArtifact, kind: NodeKind, local: string, title: string, raw: RawObject = {}): QegNodeBase {
  return { id: stableId(producerPrefix(ref.adapter), kind, local), kind, title, traceability: trace(ref, local, raw), sourceArtifactIds: [ref.id] };
}
export function evidenceRef(ref: IngestArtifact, local: string, evidenceKind: EvidenceRef["evidenceKind"] = "spec"): EvidenceRef {
  return { ...source(ref, local), evidenceKind, contentHash: ref.contentHash };
}
export function assertNoDirectPolicy(value: unknown, proposal = false): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach(v => assertNoDirectPolicy(v, proposal)); return; }
  for (const [key, child] of Object.entries(value)) {
    if (!proposal && (key === "gate_policy" || key === "gatePolicy")) throw new Error("External Gate policy must be an explicit proposal");
    assertNoDirectPolicy(child, proposal || /proposal/i.test(key));
  }
}
