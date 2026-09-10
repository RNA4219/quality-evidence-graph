import type { ExecutionPolicy, GateProfile, IngestArtifact, ParserFailure, QegEdge, QegNode, UnsupportedClaim } from "../types.js";
import type { RawObject } from "./common.js";

export interface AdapterResult {
  readonly nodes: QegNode[];
  readonly edges: QegEdge[];
  readonly parserFailures: ParserFailure[];
  readonly unsupportedClaims: UnsupportedClaim[];
}
export interface AdapterContext {
  readonly executionPolicy?: ExecutionPolicy;
  readonly ref: IngestArtifact;
  readonly raw: RawObject;
  readonly profile: GateProfile;
  readonly knownChanges: ReadonlyMap<string, string>;
}
export function emptyResult(): AdapterResult { return { nodes: [], edges: [], parserFailures: [], unsupportedClaims: [] }; }
