// Persisted v0.2 DQ-06 diagnostics refer to this path. The verifier now lives in
// src-rust/evidence.rs. Keep the original import path for TypeScript consumers.
export { verifyEvidenceArtifacts } from "@quality-harness/quality-evidence-graph";
export type {
  EvidenceVerificationItem,
  EvidenceVerificationOptions,
  EvidenceVerificationReport,
} from "@quality-harness/quality-evidence-graph";
