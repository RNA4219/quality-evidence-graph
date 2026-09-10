import type { IngestManifest, LoadedArtifact, QegNode, QualityEvidenceGraph, QegEdge, ParserFailure, UnsupportedClaim } from "./types.js";
import { assertNoDirectPolicy, object, source, stableId } from "./adapters/common.js";
import { normalizeRand } from "./adapters/rand.js";
import { normalizeCodeToGate } from "./adapters/code-to-gate.js";
import { normalizeManualBb } from "./adapters/manual-bb.js";
import { UPSTREAM_REQUIRED_ARTIFACTS, artifactKey } from "./input-contract.js";
import { enrichTestCoverage } from "./graph/coverage.js";
import { validateProducerPayload } from "./adapters/validate.js";
import { requirementEdges } from "./graph/requirements.js";

const sortIds = <T extends { id: string }>(items: readonly T[]): T[] => [...items].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
function mergeRequirement(a: QegNode, b: QegNode): QegNode | undefined {
  if (a.kind !== "requirement" || b.kind !== "requirement") return undefined;
  // Packet/audit can describe the same requirement. Keep the packet's acceptance contract.
  const primary = a.acceptanceCriteriaIds.length > 0 ? a : b;
  return { ...primary, acceptanceCriteriaIds: [...new Set([...a.acceptanceCriteriaIds, ...b.acceptanceCriteriaIds])].sort(),
    sourceArtifactIds: [...new Set([...a.sourceArtifactIds, ...b.sourceArtifactIds])].sort(),
    traceability: { ...primary.traceability, sourceRefs: sortIds([...new Map([...a.traceability.sourceRefs, ...b.traceability.sourceRefs].map(r => [r.id, r])).values()]),
      assumptions: [...new Set([...a.traceability.assumptions, ...b.traceability.assumptions])].sort() } };
}

/** Deterministic, side-effect-free normalization. Byte/hash verification belongs to the loader. */
export function buildGraph(manifest: IngestManifest, loaded: readonly LoadedArtifact[]): QualityEvidenceGraph {
  const nodes = new Map<string, QegNode>();
  const edges = new Map<string, QegEdge>();
  const parserFailures: ParserFailure[] = [];
  const unsupportedClaims: UnsupportedClaim[] = [];
  const artifacts = [...manifest.artifacts].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : a.id < b.id ? -1 : 1);
  // Payloads may have been loaded before a descriptor was edited. The manifest owns all bindings.
  const boundLoaded: LoadedArtifact[] = loaded.flatMap(item => {
    const ref = artifacts.find(candidate => candidate.id === item.ref.id && candidate.path === item.ref.path);
    return ref ? [{ ...item, ref }] : [];
  });
  const statuses: Record<string, "success" | "contract_violation"> = {};
  const knownChanges = new Map<string, string>();
  for (const item of boundLoaded) {
    if (item.failure || item.ref.adapter !== "code-to-gate" || item.ref.kind !== "diff_analysis") continue;
    const raw = item.payload as { changed_files?: { path?: unknown }[] } | null;
    if (Array.isArray(raw?.changed_files)) for (const file of raw.changed_files) if (typeof file?.path === "string") {
      const path = file.path.replaceAll("\\", "/").replace(/^\.\//, ""); knownChanges.set(path, stableId("ctg", "changed_code", path));
    }
  }
  const seenArtifactIds = new Set<string>();
  for (const ref of artifacts) {
    statuses[ref.adapter] ??= "success";
    try {
      if (seenArtifactIds.has(ref.id)) throw new Error(`Duplicate artifact ID ${ref.id}`);
      seenArtifactIds.add(ref.id);
      const matches = boundLoaded.filter(item => item.ref.id === ref.id && item.ref.path === ref.path);
      if (matches.length !== 1) throw new Error(`Expected one loaded payload for ${ref.id}`);
      const item = matches[0];
      if (item.failure) {
        parserFailures.push({ code: item.failure.code, path: ref.path, reason: item.failure.message, sourceRefs: [source(ref, "/")] });
        statuses[ref.adapter] = "contract_violation"; continue;
      }
      const raw = object(item.payload, ref.path);
      assertNoDirectPolicy(raw);
      validateProducerPayload(ref, raw);
      if (ref.adapter === "code-to-gate") {
        const repo = object(raw.repo, "repo");
        if (repo.dirty === true || repo.revision && repo.revision !== manifest.metadata.headRef &&
          !(typeof repo.revision === "string" && /^[a-f0-9]{12,64}$/.test(repo.revision) && ref.reportedRevision === repo.revision && manifest.metadata.headRef?.startsWith(repo.revision))) {
          parserFailures.push({ code: "DQ-12", path: ref.path, reason: "CTG reported revision requires explicit canonical binding and clean source", sourceRefs: [source(ref, "/repo/revision")] });
        }
        if ((repo.head_ref && repo.head_ref !== manifest.metadata.headRef) ||
          (repo.base_ref && manifest.metadata.baseRef && repo.base_ref !== manifest.metadata.baseRef)) {
          parserFailures.push({ code: "DQ-12", path: ref.path, reason: "CTG raw repo revision differs from manifest metadata", sourceRefs: [source(ref, "/repo")] });
          statuses[ref.adapter] = "contract_violation"; continue;
        }
      }
      const context = { ref, raw, profile: manifest.metadata.profile, knownChanges, executionPolicy: manifest.policy.executionPolicy };
      const result = ref.adapter === "RanD" ? normalizeRand(context) : ref.adapter === "code-to-gate" ? normalizeCodeToGate(context)
        : ref.adapter === "manual-bb-test-harness" ? normalizeManualBb(context) : undefined;
      if (!result) throw new Error(`Raw adapter unavailable: ${ref.adapter}/${ref.kind}`);
      parserFailures.push(...result.parserFailures); unsupportedClaims.push(...result.unsupportedClaims);
      if (result.parserFailures.length) statuses[ref.adapter] = "contract_violation";
      for (const node of result.nodes) {
        const previous = nodes.get(node.id);
        if (!previous) nodes.set(node.id, node);
        else {
          const oppositeKind = ref.kind === "requirements_packet" ? "requirements_audit_packet" : ref.kind === "requirements_audit_packet" ? "requirements_packet" : undefined;
          const pair = oppositeKind && previous.sourceArtifactIds.length === 1 && artifacts.find(a => a.id === previous.sourceArtifactIds[0])?.kind === oppositeKind;
          const merged = ref.adapter === "RanD" && pair ? mergeRequirement(previous, node) : undefined;
          if (merged) nodes.set(node.id, merged);
          else unsupportedClaims.push({ id: `qeg:duplicate-node:${encodeURIComponent(node.id)}`, claim: `Duplicate node ID ${node.id}`, nodeIds: [node.id], gateRelevant: true });
        }
      }
      for (const edge of result.edges) {
        const previous = edges.get(edge.id);
        if (!previous) edges.set(edge.id, edge);
        else if (previous.from !== edge.from || previous.to !== edge.to || previous.kind !== edge.kind) throw new Error(`Conflicting edge ${edge.id}`);
        else edges.set(edge.id, { ...previous, traceability: { ...previous.traceability, sourceRefs: sortIds([...new Map([...previous.traceability.sourceRefs, ...edge.traceability.sourceRefs].map(s => [s.id, s])).values()]) } });
      }
    } catch (error) {
      statuses[ref.adapter] = "contract_violation";
      parserFailures.push({ code: "DQ-01", path: ref.path, reason: error instanceof Error ? error.message : String(error), sourceRefs: [source(ref, "/")] });
    }
  }
  const required = manifest.policy.inputContract?.mode === "upstream_artifacts" ? UPSTREAM_REQUIRED_ARTIFACTS : manifest.policy.inputContract?.requiredArtifacts ?? [];
  const keys = new Set(artifacts.map(artifactKey));
  for (const ref of required) if (!keys.has(artifactKey(ref))) {
    statuses[ref.adapter] = "contract_violation";
    parserFailures.push({ code: "DQ-01", path: "ingest-manifest.json", reason: `Missing required artifact ${artifactKey(ref)}`,
      sourceRefs: [{ id: `qeg:missing:${artifactKey(ref)}`, path: "ingest-manifest.json", label: "/artifacts" }] });
  }
  const validEdges: QegEdge[] = [];
  try {
    for (const ref of artifacts) if (ref.sourceRefMappings && (ref.adapter !== "manual-bb-test-harness" || ref.kind !== "feature_spec")) throw new Error("sourceRefMappings require a manual-bb feature_spec");
    for (const edge of requirementEdges([...nodes.values()], boundLoaded)) edges.set(edge.id, edge);
  } catch (error) { parserFailures.push({ code: "DQ-01", path: "ingest-manifest.json", reason: String(error), sourceRefs: [{ id: "qeg:source-mapping", path: "ingest-manifest.json" }] }); }
  for (const edge of edges.values()) {
    if (nodes.has(edge.from) && nodes.has(edge.to)) validEdges.push(edge);
    else unsupportedClaims.push({ id: `qeg:unresolved:${encodeURIComponent(edge.id)}`, claim: `Unresolved edge ${edge.from} -> ${edge.to}`,
      nodeIds: [edge.from, edge.to], gateRelevant: true });
  }
  const metadata = { ...manifest.metadata, inputArtifacts: artifacts.map(({ contractVersion: _version, executionContext: _context, reportedRevision: _reported, sourceRefMappings: _mappings, ...ref }) => ref), requiredConnectorStatus: statuses };
  const partial = parserFailures.length > 0 || unsupportedClaims.some(c => c.gateRelevant);
  return { metadata, nodes: enrichTestCoverage(sortIds([...nodes.values()]), sortIds(validEdges)), edges: sortIds(validEdges),
    completeness: { score: partial ? 0 : 1, partial, parserFailures, unsupportedClaims: sortIds(unsupportedClaims) } };
}
