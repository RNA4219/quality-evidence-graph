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
    for (const source of raw.source_refs) {
      const to = source?.id;
      if (typeof to !== "string" || to === from || !requirements.has(to)) continue;
      edges.push({ id: `qeg:requirement-link:${encodeURIComponent(from + "/" + to)}`, from, to, kind: "derives_from", traceability: trace(ref, "/source_refs") });
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
