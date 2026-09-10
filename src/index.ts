export * from "./types.js";
export { evaluateGate, getExitCode } from "./gate.js";
export { isGateEligibleTestEvidence } from "./gate/test-evidence.js";
export { validateGateInput, verifyEvidenceArtifacts } from "./validation.js";
export { validateOutput } from "./validation/output.js";
export { createRecordArtifacts } from "./record.js";
export { upstreamInputContract, UPSTREAM_REQUIRED_ARTIFACTS } from "./input-contract.js";
export type {
  EvidenceVerificationItem,
  EvidenceVerificationOptions,
  EvidenceVerificationReport,
  GateInputValidationIssue,
  GateInputValidationReport,
} from "./validation.js";
export { buildGraph } from "./graph.js";
export { placeTests, PLACEMENT_LAYERS } from "./placement.js";
export { readPublishedOutputs, recoverOutputs, publishFiles } from "./output-publication.js";
export type { PublishedOutputs } from "./output-publication.js";
export { planConsumerMigration, applyConsumerMigration } from "./consumer-migration.js";
export type { ConsumerMigrationConfig, ConsumerMigrationReport } from "./consumer-migration.js";
export { parseProducerArtifact } from "./adapters/parse.js";
