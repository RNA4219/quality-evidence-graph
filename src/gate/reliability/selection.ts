import type { ResilienceExecutionEvidenceNode, ResilienceTestNode } from "../../types.js";
import type { DQDetectorInput } from "../context.js";
import type { EvidenceSelection } from "./contracts.js";
import { evidenceRevisionDqs } from "./qualification.js";
import {
  decisionFingerprint,
  dq,
  isResilienceEvidence,
  lexicalCompare,
} from "./utils.js";

function evidencedByProvenanceDqs(
  input: DQDetectorInput,
  test: ResilienceTestNode,
  evidenceNodes: readonly ResilienceExecutionEvidenceNode[],
): EvidenceSelection["disqualifications"] {
  const nodesById = new Map(input.graph.nodes.map((node) => [node.id, node]));
  const contradictoryIds = new Set<string>();

  for (const evidence of evidenceNodes) {
    const incoming = input.graph.edges.filter(
      (edge) => edge.kind === "evidenced_by" && edge.to === evidence.id,
    );
    if (incoming.length === 0) continue;

    const sourceIds = [...new Set(incoming.map((edge) => edge.from))].sort(
      lexicalCompare,
    );
    const source = sourceIds.length === 1
      ? nodesById.get(sourceIds[0] ?? "")
      : undefined;
    if (
      sourceIds.length === 1 &&
      sourceIds[0] === test.id &&
      source?.kind === "test"
    ) {
      continue;
    }

    contradictoryIds.add(evidence.id);
    contradictoryIds.add(test.id);
    for (const sourceId of sourceIds) contradictoryIds.add(sourceId);
  }

  return contradictoryIds.size === 0
    ? []
    : [
      dq(
        "DQ-18",
        "Latest resilience evidence has evidenced_by provenance that contradicts testId",
        [...contradictoryIds],
      ),
    ];
}

export function selectEvidence(
  input: DQDetectorInput,
  test: ResilienceTestNode,
): EvidenceSelection {
  const all = input.graph.nodes
    .filter(isResilienceEvidence)
    .filter((evidence) => evidence.testId === test.id)
    .sort((left, right) => lexicalCompare(left.id, right.id));
  const current = all.filter(
    (evidence) => evidence.targetRevision === input.metadata.headRef,
  );
  if (current.length === 0) {
    const revisionDqs = all.flatMap((evidence) => evidenceRevisionDqs(input, evidence));
    return {
      disqualifications:
        revisionDqs.length > 0
          ? revisionDqs
          : [dq("DQ-18", "No current resilience evidence exists for required test", [test.id])],
      exclusionReason: "no_current_real_evidence",
    };
  }

  const invalidTimestamps = current.filter(
    (evidence) => !Number.isFinite(Date.parse(evidence.endedAt)),
  );
  if (invalidTimestamps.length > 0) {
    return {
      disqualifications: [
        dq(
          "DQ-18",
          "Current resilience evidence has an invalid endedAt timestamp",
          invalidTimestamps.map((evidence) => evidence.id),
        ),
      ],
      exclusionReason: "invalid_current_timestamp",
    };
  }

  const byIdentity = new Map<string, ResilienceExecutionEvidenceNode[]>();
  for (const evidence of current) {
    const key = [
      evidence.adapter,
      evidence.experimentId,
      evidence.attempt,
      evidence.targetRevision,
    ].join(String.fromCharCode(0));
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), evidence]);
  }
  for (const duplicates of [...byIdentity.values()].sort((left, right) =>
    lexicalCompare(left[0]?.id ?? "", right[0]?.id ?? "")
  )) {
    if (
      duplicates.length > 1 &&
      new Set(duplicates.map(decisionFingerprint)).size > 1
    ) {
      return {
        disqualifications: [
          dq(
            "DQ-19",
            "Current resilience evidence reuses an execution identity with conflicting decision fingerprints",
            duplicates.map((evidence) => evidence.id),
          ),
        ],
        exclusionReason: "ambiguous_execution_identity",
      };
    }
  }

  const newestTime = Math.max(
    ...current.map((evidence) => Date.parse(evidence.endedAt)),
  );
  const newest = current
    .filter((evidence) => Date.parse(evidence.endedAt) === newestTime)
    .sort((left, right) => lexicalCompare(left.id, right.id));
  if (new Set(newest.map(decisionFingerprint)).size > 1) {
    return {
      disqualifications: [
        dq(
          "DQ-19",
          "Latest current resilience evidence has conflicting decision fingerprints",
          newest.map((evidence) => evidence.id),
        ),
      ],
      exclusionReason: "ambiguous_latest_evidence",
    };
  }
  const provenanceDqs = evidencedByProvenanceDqs(input, test, newest);
  if (provenanceDqs.length > 0) {
    return {
      evidence: newest[0],
      disqualifications: provenanceDqs,
      exclusionReason: "contradictory_evidenced_by_provenance",
    };
  }
  return { evidence: newest[0], disqualifications: [] };
}
