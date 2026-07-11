import type { EvidencePackage, QegMetadata, Waiver } from "./evidence.js";
import type { GatePolicy } from "./gate.js";
import type { QualityEvidenceGraph, TestPlacementPlan } from "./graph.js";
import type { OptionalEvidence } from "./record.js";

/** Canonical JSON envelope consumed by QEG 0.2. */
export interface QegGateInput {
  readonly metadata: QegMetadata;
  readonly graph: QualityEvidenceGraph;
  readonly policy: GatePolicy;
  readonly waivers?: readonly Waiver[];
  readonly evidencePackage?: EvidencePackage;
  readonly placementPlan?: TestPlacementPlan;
  readonly optionalEvidence?: OptionalEvidence;
}
