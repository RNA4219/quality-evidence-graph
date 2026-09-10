import { lstat, readFile } from "fs/promises";
import { join } from "path";
import type { GatePolicy, QegGateInput } from "./types.js";
import { contentHash, jsonDocument } from "./record.js";
import { evaluateGate } from "./gate.js";
import { validateGateInput } from "./validation/schema.js";
import { validateOutput } from "./validation/output.js";
import { verifyEvidenceArtifacts } from "./validation/evidence.js";
import { hasCommittedFile, publishFilesUnderLease, withOutputLease } from "./output-publication.js";
import { CliError } from "./cli/errors.js";

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
  readonly changes: readonly { path: string; before: unknown; after: unknown }[];
  readonly gate?: { verdict: string; disqualifications: readonly string[] };
  readonly notes: readonly string[];
}
const canonical = (value: unknown): string => JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);

async function plan(directory: string, config?: ConsumerMigrationConfig, savedOriginal?: string): Promise<{ report: ConsumerMigrationReport; original: string; candidate?: string }> {
  const path = join(directory, "gate-input.json");
  if (!(await lstat(path)).isFile()) throw new CliError("Migration input must be a regular gate-input.json file");
  const original = savedOriginal ?? await readFile(path, "utf8");
  const input = JSON.parse(original) as QegGateInput;
  const inputHash = contentHash(original);
  const missingInputs: string[] = [];
  const notes = ["Dry-run never writes. Graph, execution history, waivers, approval evidence and retention records are preserved.",
    "A policy change can require fresh approval; migration does not grant release approval or fabricate execution evidence."];
  if (!config) {
    missingInputs.push("Explicit configuration: migrationVersion, expectedInputHash, complete policy including inputContract");
    if (!input.policy?.inputContract) missingInputs.push("policy.inputContract: mode, requiredArtifacts, evaluationScope, requireExecutedTests, sourceRefs");
    if (!input.policy?.executionPolicy) missingInputs.push("policy.executionPolicy: target (project/build/revision/environment), maxEvidenceAgeHours, buildBindingRef, sourceRefs when execution is required");
    return { original, report: { migrationVersion: "qeg-consumer-migration/v1", status: "needs_configuration", inputHash, missingInputs, changes: [], notes } };
  }
  const validation = await validateOutput(config, "consumer-migration.schema.json");
  if (!validation.valid) missingInputs.push(...validation.issues.map(issue => `${issue.path} ${issue.message}`));
  if (!config.policy?.inputContract) missingInputs.push("Explicit policy.inputContract is required");
  if (config.policy?.inputContract?.requireExecutedTests && !config.policy.executionPolicy) missingInputs.push("Explicit policy.executionPolicy is required for executed tests");
  if (config.policy?.profile !== input.policy?.profile) missingInputs.push("Migration cannot change the existing profile");
  for (const key of ["dqScope", "exitCodePolicy", "reliabilityPolicy", "placementRetirementPolicy"] as const) {
    if (canonical(config.policy?.[key]) !== canonical(input.policy?.[key])) missingInputs.push(`Migration must preserve policy.${key}`);
  }
  const changes = Object.keys({ ...input.policy, ...config.policy }).sort()
    .filter(key => canonical((input.policy as unknown as Record<string, unknown>)?.[key]) !== canonical((config.policy as unknown as Record<string, unknown>)?.[key]))
    .map(key => ({ path: `/policy/${key}`, before: (input.policy as unknown as Record<string, unknown>)?.[key] ?? null, after: (config.policy as unknown as Record<string, unknown>)?.[key] ?? null }));
  const metadata = (value: QegGateInput["metadata"]) => ({ ...value, policyId: config.policy?.policyId, policyHash: config.policy?.policyHash });
  const candidateInput = { ...input, policy: config.policy, metadata: metadata(input.metadata), graph: { ...input.graph, metadata: metadata(input.graph.metadata) },
    ...(input.placementPlan ? { placementPlan: { ...input.placementPlan, metadata: metadata(input.placementPlan.metadata) } } : {}) };
  for (const [path, before, after] of [["/metadata", input.metadata, candidateInput.metadata], ["/graph/metadata", input.graph.metadata, candidateInput.graph.metadata],
    ["/placementPlan/metadata", input.placementPlan?.metadata, candidateInput.placementPlan?.metadata]] as const) {
    if (canonical(before) !== canonical(after)) changes.push({ path, before: before ?? null, after: after ?? null });
  }
  const schema = await validateGateInput(candidateInput);
  if (!schema.valid) missingInputs.push(...schema.issues.map(issue => `${issue.path} ${issue.message}`));
  if (changes.length && inputHash !== config.expectedInputHash) missingInputs.push("expectedInputHash mismatch: consumer changed since review");
  if (changes.length && input.policy?.policyHash === config.policy?.policyHash) missingInputs.push("Changed policy requires an explicit new policyHash; existing approvals remain attached to their original policy");
  const candidate = changes.length ? jsonDocument(candidateInput) : original;
  let gate: ConsumerMigrationReport["gate"];
  if (!missingInputs.length) {
    const evidenceVerification = await verifyEvidenceArtifacts(candidateInput, { baseDir: directory });
    const result = evaluateGate({ ...candidateInput, waivers: candidateInput.waivers ?? [], evidenceVerification,
      preflightDisqualifications: evidenceVerification.items.filter(item => item.severity === "fail").map(item => ({ code: "DQ-06" as const, nodeIds: [],
        message: item.message, sourceRefs: [{ id: item.artifactId, path: item.path ?? "gate-input.json" }] })) });
    gate = { verdict: result.verdict, disqualifications: result.disqualifications.map(item => item.code) };
    if (!config.policy.inputContract?.requireExecutedTests) notes.push("Planning-only scope: executed-test acceptance has not been granted.");
  }
  return { original, candidate, report: { migrationVersion: "qeg-consumer-migration/v1", status: missingInputs.length ? "blocked" : changes.length ? "ready" : "unchanged",
    inputHash, outputHash: contentHash(candidate), missingInputs, changes, gate, notes } };
}

/** Inspect a consumer using explicit configuration. No directory, receipt or backup is created. */
export async function planConsumerMigration(directory: string, config?: ConsumerMigrationConfig): Promise<ConsumerMigrationReport> {
  return (await plan(directory, config)).report;
}

export async function applyConsumerMigration(directory: string, config: ConsumerMigrationConfig): Promise<ConsumerMigrationReport> {
  return withOutputLease(directory, async root => {
    let result = await plan(root, config);
    if (result.report.status === "unchanged") {
      let receipt: string | undefined;
      try { receipt = await readFile(join(root, "migration-report.json"), "utf8"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (!receipt) return result.report;
      const previous = JSON.parse(receipt) as ConsumerMigrationReport;
      if (previous.inputHash !== config.expectedInputHash || previous.outputHash !== result.report.inputHash || await hasCommittedFile(root, "migration-report.json", receipt)) return result.report;
      const original = await readFile(join(root, "migration-original.json"), "utf8");
      if (contentHash(original) !== config.expectedInputHash) throw new CliError("Interrupted migration backup hash mismatch");
      result = await plan(root, config, original); // Finish an interrupted first publication, without inventing history.
    }
    if (result.report.status !== "ready" || !result.candidate) throw new CliError(`Migration blocked: ${result.report.missingInputs.join("; ")}`);
    const report: ConsumerMigrationReport = { ...result.report, status: "applied" };
    await publishFilesUnderLease(root, new Map([["migration-original.json", result.original], ["migration-report.json", jsonDocument(report)], ["gate-input.json", result.candidate]]));
    return report;
  });
}
