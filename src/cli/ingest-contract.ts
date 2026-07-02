import type { ParserFailure, SourceRef } from "../types.js";
import { CliError } from "./errors.js";

const RESERVED_PRODUCERS = new Set(["rand", "ctg", "mbb", "hate", "qeg"]);

const ID_FIELD_NAMES = new Set([
  "id",
  "runId",
  "nodeId",
  "obligationId",
  "acceptanceId",
  "taskId",
  "policyId",
  "policy_ref",
  "executedCaseId",
  "subject_id",
]);

const ID_ARRAY_FIELD_NAMES = new Set([
  "nodeIds",
  "riskIds",
  "requirementIds",
  "acceptanceCriteriaIds",
  "failureModeIds",
  "changedCodeIds",
  "sourceArtifactIds",
  "selectedTestIds",
  "replacement_ids",
  "linkedRiskIds",
  "traceTo",
  "previous_subject_ids",
  "current_subject_ids",
]);

const DIRECT_POLICY_KEYS = new Set(["gate_policy", "gatePolicy"]);
const PROPOSAL_KEYS = new Set([
  "gate_policy_proposal",
  "gatePolicyProposal",
  "policy_proposal",
  "policyProposal",
  "policyProposals",
]);

export interface IngestContractValidation {
  readonly parserFailures: readonly ParserFailure[];
  readonly warnings: readonly string[];
}

function sourceRefFor(path: string): SourceRef {
  return {
    id: "qeg:source-ingest-contract",
    path: "docs/spec/node-identity-contract.md",
    label: path,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pathString(path: readonly string[]): string {
  return path.join(".");
}

function isProposalPath(path: readonly string[]): boolean {
  return path.some((part) => PROPOSAL_KEYS.has(part));
}

function isQegOwnedGatePolicy(path: readonly string[], key: string): boolean {
  return key === "gatePolicy" && pathString(path) === "gate-input.json.evidencePackage";
}

function validateNamespacedId(value: string, path: string, warnings: string[]): void {
  const colonIndex = value.indexOf(":");
  if (colonIndex === -1) {
    warnings.push(`Deprecated prefixless ID at ${path}: "${value}"`);
    return;
  }

  const producer = value.slice(0, colonIndex);
  const localId = value.slice(colonIndex + 1);
  if (!RESERVED_PRODUCERS.has(producer)) {
    throw new CliError(
      `Unknown ID producer prefix "${producer}" at ${path}; reserved prefixes are rand, ctg, mbb, hate, qeg`
    );
  }
  if (localId.length === 0) {
    throw new CliError(`Namespaced ID at ${path} must use <producer>:<local-id> with a non-empty local-id`);
  }
}

function inspectIdField(key: string, value: unknown, path: readonly string[], warnings: string[]): void {
  const pathLabel = pathString(path);
  if (ID_FIELD_NAMES.has(key) && typeof value === "string") {
    validateNamespacedId(value, pathLabel, warnings);
  }
  if (ID_ARRAY_FIELD_NAMES.has(key) && Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (typeof value[index] === "string") {
        validateNamespacedId(value[index] as string, `${pathLabel}[${index}]`, warnings);
      }
    }
  }
}

function inspectRawValue(
  value: unknown,
  path: readonly string[],
  parserFailures: ParserFailure[],
  warnings: string[]
): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      inspectRawValue(value[index], [...path, String(index)], parserFailures, warnings);
    }
    return;
  }

  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    inspectIdField(key, child, childPath, warnings);

    if (DIRECT_POLICY_KEYS.has(key) && !isProposalPath(path) && !isQegOwnedGatePolicy(path, key)) {
      const location = pathString(childPath);
      parserFailures.push({
        path: location,
        reason:
          "External artifact carried gate_policy directly; QEG is the sole Gate policy source of truth and external policy must be explicit proposal-only",
        sourceRefs: [sourceRefFor(location)],
      });
    }

    inspectRawValue(child, childPath, parserFailures, warnings);
  }
}

export function validateIngestContract(rawInput: unknown): IngestContractValidation {
  const parserFailures: ParserFailure[] = [];
  const warnings: string[] = [];
  inspectRawValue(rawInput, ["gate-input.json"], parserFailures, warnings);
  return { parserFailures, warnings };
}
