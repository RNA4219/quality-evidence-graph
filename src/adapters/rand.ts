import type { AcceptanceCriteriaNode, Priority, RequirementNode, RiskNode } from "../types.js";
import { base, evidenceRef, list, object, required, rows, stableId, strings, text, trace, type RawObject } from "./common.js";
import { decision } from "./decisions.js";
import { emptyResult, type AdapterContext, type AdapterResult } from "./contracts.js";

function priority(value: unknown): Priority { return value === "P0" || value === "P1" || value === "P2" || value === "P3" ? value : "P2"; }

export function normalizeRand({ ref, raw, profile }: AdapterContext): AdapterResult {
  if (ref.contractVersion !== "rand-kano/1.0" || raw.schema_version !== "1.0") throw new Error("RanD requires rand-kano/1.0 and schema_version=1.0");
  const packet = ref.kind === "requirements_packet";
  if (!packet && ref.kind !== "requirements_audit_packet") throw new Error(`Unsupported RanD artifact ${ref.kind}`);
  required(raw, ["schema_version", "requirements", "assumptions", packet ? "packet_id" : "document_id"]);
  if (packet) required(raw, ["derived_from", "qeg_policy_hash_ref", "product_context", "release_readiness_prelude"]);
  if (!packet) required(raw, ["gate_summary", "source_refs"]);
  const result = emptyResult();
  for (const requirement of rows(raw.requirements, "requirements")) {
    const local = text(requirement.requirement_id, "requirement_id");
    const title = text(requirement.title ?? requirement.statement ?? requirement.original_text, "requirement text");
    required(requirement, packet ? ["confidence", "acceptance_criteria", "risks"] : ["confidence", "gate_verdict", "testability", "implementation_alignment"]);
    const node: RequirementNode = { ...base(ref, "requirement", local, title, requirement), kind: "requirement", priority: priority(requirement.priority), acceptanceCriteriaIds: [] };
    const acceptanceIds: string[] = [];
    if (packet) for (const value of list(requirement.acceptance_criteria, "acceptance_criteria")) {
      const item = typeof value === "string" ? { text: value } : object(value, "acceptance criterion");
      const title = text(item.text ?? item.description ?? item.criterion ?? item.title, "acceptance criterion text");
      const ac: AcceptanceCriteriaNode = { ...base(ref, "acceptance_criteria", `${local}/${String(item.id ?? title)}`, title, requirement), kind: "acceptance_criteria",
        requirementIds: [node.id], oracleRefs: [evidenceRef(ref, `${local}/acceptance_criteria/${String(item.id ?? title)}`)] };
      acceptanceIds.push(ac.id); result.nodes.push(ac);
      result.edges.push({ id: stableId("rand", "edge", `${node.id}/satisfies/${ac.id}`), kind: "satisfies", from: node.id, to: ac.id, traceability: ac.traceability });
    }
    result.nodes.push({ ...node, acceptanceCriteriaIds: acceptanceIds,
      traceability: { ...node.traceability, assumptions: [...node.traceability.assumptions, ...strings(raw.assumptions)] } });
    if (packet) for (const value of list(requirement.risks, "risks")) {
      const item: RawObject = typeof value === "string" ? { title: value } : object(value, "risk");
      const title = text(item.title ?? item.description ?? item.risk, "risk text");
      const risk: RiskNode = { ...base(ref, "risk", `${local}/risk/${String(item.id ?? title)}`, title, requirement), kind: "risk", priority: node.priority ?? "P2",
        severity: "medium", likelihood: 0.5, businessImpact: 0.5, complianceCriticality: 0, evidenceGap: 1, novelty: 0.5 };
      result.nodes.push(risk);
      result.edges.push({ id: stableId("rand", "edge", `${node.id}/risks/${risk.id}`), kind: "risks", from: node.id, to: risk.id, traceability: risk.traceability });
    }
    if (!packet) {
      result.nodes.push(decision(ref, `audit/${local}`, requirement.gate_verdict, profile, requirement));
      if (requirement.testability === "blocked") result.unsupportedClaims.push({ id: stableId("rand", "oracle-gap", local),
        claim: `${title}: audit testability is blocked`, nodeIds: [node.id], gateRelevant: true });
    }
  }
  // packet内のpolicy proposalはraw artifactとhashに残す。QEG policyは変更しない。
  if (result.nodes.length === 0) result.parserFailures.push({ path: ref.path, reason: "RanD requirements are empty", sourceRefs: trace(ref, "/requirements").sourceRefs });
  return result;
}
