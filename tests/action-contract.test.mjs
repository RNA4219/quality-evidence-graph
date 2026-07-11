import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const action = await readFile("qeg-report-action/action.yml", "utf-8");
const ci = await readFile(".github/workflows/ci.yml", "utf-8");
const initSource = await readFile("src/cli/init.ts", "utf-8");

test("external Action is pinned and fail-closed by default", () => {
  assert.match(action, /@quality-harness\/quality-evidence-graph@0\.2\.0/);
  assert.match(action, /enforce:[\s\S]*?default: "true"/);
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

test("self CI is diagnostic-only and matrixed", () => {
  assert.match(ci, /enforce: "false"/);
  assert.match(ci, /node-version: \[20, 24\]/);
});

test("generated integration workflow uses the 0.2.0 enforced Action contract", () => {
  assert.match(initSource, /qeg-report-action@v0\.2\.0/);
  assert.doesNotMatch(initSource, /qeg-report-action@v1/);
});
