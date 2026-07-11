import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const cli = resolve("dist/cli.js");
const manifest = JSON.parse(await readFile("fixtures/manifest.json", "utf-8"));
assert.ok(manifest.fixtures.length > 0, "fixture manifest must not be empty");
assert.equal(new Set(manifest.fixtures.map((item) => item.name)).size, manifest.fixtures.length, "fixture names must be unique");
for (const fixture of manifest.fixtures) {
  assert.match(fixture.classification, /^(positive|negative)$/);
  assert.match(fixture.expected.verdict, /^(go|conditional_go|no_go|disqualified|cli_error)$/);
  assert.ok([0, 1, 2].includes(fixture.expected.exitCode));
  if (fixture.classification === "negative" && fixture.expected.exitCode !== 1) {
    assert.match(fixture.expected.primaryDq, /^DQ-\d{2}$/);
  }
  const target = `fixtures/${fixture.name}`;
  const args = fixture.expected.exitCode === 1 ? ["gate", target] : ["validate", target];
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf-8" });
  const expectedProcessExit = fixture.expected.exitCode === 1 ? 1 : 0;
  assert.equal(result.status, expectedProcessExit, `${fixture.name}\n${result.stdout}\n${result.stderr}`);
}
const snapshots = spawnSync(process.execPath, [cli, "snapshot", "fixtures"], { encoding: "utf-8" });
assert.equal(snapshots.status, 0, `${snapshots.stdout}\n${snapshots.stderr}`);
console.log(`Validated ${manifest.fixtures.length} fixture contracts and snapshots`);
