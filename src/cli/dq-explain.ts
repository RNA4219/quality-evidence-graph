import { exit } from "process";
import type { DisqualificationCode } from "../types.js";
import { CliError } from "./errors.js";

export interface DqExplanation {
  readonly code: DisqualificationCode;
  readonly title: string;
  readonly meaning: string;
  readonly commonCauses: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly minimalFix: readonly string[];
  readonly references: readonly string[];
  readonly remediation: string;
}

const DQ_EXPLANATIONS: Record<DisqualificationCode, DqExplanation> = {
  "DQ-01": {
    code: "DQ-01",
    title: "Parser or ingest failure",
    meaning: "QEG could not safely ingest one or more required inputs.",
    commonCauses: ["Missing or invalid gate-input.json", "External artifact carries direct gate_policy", "Malformed upstream artifact"],
    requiredEvidence: ["Valid gate-input.json", "Parser failure sourceRefs when converted into QEG completeness.parserFailures"],
    minimalFix: ["Fix the malformed input", "Regenerate gate-input.json", "Use gatePolicyProposal for external policy proposals"],
    references: ["docs/spec/node-identity-contract.md", "docs/spec/gate-policy.md"],
    remediation: "Fix parser/input failures and make required gate artifacts available before QEG runs.",
  },
  "DQ-02": {
    code: "DQ-02",
    title: "Gate blocker has no sourceRefs",
    meaning: "A gate-relevant blocker exists but cannot be audited back to source evidence.",
    commonCauses: ["Risk sourceRefs are empty", "Generated blocker lost traceability"],
    requiredEvidence: ["sourceRefs on each blocker or source risk"],
    minimalFix: ["Add sourceRefs to the risk or blocker source", "Regenerate the QEG graph"],
    references: ["docs/requirements.md", "docs/spec/gate-policy.md"],
    remediation: "Add sourceRefs to each gate-relevant blocker so the release decision is auditable.",
  },
  "DQ-03": {
    code: "DQ-03",
    title: "Unsupported gate-relevant claim",
    meaning: "A claim that affects the Gate is not backed by source evidence.",
    commonCauses: ["Assumption promoted to fact", "Generated claim lacks sourceRefs"],
    requiredEvidence: ["Source-backed claim", "Non-gate-relevant classification when the claim is advisory only"],
    minimalFix: ["Add sourceRefs for the claim", "Remove or downgrade unsupported gate-relevant claims"],
    references: ["docs/requirements.md"],
    remediation: "Replace gate-relevant unsupported claims with source-backed evidence or mark them non-gate-relevant.",
  },
  "DQ-04": {
    code: "DQ-04",
    title: "P0/P1 oracle gap treated as fact",
    meaning: "A high-priority risk has a large evidence gap without review note or accepted waiver.",
    commonCauses: ["Manual oracle gap is unreviewed", "Waiver was missing or invalid"],
    requiredEvidence: ["Reviewer note", "Accepted waiver", "Manual evidence closing the oracle gap"],
    minimalFix: ["Add reviewerNote to matching manual evidence", "Provide a valid source-backed waiver", "Close the evidence gap"],
    references: ["docs/spec/waiver-approval.md", "docs/spec/evidence-package.md"],
    remediation: "Add reviewer notes or accepted waivers for P0/P1 oracle gaps, or close the evidence gap.",
  },
  "DQ-05": {
    code: "DQ-05",
    title: "Changed code without test obligation",
    meaning: "Changed code is present but QEG cannot find a test placement or accepted waiver.",
    commonCauses: ["placementPlan missing", "All placements blocked", "No valid waiver"],
    requiredEvidence: ["TestPlacementPlan with non-blocked placement", "Accepted waiver tied to changed-code risk"],
    minimalFix: ["Add placement obligations for changed code", "Provide accepted waiver with sourceRefs"],
    references: ["docs/spec/acceptance.md", "docs/project/runbook.md"],
    remediation: "Add test placement obligations for changed code, or provide an accepted waiver.",
  },
  "DQ-06": {
    code: "DQ-06",
    title: "Evidence hash mismatch",
    meaning: "Recorded evidence hash does not match the artifact used for release judgment.",
    commonCauses: ["Artifact regenerated without record update", "Wrong input path", "Silent overwrite"],
    requiredEvidence: ["Matching contentHash", "Artifact revision matching metadata"],
    minimalFix: ["Regenerate evidence package", "Recompute hashes", "Use immutable/versioned storage"],
    references: ["docs/spec/evidence-package.md", "docs/spec/retention-immutability.md"],
    remediation: "Regenerate or relink evidence artifacts so recorded content hashes match actual inputs.",
  },
  "DQ-07": {
    code: "DQ-07",
    title: "Partial graph without completeness score",
    meaning: "The graph is marked partial but does not quantify completeness.",
    commonCauses: ["Partial ingest", "Missing completeness.score"],
    requiredEvidence: ["completeness.score between 0 and 1"],
    minimalFix: ["Set completeness.score", "Complete the graph ingest"],
    references: ["schemas/qeg.bundle.schema.json"],
    remediation: "Record an explicit completeness score when using a partial graph.",
  },
  "DQ-08": {
    code: "DQ-08",
    title: "Manual evidence incomplete",
    meaning: "Manual evidence lacks expected result, oracle refs, traceability, or evidence refs.",
    commonCauses: ["Manual case result copied without oracle", "Missing screenshot/log/reference"],
    requiredEvidence: ["expectedResult", "oracleRefs", "traceTo", "evidenceRefs"],
    minimalFix: ["Complete manualEvidence entries", "Attach source-backed oracle and execution evidence"],
    references: ["docs/spec/evidence-package.md"],
    remediation: "Complete manual evidence with expectedResult, oracleRefs, traceTo, and evidenceRefs.",
  },
  "DQ-09": {
    code: "DQ-09",
    title: "Unredacted sensitive value",
    meaning: "Evidence package appears to contain a secret or sensitive value.",
    commonCauses: ["Token/password/API key in artifact", "Email or private identifier in evidence"],
    requiredEvidence: ["Redacted evidence package", "Regenerated record after redaction"],
    minimalFix: ["Redact sensitive values", "Rotate exposed credentials if needed", "Regenerate QEG record"],
    references: ["docs/requirements.md"],
    remediation: "Redact sensitive values from the evidence package and regenerate the record.",
  },
  "DQ-10": {
    code: "DQ-10",
    title: "Hidden oracle accessed",
    meaning: "Benchmark mode evidence indicates hidden oracle access.",
    commonCauses: ["Candidate used forbidden oracle data", "benchmarkMode set with hiddenOracleAccessed"],
    requiredEvidence: ["Clean benchmark run", "No hidden oracle access flag"],
    minimalFix: ["Remove hidden oracle access", "Rerun benchmark evidence"],
    references: ["docs/requirements.md"],
    remediation: "Remove hidden-oracle access from benchmark-mode runs and regenerate evidence.",
  },
  "DQ-11": {
    code: "DQ-11",
    title: "Required connector contract violation",
    meaning: "A required connector reported contract_violation but the run treated it as success.",
    commonCauses: ["Required adapter output invalid", "Connector status copied as success incorrectly"],
    requiredEvidence: ["Required connector status success", "Contract-compliant adapter artifact"],
    minimalFix: ["Fix connector output", "Mark failed connector honestly and rerun"],
    references: ["docs/requirements.md"],
    remediation: "Fix required connector contract violations before treating connector output as successful.",
  },
  "DQ-12": {
    code: "DQ-12",
    title: "Producer evidence identity mismatch",
    meaning: "Input artifact revision or producer check identity/verdict does not match metadata.headRef and exported readiness.",
    commonCauses: ["Artifact from a different commit", "headRef updated without regenerating evidence", "Producer check attached to a stale SHA", "Producer check conclusion contradicts its readiness artifact"],
    requiredEvidence: ["Artifact revision equal to headRef", "Producer check headSha equal to headRef", "Producer check conclusion consistent with readiness status"],
    minimalFix: ["Regenerate artifacts from current head", "Correct metadata headRef", "Attach producer checks to the PR head SHA", "Align producer check conclusion with readiness status"],
    references: ["docs/spec/evidence-package.md"],
    remediation: "Regenerate artifacts and producer checks from the same headRef, then ensure producer conclusions reflect their readiness status.",
  },
  "DQ-13": {
    code: "DQ-13",
    title: "Evidence package sourceRefs empty",
    meaning: "The evidence package cannot be audited back to its source.",
    commonCauses: ["sourceRefs omitted", "Record generated from detached data"],
    requiredEvidence: ["evidencePackage.sourceRefs with at least one sourceRef"],
    minimalFix: ["Add sourceRefs to evidencePackage", "Regenerate record"],
    references: ["schemas/evidence-package.schema.json"],
    remediation: "Add sourceRefs to the evidence package.",
  },
  "DQ-14": {
    code: "DQ-14",
    title: "Manual oracle or placement-change gap",
    meaning: "Manual-scripted placement, manual retirement, or revert condition lacks required evidence.",
    commonCauses: ["No human-review oracle", "Manual case retired without evidence_refs", "Replacement test degraded without restoration"],
    requiredEvidence: ["Human-review oracle", "placement_changes[].evidence_refs", "source-backed retirement policy", "revert evidence"],
    minimalFix: ["Add manual oracle", "Record placement_change evidence", "Restore manual case or fix replacement tests"],
    references: ["docs/spec/acceptance.md", "docs/spec/gate-policy.md"],
    remediation: "Add source-backed manual oracle or placement-change retirement/revert evidence.",
  },
  "DQ-15": {
    code: "DQ-15",
    title: "Policy, waiver, or approval evidence integrity failure",
    meaning: "IPO controlled release judgment is missing or mismatching governance evidence.",
    commonCauses: [
      "release_decision phase has no approvalEvidence",
      "Gate policy hash differs from evidencePackage.gatePolicy.policyHash",
      "Approval evidence policyHash or evidencePackageHash mismatch",
      "Waiver lacks sourceRefs",
    ],
    requiredEvidence: [
      "evidencePackage.approvalEvidence[] for release_decision",
      "approvalEvidence.policyId matching gate policy",
      "approvalEvidence.policyHash matching gate policy hash",
      "approvalEvidence.evidencePackageHash matching evidence package hash",
      "sourceRefs on waivers and approvals",
    ],
    minimalFix: [
      "Add approvalEvidence for the release decision",
      "Regenerate policy/evidence hashes from the same package",
      "Attach sourceRefs to waiver and approval records",
      "Rerun qeg report to confirm DQ-15 is gone",
    ],
    references: ["docs/spec/waiver-approval.md", "docs/spec/evidence-package.md", "docs/spec/gate-policy.md"],
    remediation: "Provide source-backed waiver, policy hash, and approval evidence that match the evidence package.",
  },
  "DQ-16": {
    code: "DQ-16",
    title: "Release evidence stored only in mutable storage",
    meaning: "Release judgment relies on evidence that can be silently overwritten.",
    commonCauses: ["storageClassification is mutable", "No immutable/versioned retention"],
    requiredEvidence: ["immutable, append_only, or versioned storageClassification", "Tamper evidence"],
    minimalFix: ["Move release evidence to immutable storage", "Update retention metadata"],
    references: ["docs/spec/retention-immutability.md"],
    remediation: "Move release evidence to immutable, append-only, or versioned storage before using it for release judgment.",
  },
  "DQ-17": {
    code: "DQ-17",
    title: "Control roles missing",
    meaning: "IPO controlled profile requires recorded producer/reviewer/approver/waiverApprover/releaseOwner roles.",
    commonCauses: ["evidencePackage.controlRoles omitted", "Role split not recorded"],
    requiredEvidence: ["producer", "reviewer", "approver", "waiverApprover", "releaseOwner"],
    minimalFix: ["Add evidencePackage.controlRoles", "Regenerate evidence record"],
    references: ["docs/spec/evidence-package.md", "docs/ipo-controlled-profile.md"],
    remediation: "Record producer, reviewer, approver, waiverApprover, and releaseOwner control roles.",
  },
};

export function isDisqualificationCode(value: string): value is DisqualificationCode {
  return /^DQ-(0[1-9]|1[0-7])$/.test(value);
}

export function getDqExplanation(code: DisqualificationCode): DqExplanation {
  return DQ_EXPLANATIONS[code];
}

export function allDqExplanations(): DqExplanation[] {
  return Object.values(DQ_EXPLANATIONS);
}

function formatExplanationText(explanation: DqExplanation): string {
  const lines = [
    `${explanation.code}: ${explanation.title}`,
    "",
    "Meaning",
    `- ${explanation.meaning}`,
    "",
    "Common causes",
    ...explanation.commonCauses.map((cause) => `- ${cause}`),
    "",
    "Required evidence",
    ...explanation.requiredEvidence.map((evidence) => `- ${evidence}`),
    "",
    "Minimal fix",
    ...explanation.minimalFix.map((fix) => `- ${fix}`),
    "",
    "References",
    ...explanation.references.map((reference) => `- ${reference}`),
  ];
  return `${lines.join("\n")}\n`;
}

export async function runExplainCommand(args: readonly string[]): Promise<void> {
  const [rawCode, ...rest] = args;
  const json = rest.includes("--json");

  if (!rawCode || !isDisqualificationCode(rawCode)) {
    throw new CliError("Usage: qeg explain <DQ-01..DQ-17> [--json]");
  }

  const explanation = getDqExplanation(rawCode);
  console.log(json ? JSON.stringify(explanation, null, 2) : formatExplanationText(explanation).trimEnd());
  exit(0);
}
