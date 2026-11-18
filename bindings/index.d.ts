export type * from "../src/types.js";
import type { QegGateInput, GateResult, QegMetadata, QualityEvidenceGraph, GatePolicy, GateVerdict, Disqualification, Waiver, EvidencePackage, TestPlacementPlan, OptionalEvidence, TestNode, QualityEvidenceRecord, IngestManifest, LoadedArtifact, IngestArtifact, InputContract, RequiredArtifact, PlacementLayer } from "../src/types.js";

export type EvidenceVerificationSeverity = "pass" | "warn" | "fail";
export interface EvidenceVerificationItem {
    readonly artifactId: string;
    readonly path?: string;
    readonly severity: EvidenceVerificationSeverity;
    readonly code: "PATH_MISSING" | "PATH_OUTSIDE_BASE" | "FILE_MISSING" | "IO_ERROR" | "HASH_MISSING" | "HASH_MISMATCH" | "REVISION_MISMATCH" | "PAYLOAD_MISMATCH" | "VERIFIED";
    readonly message: string;
}
export interface EvidenceVerificationOptions {
    readonly baseDir: string;
    readonly strict?: boolean;
}
export interface EvidenceVerificationReport {
    readonly reportVersion: "qeg-evidence-verification-v2";
    readonly status: EvidenceVerificationSeverity;
    readonly items: readonly EvidenceVerificationItem[];
    readonly executionFingerprint?: string;
}
export declare function verifyEvidenceArtifacts(input: QegGateInput, options: EvidenceVerificationOptions): Promise<EvidenceVerificationReport>;

export interface GateInputValidationIssue {
    readonly path: string;
    readonly keyword: string;
    readonly message: string;
    readonly scope: "envelope" | "metadata" | "graph" | "policy" | "evidencePackage" | "placementPlan" | "waiver" | "optionalEvidence";
}

export interface GateInputValidationReport {
    readonly reportVersion: "qeg-gate-input-validation-v2";
    readonly valid: boolean;
    readonly issues: readonly GateInputValidationIssue[];
    readonly warnings: readonly GateInputValidationIssue[];
    readonly input?: QegGateInput;
}

export interface OutputValidationReport {
    readonly valid: boolean;
    readonly schema: string;
    readonly issues: readonly GateInputValidationIssue[];
}

export interface GateEvaluationInput {
    metadata: QegMetadata;
    graph: QualityEvidenceGraph;
    policy: GatePolicy;
    waivers: readonly Waiver[];
    evidencePackage?: EvidencePackage;
    placementPlan?: TestPlacementPlan;
    /**
     * Verification is part of the reliability contract.  It is deliberately
     * carried into programmatic evaluation so callers cannot claim a reliable
     * verdict without having verified the referenced raw and signal artifacts.
     */
    evidenceVerification?: EvidenceVerificationReport;
    preflightDisqualifications?: readonly Disqualification[];
}

export interface EvaluatedFixture {
    fixtureDir: string;
    metadata: QegMetadata;
    graph: QualityEvidenceGraph;
    policy: GatePolicy;
    waivers: Waiver[];
    evidencePackage: EvidencePackage | undefined;
    placementPlan: TestPlacementPlan | undefined;
    optionalEvidence: OptionalEvidence | undefined;
    gateResult: GateResult;
    schemaValidation: GateInputValidationReport;
    evidenceVerification?: EvidenceVerificationReport;
}

export interface PublishedOutputs {
    readonly generation: string;
    readonly files: ReadonlyMap<string, string>;
}

export interface PublishOptions {
    readonly onBoundary?: (boundary: string) => Promise<void>;
}

export interface ConsumerMigrationConfig {
    readonly migrationVersion: "qeg-consumer-migration/v1";
    readonly expectedInputHash: string;
    readonly policy: GatePolicy;
}

export interface ConsumerMigrationReport {
    readonly migrationVersion: "qeg-consumer-migration/v1";
    readonly status: "needs_configuration" | "blocked" | "ready" | "unchanged" | "applied";
    readonly inputHash: string;
    readonly outputHash?: string;
    readonly missingInputs: readonly string[];
    readonly changes: readonly {
        path: string;
        before: unknown;
        after: unknown;
    }[];
    readonly gate?: {
        verdict: string;
        disqualifications: readonly string[];
    };
    readonly notes: readonly string[];
}

export declare const UPSTREAM_REQUIRED_ARTIFACTS: readonly RequiredArtifact[];
export declare const PLACEMENT_LAYERS: readonly PlacementLayer[];
export declare function upstreamInputContract(target: string): InputContract;
export declare function buildGraph(manifest: IngestManifest, loaded: readonly LoadedArtifact[]): QualityEvidenceGraph;
export declare function placeTests(graph: QualityEvidenceGraph, policy?: GatePolicy): TestPlacementPlan;
export declare function parseProducerArtifact(ref: IngestArtifact, content: string): unknown;
export declare function evaluateGate(input: GateEvaluationInput): GateResult;
export declare function getExitCode(verdict: GateVerdict, policy: GatePolicy): number;
export declare function isGateEligibleTestEvidence(test: TestNode): boolean;
export declare function createRecordArtifacts(evaluated: EvaluatedFixture): {record: QualityEvidenceRecord; files: Map<string, string>};
export declare function validateGateInput(raw: unknown): Promise<GateInputValidationReport>;
export declare function validateOutput(value: unknown, schema: string): Promise<OutputValidationReport>;
export declare function readPublishedOutputs(directory: string): Promise<PublishedOutputs>;
export declare function recoverOutputs(directory: string): Promise<string>;
export declare function publishFiles(directory: string, files: ReadonlyMap<string, string>, options?: PublishOptions): Promise<void>;
export declare function planConsumerMigration(directory: string, config?: ConsumerMigrationConfig): Promise<ConsumerMigrationReport>;
export declare function applyConsumerMigration(directory: string, config: ConsumerMigrationConfig): Promise<ConsumerMigrationReport>;
