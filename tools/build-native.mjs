import { chmod, copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { buildNative, packagedBinary } from "../bindings/native.mjs";
import { writeNativeNotices } from "./native-notices.mjs";

const binary = buildNative();
await mkdir(dirname(packagedBinary), { recursive: true });
await copyFile(binary, packagedBinary);
await chmod(packagedBinary, 0o755);
writeNativeNotices(packagedBinary);

const modules = {
  "index.js": ["api", "evaluateGate, getExitCode, isGateEligibleTestEvidence, validateGateInput, verifyEvidenceArtifacts, validateOutput, createRecordArtifacts, upstreamInputContract, UPSTREAM_REQUIRED_ARTIFACTS, buildGraph, placeTests, PLACEMENT_LAYERS, readPublishedOutputs, recoverOutputs, publishFiles, planConsumerMigration, applyConsumerMigration, parseProducerArtifact"],
  "gate.js": ["internal", "validateWaiver"],
  "timestamps.js": ["internal", "timestampNanos"],
  "record.js": ["internal", "contentHash, createRecordArtifacts"],
  "output-publication.js": ["api", "publishFiles, readPublishedOutputs, recoverOutputs"],
  "validation/output.js": ["internal", "OUTPUT_SCHEMAS"],
  "cli/evidence-normalize/values.js": ["internal", "normalizeStatus, statusAliases, shellStatus"],
  "cli/fixture-io.js": ["internal", "evaluateFixture"],
  "cli/output-integrity.js": ["internal", "verifyOutputManifest"],
  "cli/record.js": ["internal", "writeOutputRecord"],
  "cli/raw-ingest.js": ["internal", "loadRawArtifacts"],
};
for (const [name, [module, symbols]] of Object.entries(modules)) {
  const path = join("dist", name);
  const source = relative(dirname(path), "bindings/" + module + ".mjs").replaceAll("\\", "/");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "export { " + symbols + " } from " + JSON.stringify(source) + ";\n");
}
await writeFile("dist/index.d.ts", 'export * from "../bindings/index.js";\n');
await writeFile("dist/cli.js", '#!/usr/bin/env node\nimport "../bindings/cli.mjs";\n');
await chmod("dist/cli.js", 0o755);
