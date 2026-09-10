import { buildGraph } from "../graph.js";
import { placeTests } from "../placement.js";
import { jsonDocument } from "../record.js";
import { assertValidOutput } from "../validation/output.js";
import { validateGateInput } from "../validation/schema.js";
import { loadRawArtifacts } from "./raw-ingest.js";
import { publishFiles } from "./output-files.js";
import { withOutputLease } from "../output-publication.js";
import { readFixtureInput } from "./fixture-io.js";
import { CliError } from "./errors.js";
import type { QegGateInput } from "../types.js";

async function validateInput(input: QegGateInput): Promise<void> {
  const validation = await validateGateInput(input);
  if (!validation.valid) throw new CliError(`Generated gate input invalid: ${validation.issues.map(i => `${i.path} ${i.message}`).join("; ")}`);
}
export async function runBuildGraphCommand(directory: string): Promise<void> {
  return withOutputLease(directory, runBuildGraphUnderLease);
}
async function runBuildGraphUnderLease(directory: string): Promise<void> {
  const { manifest, loaded } = await loadRawArtifacts(directory);
  const graph = buildGraph(manifest, loaded);
  const input: QegGateInput = { metadata: graph.metadata, graph, policy: manifest.policy, waivers: manifest.waivers ?? [],
    ...(manifest.evidencePackage ? { evidencePackage: manifest.evidencePackage } : {}) };
  await assertValidOutput(graph, "qeg.bundle.schema.json");
  await validateInput(input);
  await publishFiles(directory, new Map([["qeg.bundle.json", jsonDocument(graph)], ["gate-input.json", jsonDocument(input)]]));
  console.log(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges; partial=${graph.completeness.partial}. Test placement and Gate evaluation remain required.`);
  process.exitCode = graph.completeness.partial ? 2 : 0;
}
export async function runPlaceTestsCommand(directory: string): Promise<void> {
  return withOutputLease(directory, runPlaceTestsUnderLease);
}
async function runPlaceTestsUnderLease(directory: string): Promise<void> {
  const input = await readFixtureInput(directory);
  const placementPlan = placeTests(input.graph, input.policy);
  const updated = { ...input, placementPlan };
  await assertValidOutput(placementPlan, "test-placement-plan.schema.json");
  await validateInput(updated);
  await publishFiles(directory, new Map([["test-placement-plan.json", jsonDocument(placementPlan)], ["gate-input.json", jsonDocument(updated)]]));
  console.log(`Plan: ${placementPlan.obligations.length} obligations, ${placementPlan.placements.filter(p => p.disposition === "blocked").length} blocked. This is a plan, not execution evidence.`);
  process.exitCode = input.graph.completeness.partial || placementPlan.placements.some(p => p.disposition === "blocked") ? 2 : 0;
}
