import type { AdapterKind, ArtifactKind } from "./primitives.js";
import type { ArtifactRef, EvidencePackage, QegMetadata, SourceRef, Waiver } from "./evidence.js";
import type { GatePolicy } from "./gate.js";
import type { IngestExecutionContext } from "./execution.js";

export interface EvaluationScope {
  readonly kind: "fixture" | "isolated_consumer" | "real_environment";
  readonly target: string;
  readonly notEvaluated: readonly string[];
}

export interface RequiredArtifact {
  readonly adapter: AdapterKind;
  readonly kind: ArtifactKind;
}

export interface InputContract {
  readonly mode: "upstream_artifacts" | "native_graph";
  readonly requiredArtifacts: readonly RequiredArtifact[];
  readonly evaluationScope: EvaluationScope;
  readonly requireExecutedTests: boolean;
  readonly sourceRefs: readonly SourceRef[];
}

export interface IngestArtifact extends ArtifactRef {
  readonly contractVersion: string;
  readonly executionContext?: IngestExecutionContext;
}

export interface IngestManifest {
  readonly manifestVersion: "qeg-ingest/v1";
  readonly metadata: QegMetadata;
  readonly policy: GatePolicy;
  readonly artifacts: readonly IngestArtifact[];
  readonly waivers?: readonly Waiver[];
  readonly evidencePackage?: EvidencePackage;
}

/** CLIで読込・hash検証されたpayload。pure builderはfilesystemを読まない。 */
export interface LoadedArtifact {
  readonly ref: IngestArtifact;
  readonly payload: unknown;
  readonly failure?: { readonly code: "DQ-01" | "DQ-06" | "DQ-12"; readonly message: string };
}
