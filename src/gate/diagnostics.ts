import type { Disqualification, GateBlocker, QualityEvidenceGraph, SourceRef } from "../types.js";
import { inputSource } from "../input-contract.js";

/** 証拠不足のDQにも、欠落を観測した入力位置を付ける。欠落そのものは修復しない。 */
export function sourceDiagnostics<T extends Disqualification | GateBlocker>(items: readonly T[], graph: QualityEvidenceGraph): T[] {
  return items.map(item => {
    if (item.sourceRefs.length > 0) return item;
    const ids = "nodeIds" in item ? item.nodeIds : item.riskIds;
    const sourceRefs: SourceRef[] = [];
    for (const id of ids) {
      const index = graph.nodes.findIndex(n => n.id === id);
      sourceRefs.push(inputSource(index >= 0 ? `/graph/nodes/${index}` : "/", `Diagnostic subject ${id}`));
    }
    if (sourceRefs.length === 0) sourceRefs.push(inputSource("/", item.message));
    return { ...item, sourceRefs };
  });
}
