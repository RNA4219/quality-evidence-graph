import type { LoadedArtifact, QegEdge, QegNode } from "../types.js";
import { trace } from "../adapters/common.js";
import { manualScopedId } from "../adapters/manual-bb.js";

/** Resolve explicit upstream IDs when the referenced requirement exists in this graph. */
export function requirementEdges(nodes: readonly QegNode[], loaded: readonly LoadedArtifact[]): QegEdge[] {
  const requirements = new Set(nodes.filter(n => n.kind === "requirement").map(n => n.id));
  const edges: QegEdge[] = [];
  for (const { ref, payload, failure } of loaded) {
    if (failure || ref.adapter !== "manual-bb-test-harness" || ref.kind !== "feature_spec" || !payload || typeof payload !== "object") continue;
    const raw = payload as { feature_id?: unknown; source_refs?: { id?: unknown }[] };
    if (typeof raw.feature_id !== "string" || !Array.isArray(raw.source_refs)) continue;
    if (!ref.executionContext) continue;
    const from = manualScopedId(ref.executionContext.projectId, raw.feature_id, "requirement", raw.feature_id);
    if (!requirements.has(from)) continue;
    const mappings = new Map<string, string>();
    for (const mapping of ref.sourceRefMappings ?? []) {
      if (mappings.has(mapping.sourceId) || !raw.source_refs.some(source => source.id === mapping.sourceId) || !requirements.has(mapping.requirementId)) throw new Error(`Unresolved or duplicate sourceRefMapping in ${ref.path}`);
      mappings.set(mapping.sourceId, mapping.requirementId);
    }
    for (const source of raw.source_refs) {
      const to = typeof source?.id === "string" ? mappings.get(source.id) ?? source.id : undefined;
      if (typeof to !== "string" || to === from || !requirements.has(to)) continue;
      const traceability = trace(ref, "/source_refs");
      edges.push({ id: `qeg:requirement-link:${encodeURIComponent(from + "/" + to)}`, from, to, kind: "derives_from", traceability: {
        ...traceability, sourceRefs: [...traceability.sourceRefs, ...(mappings.has(String(source.id)) ? [{ id: `qeg:source-mapping:${encodeURIComponent(ref.id + "/" + String(source.id))}`,
          path: "ingest-manifest.json", revision: ref.revision, label: `${ref.id}/sourceRefMappings: ${String(source.id)} -> ${to}` }] : [])],
      } });
    }
  }
  return [...new Map(edges.map(e => [e.id, e])).values()];
}

export function requirementAncestors(ids: readonly string[], nodes: readonly QegNode[], edges: readonly QegEdge[]): string[] {
  const valid = new Set(nodes.filter(n => n.kind === "requirement").map(n => n.id));
  const found = new Set(ids);
  const queue = [...ids];
  while (queue.length) {
    const id = queue.shift()!;
    for (const edge of edges) if (edge.kind === "derives_from" && edge.from === id && valid.has(edge.to) && !found.has(edge.to)) {
      found.add(edge.to); queue.push(edge.to);
    }
  }
  return [...found].sort();
}
