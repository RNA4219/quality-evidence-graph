import assert from "node:assert/strict";
import { cp, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const cli = resolve("dist/cli.js");
const manifest = JSON.parse(await readFile("fixtures/manifest.json", "utf-8"));

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf-8",
    ...options,
  });
}

function parseJson(label, value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(label + " is not JSON: " + error + "\n" + value);
  }
}

function commandExit(fixture, command, fallback) {
  return fixture.expected.commandExitCodes?.[command] ?? fallback;
}

function isReliabilityFixture(name) {
  return name.includes("resilience") ||
    name.includes("reliability") ||
    name === "positive-legacy-compatible";
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function assertSourceRefs(items, fixtureName, kind) {
  for (const item of items) {
    assert.ok(
      Array.isArray(item.sourceRefs) && item.sourceRefs.length > 0,
      fixtureName + " " + kind + " " + (item.code ?? item.id) + " lacks sourceRefs",
    );
  }
}

assert.ok(manifest.fixtures.length > 0, "fixture manifest must not be empty");
assert.equal(
  new Set(manifest.fixtures.map((item) => item.name)).size,
  manifest.fixtures.length,
  "fixture names must be unique",
);

let reliabilityCount = 0;
for (const fixture of manifest.fixtures) {
  assert.match(fixture.classification, /^(positive|negative)$/);
  assert.match(
    fixture.expected.verdict,
    /^(go|conditional_go|no_go|disqualified|cli_error)$/,
  );
  assert.ok([0, 1, 2].includes(fixture.expected.exitCode));
  if (
    fixture.classification === "negative" &&
    fixture.expected.exitCode !== 1
  ) {
    assert.ok(
      /^DQ-\d{2}$/.test(fixture.expected.primaryDq ?? "") ||
        typeof fixture.expected.primaryBlocker === "string",
      fixture.name + " must declare primaryDq or primaryBlocker",
    );
  }

  const target = "fixtures/" + fixture.name;
  const initialArgs =
    fixture.expected.exitCode === 1
      ? ["gate", target]
      : ["validate", target];
  const initial = run(initialArgs);
  const expectedInitialExit = fixture.expected.exitCode === 1 ? 1 : 0;
  assert.equal(
    initial.status,
    expectedInitialExit,
    fixture.name + "\n" + initial.stdout + "\n" + initial.stderr,
  );

  if (fixture.expected.exitCode === 1) continue;
  const gate = run(["gate", target]);
  assert.equal(
    gate.status,
    commandExit(fixture, "gate", fixture.expected.exitCode),
    fixture.name + " gate\n" + gate.stdout + "\n" + gate.stderr,
  );
  const gateJson = parseJson(fixture.name + " gate", gate.stdout);
  assert.equal(gateJson.verdict, fixture.expected.verdict);

  if (!isReliabilityFixture(fixture.name)) continue;
  reliabilityCount += 1;

  if (fixture.expected.primaryDq) {
    assert.equal(
      gateJson.disqualifications[0]?.code,
      fixture.expected.primaryDq,
      fixture.name + " primaryDq must match stable first DQ",
    );
  }
  if (fixture.expected.primaryBlocker) {
    assert.equal(
      gateJson.blockers[0]?.id,
      fixture.expected.primaryBlocker,
      fixture.name + " primaryBlocker must match stable first blocker",
    );
  }
  assert.deepEqual(
    uniqueSorted(
      gateJson.blockers
        .map((blocker) => blocker.ruleId)
        .filter((ruleId) => typeof ruleId === "string"),
    ),
    [...(fixture.expected.blockerRuleIds ?? [])].sort(),
    fixture.name + " blocker rule set",
  );
  assertSourceRefs(gateJson.disqualifications, fixture.name, "DQ");
  assertSourceRefs(gateJson.blockers, fixture.name, "blocker");

  const reportJsonResult = run(["report", "--json", target]);
  assert.equal(
    reportJsonResult.status,
    commandExit(fixture, "report", 0),
    fixture.name + " JSON report\n" +
      reportJsonResult.stdout + "\n" + reportJsonResult.stderr,
  );
  const reportJson = parseJson(fixture.name + " report", reportJsonResult.stdout);
  assert.equal(reportJson.targets.length, 1);
  const reportTarget = reportJson.targets[0];
  assert.equal(reportTarget.verdict, gateJson.verdict);
  assert.deepEqual(reportTarget.disqualifications, gateJson.disqualifications);
  assert.deepEqual(reportTarget.blockers, gateJson.blockers);
  assert.deepEqual(reportTarget.reliability, gateJson.reliability);

  const reportText = run(["report", target]);
  assert.equal(
    reportText.status,
    commandExit(fixture, "report", 0),
    fixture.name + " text report\n" + reportText.stdout + "\n" + reportText.stderr,
  );
  assert.match(reportText.stdout, /Reliability/);
  for (const code of uniqueSorted(
    gateJson.disqualifications.map((item) => item.code),
  )) {
    assert.match(reportText.stdout, new RegExp(code));
  }
  for (const blocker of gateJson.blockers) {
    assert.ok(
      reportText.stdout.includes(blocker.id),
      fixture.name + " text report omits blocker " + blocker.id,
    );
  }

  const evidence = run(["evidence", "verify", target]);
  assert.equal(
    evidence.status,
    commandExit(fixture, "evidenceVerify", 0),
    fixture.name + " evidence verify\n" + evidence.stdout + "\n" + evidence.stderr,
  );
  const policy = run(["policy", "lint", target]);
  assert.equal(
    policy.status,
    commandExit(fixture, "policyLint", 0),
    fixture.name + " policy lint\n" + policy.stdout + "\n" + policy.stderr,
  );
  const snapshot = run(["snapshot", target]);
  assert.equal(
    snapshot.status,
    commandExit(fixture, "snapshot", 0),
    fixture.name + " snapshot\n" + snapshot.stdout + "\n" + snapshot.stderr,
  );

  const tempRoot = await mkdtemp(join(tmpdir(), "qeg-fixture-record-"));
  const copiedTarget = join(tempRoot, fixture.name);
  await cp(target, copiedTarget, { recursive: true });
  const record = run(["record", copiedTarget]);
  assert.equal(
    record.status,
    commandExit(fixture, "record", fixture.expected.exitCode),
    fixture.name + " record\n" + record.stdout + "\n" + record.stderr,
  );
  const actualRecord = parseJson(
    fixture.name + " generated output-record",
    await readFile(join(copiedTarget, "output-record.json"), "utf-8"),
  );
  const expectedRecord = parseJson(
    fixture.name + " expected output-record",
    await readFile(join(target, "output-record.json"), "utf-8"),
  );
  assert.deepEqual(actualRecord, expectedRecord, fixture.name + " output record");
  assert.deepEqual(actualRecord.gate.reliability, gateJson.reliability);
  assert.deepEqual(actualRecord.gate.disqualifications, gateJson.disqualifications);
  assert.deepEqual(actualRecord.gate.blockers, gateJson.blockers);

  const expectedReport = parseJson(
    fixture.name + " expected report",
    await readFile(join(target, "expected-report.json"), "utf-8"),
  );
  assert.equal(expectedReport.reportVersion, "qeg-ci-report-v2");
  assert.equal(expectedReport.targets.length, 1);
  assert.deepEqual(
    expectedReport.targets[0].reliability,
    gateJson.reliability,
    fixture.name + " snapshot reliability",
  );
  assert.deepEqual(
    expectedReport.targets[0].disqualifications,
    gateJson.disqualifications,
    fixture.name + " snapshot disqualifications",
  );
  assert.deepEqual(
    expectedReport.targets[0].blockers,
    gateJson.blockers,
    fixture.name + " snapshot blockers",
  );
}

assert.equal(reliabilityCount, 22, "the hardening matrix must contain 22 reliability fixtures");
const snapshots = run(["snapshot", "fixtures"]);
assert.equal(snapshots.status, 0, snapshots.stdout + "\n" + snapshots.stderr);
console.log(
  "Validated " + manifest.fixtures.length +
    " fixture contracts, including " + reliabilityCount +
    " reliability end-to-end fixtures",
);
