import type {
  Disqualification
} from "../../types.js";
import { validateReliabilitySemantics } from "../../validation/reliability-semantics.js";
import type { DQDetectorInput } from "../context.js";
import {
  dq,
  isFullGitObjectId,
  isSha256
} from "./utils.js";


export type ArtifactFailureClass = "non_revision" | "revision";


export function artifactFailureClasses(
  input: DQDetectorInput,
): ReadonlyMap<string, ArtifactFailureClass> {
  const byArtifact = new Map<string, ArtifactFailureClass>();
  for (const item of input.evidenceVerification?.items ?? []) {
    if (item.severity !== "fail" || item.code === "VERIFIED") continue;
    const current = byArtifact.get(item.artifactId);
    if (item.code !== "REVISION_MISMATCH" || current === "non_revision") {
      byArtifact.set(item.artifactId, "non_revision");
    } else {
      byArtifact.set(item.artifactId, "revision");
    }
  }
  return byArtifact;
}


export function artifactVerificationDqs(input: DQDetectorInput): Disqualification[] {
  const report = input.evidenceVerification;
  if (!report) {
    return [
      dq(
        "DQ-06",
        "Reliability policy is enabled but artifact verification report is missing",
        [],
      ),
    ];
  }
  const classes = artifactFailureClasses(input);
  const result: Disqualification[] = [];
  const preflightOwnsDq06 = input.preflightDisqualifications.some(
    (item) => item.code === "DQ-06",
  );
  for (const artifactId of [...classes.keys()].sort()) {
    const failureClass = classes.get(artifactId);
    if (failureClass === "non_revision") {
      if (!preflightOwnsDq06) {
        result.push(
          dq("DQ-06", "Artifact verification failed for " + artifactId, [artifactId]),
        );
      }
    } else if (failureClass === "revision") {
      result.push(
        dq("DQ-12", "Artifact revision mismatch for " + artifactId, [artifactId]),
      );
    }
  }
  if (report.status === "fail" && classes.size === 0 && !preflightOwnsDq06) {
    result.push(
      dq(
        "DQ-06",
        "Artifact verification failed without a classified artifact diagnostic",
        [],
      ),
    );
  }
  return result;
}


export function semanticInputDqs(input: DQDetectorInput): Disqualification[] {
  const issues = validateReliabilitySemantics(input);
  if (
    issues.length === 0 ||
    input.preflightDisqualifications.some((item) => item.code === "DQ-01")
  ) {
    return [];
  }
  return issues.map((issue) =>
    dq(
      "DQ-01",
      "[" + issue.ruleId + "] " + issue.message + " at " + issue.path,
      issue.nodeId ? [issue.nodeId] : [],
    ),
  );
}


export function policyIntegrityDqs(input: DQDetectorInput): Disqualification[] {
  const { metadata, graph, policy } = input;
  const allowedProfiles = new Set(["standard", "strict", "ipo_controlled"]);
  const requiredDqScope: readonly Disqualification["code"][] = [
    "DQ-18",
    "DQ-19",
    "DQ-20",
    "DQ-21",
  ];
  const valuesMatch =
    metadata.profile === policy.profile &&
    graph.metadata.profile === policy.profile &&
    metadata.policyId === policy.policyId &&
    graph.metadata.policyId === policy.policyId &&
    metadata.policyHash === policy.policyHash &&
    graph.metadata.policyHash === policy.policyHash &&
    metadata.headRef === graph.metadata.headRef;
  if (
    !isFullGitObjectId(metadata.headRef) ||
    !isFullGitObjectId(graph.metadata.headRef) ||
    !isSha256(policy.policyHash) ||
    !isSha256(metadata.policyHash) ||
    !isSha256(graph.metadata.policyHash) ||
    !allowedProfiles.has(policy.profile) ||
    !requiredDqScope.every((code) => policy.dqScope.includes(code)) ||
    !valuesMatch
  ) {
    return [
      dq(
        "DQ-21",
        "Reliability policy identity, SHA-256 hash, profile, DQ scope, or full revision is invalid or does not match across Gate, graph, and policy",
        [],
      ),
    ];
  }
  return [];
}


export function globalQualificationDqs(
  input: DQDetectorInput,
): Disqualification[] {
  return [
    ...semanticInputDqs(input),
    ...artifactVerificationDqs(input),
    ...policyIntegrityDqs(input),
  ];
}
