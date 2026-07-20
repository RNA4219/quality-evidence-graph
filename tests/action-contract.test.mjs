import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const action = await readFile("qeg-report-action/action.yml", "utf-8");
const ci = await readFile(".github/workflows/ci.yml", "utf-8");
const initSource = await readFile("src/cli/init.ts", "utf-8");
const actionBundlePath = resolve("qeg-report-action", "dist", "cli.mjs");

test("external Action uses its tagged CLI bundle and is fail-closed by default", () => {
  assert.match(action, /QEG_ACTION_CLI: \$\{\{ github\.action_path \}\}\/dist\/cli\.mjs/);
  assert.match(action, /report-command:[\s\S]*?default: ""/);
  assert.doesNotMatch(action, /@quality-harness\/quality-evidence-graph@/);
  assert.match(action, /enforce:[\s\S]*?default: "true"/);
});

test("tagged Action bundle exposes the release CLI version", () => {
  const version = spawnSync(process.execPath, [actionBundlePath, "--version"], {
    encoding: "utf8",
  });
  assert.equal(version.status, 0, version.stderr || version.stdout);
  assert.equal(version.stdout.trim(), "0.3.1");
});

test("Action uploads diagnostics before enforcing the verdict", () => {
  const upload = action.indexOf("Upload QEG report artifact");
  const enforce = action.indexOf("Enforce QEG verdict");
  assert.ok(upload >= 0 && enforce > upload);
});

test("optional preflight failures become report errors", () => {
  assert.match(action, /ACTION_PREFLIGHT_FAILED/);
  assert.match(action, /report_exit=1/);
});

test("self CI exercises the bundled Action in the Node matrix", () => {
  assert.match(ci, /enforce: "false"/);
  assert.match(ci, /node-version: \[20, 24\]/);
  assert.doesNotMatch(ci, /report-command: node dist\/cli\.js/);
  assert.match(ci, /Release lifecycle acceptance/);
});

test("generated integration workflow uses the 0.3.1 enforced Action contract", () => {
  assert.match(initSource, /qeg-report-action@v0\.3\.1/);
  assert.doesNotMatch(initSource, /qeg-report-action@v1/);
});