import { mkdir, stat, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { exit } from "process";
import { CliError } from "./errors.js";

export interface InitOptions {
  readonly root: string;
  readonly force: boolean;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function minimalGateInput(): string {
  const now = new Date().toISOString();
  return `${JSON.stringify({
    metadata: {
      qegVersion: "0.2",
      runId: "qeg:run-local-init",
      createdAt: now,
      profile: "standard",
      inputArtifacts: [],
    },
    graph: {
      metadata: {
        qegVersion: "0.2",
        runId: "qeg:run-local-init",
        createdAt: now,
        profile: "standard",
        inputArtifacts: [],
      },
      nodes: [],
      edges: [],
      completeness: {
        score: 1,
        partial: false,
        parserFailures: [],
        unsupportedClaims: [],
      },
    },
    policy: {
      policyId: "qeg:policy-local-init",
      policyHash: "sha256:replace-me",
      profile: "standard",
      effectiveDate: now,
      approver: "replace-me",
      sourceRefs: [
        {
          id: "qeg:sr-policy-local-init",
          path: "docs/policy.md",
        },
      ],
      dqScope: [
        "DQ-01",
        "DQ-02",
        "DQ-03",
        "DQ-04",
        "DQ-05",
        "DQ-06",
        "DQ-07",
        "DQ-08",
        "DQ-09",
        "DQ-10",
        "DQ-11",
        "DQ-12",
        "DQ-13",
        "DQ-14",
        "DQ-15",
        "DQ-16",
        "DQ-17",
        "DQ-18",
        "DQ-19",
        "DQ-20",
        "DQ-21",
      ],
      exitCodePolicy: {
        go: 0,
        conditional_go: 2,
        no_go: 2,
        disqualified: 2,
      },
    },
    waivers: [],
  }, null, 2)}\n`;
}

function baselineTemplate(): string {
  return `${JSON.stringify({
    entries: [],
  }, null, 2)}\n`;
}

function workflowTemplate(): string {
  return `name: QEG

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  qeg:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: RNA4219/quality-evidence-graph/qeg-report-action@v0.3.1
        with:
          targets: .qeg
          output-path: .qeg/qeg-ci-report.json
`;
}

function parseInitArgs(args: readonly string[]): InitOptions {
  let root = ".";
  let force = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) throw new CliError("Expected path after --root");
      root = value;
      index += 1;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    throw new CliError("Usage: qeg init [--root <dir>] [--force]");
  }
  return { root, force };
}

async function writeNewFile(path: string, content: string, force: boolean): Promise<"created" | "overwritten" | "skipped"> {
  if (await exists(path)) {
    if (!force) return "skipped";
    await writeFile(path, content, "utf-8");
    return "overwritten";
  }
  await writeFile(path, content, "utf-8");
  return "created";
}

export async function runInitCommand(args: readonly string[]): Promise<void> {
  const options = parseInitArgs(args);
  const root = resolve(options.root);
  const qegDir = join(root, ".qeg");
  const workflowDir = join(root, ".github", "workflows");
  await mkdir(qegDir, { recursive: true });
  await mkdir(workflowDir, { recursive: true });

  const results = [
    {
      path: join(qegDir, "gate-input.json"),
      status: await writeNewFile(join(qegDir, "gate-input.json"), minimalGateInput(), options.force),
    },
    {
      path: join(qegDir, "qeg-baseline.json"),
      status: await writeNewFile(join(qegDir, "qeg-baseline.json"), baselineTemplate(), options.force),
    },
    {
      path: join(workflowDir, "qeg.yml"),
      status: await writeNewFile(join(workflowDir, "qeg.yml"), workflowTemplate(), options.force),
    },
  ];

  console.log("QEG init");
  for (const result of results) {
    console.log(`- ${result.status}: ${result.path}`);
  }
  if (results.some((result) => result.status === "skipped")) {
    console.log("Use --force to overwrite skipped files.");
  }
  exit(0);
}

