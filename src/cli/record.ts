import type { EvaluatedFixture } from "./fixture-io.js";
import { createRecordArtifacts } from "../record.js";
import { assertValidOutput, OUTPUT_SCHEMAS } from "../validation/output.js";
import { publishFiles } from "./output-files.js";

export async function writeOutputRecord(evaluated: EvaluatedFixture): Promise<void> {
  const { files } = createRecordArtifacts(evaluated);
  for (const [path, content] of files) {
    const schema = OUTPUT_SCHEMAS[path];
    if (schema) await assertValidOutput(JSON.parse(content), schema);
  }
  await publishFiles(evaluated.fixtureDir, files);
  console.log("Own-output validation: PASS (all generated JSON artifacts passed their schemas)");
  console.log(`Record written to: ${evaluated.fixtureDir}/quality-evidence-record.json`);
}
