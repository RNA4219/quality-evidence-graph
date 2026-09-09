import type { ResilienceAdapter, ResilienceExecutionEvidenceNode } from "../../types.js";


export type JsonObject = Record<string, unknown>;

export type NormalizeAdapter = Extract<ResilienceAdapter, "lakda" | "toxiproxy" | "shell" | "ci">;


export interface NormalizeOptions {
  readonly adapter: ResilienceAdapter;
  readonly input: string;
  readonly context: string;
  readonly out: string;
  readonly baseDir: string;
  readonly force: boolean;
}


export interface NormalizeContext extends JsonObject {
  readonly node: {
    readonly id: string;
    readonly title: string;
    readonly traceability: ResilienceExecutionEvidenceNode["traceability"];
    readonly sourceArtifactIds: readonly string[];
  };
  readonly testId: string;
  readonly environment: ResilienceExecutionEvidenceNode["environment"];
  readonly environmentId: string;
  readonly adapterVersion: string;
  readonly targetRevision: string;
  readonly experimentId?: string;
  readonly attempt?: number;
  readonly lifecycle?: Partial<Pick<ResilienceExecutionEvidenceNode, "startedAt" | "endedAt" | "status" | "steadyStateConfirmed" | "fault" | "abortRecord" | "recovered" | "recoveryConfirmedAt" | "recoveryDurationMs">>;
  readonly observed?: ResilienceExecutionEvidenceNode["observed"];
  readonly evidenceRefs: ResilienceExecutionEvidenceNode["evidenceRefs"];
  readonly signalManifest: ResilienceExecutionEvidenceNode["signalManifest"];
}


export const SUPPORTED_ADAPTERS = new Set<NormalizeAdapter>(["lakda", "toxiproxy", "shell", "ci"]);
