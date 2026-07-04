import { readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import { exit } from "process";
import { collectReportTargets } from "./report.js";
import { createSchemaCheckReport } from "./schema-check.js";

export type DoctorSeverity = "pass" | "warn" | "fail";

export interface DoctorCheck {
  readonly name: string;
  readonly severity: DoctorSeverity;
  readonly message: string;
  readonly remediation?: string;
}

export interface DoctorReport {
  readonly reportVersion: "qeg-doctor-v1";
  readonly generatedAt: string;
  readonly status: DoctorSeverity;
  readonly checks: readonly DoctorCheck[];
}

interface PackageJson {
  readonly engines?: { readonly node?: string };
}

interface GateInputLike {
  readonly metadata?: {
    readonly inputArtifacts?: readonly { readonly path?: string }[];
  };
  readonly evidencePackage?: {
    readonly inputArtifactHashes?: readonly { readonly path?: string }[];
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile() || (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

function nodeMajor(version = process.versions.node): number {
  return Number(version.split(".")[0]);
}

function minimumNodeMajor(engine: string | undefined): number {
  const match = engine?.match(/>=\s*(\d+)/);
  return match ? Number(match[1]) : 20;
}

function worstSeverity(checks: readonly DoctorCheck[]): DoctorSeverity {
  if (checks.some((check) => check.severity === "fail")) return "fail";
  if (checks.some((check) => check.severity === "warn")) return "warn";
  return "pass";
}

async function checkNode(): Promise<DoctorCheck> {
  const pkg = await readJson<PackageJson>("package.json");
  const actual = nodeMajor();
  const minimum = minimumNodeMajor(pkg.engines?.node);
  if (actual < minimum) {
    return {
      name: "node-version",
      severity: "fail",
      message: `Node.js ${process.versions.node} does not satisfy package engine ${pkg.engines?.node ?? `>=${minimum}`}`,
      remediation: `Use Node.js ${minimum} or newer.`,
    };
  }
  return {
    name: "node-version",
    severity: "pass",
    message: `Node.js ${process.versions.node} satisfies package engine ${pkg.engines?.node ?? `>=${minimum}`}`,
  };
}

async function checkDist(): Promise<DoctorCheck> {
  if (await exists("dist/cli.js")) {
    return {
      name: "dist-cli",
      severity: "pass",
      message: "dist/cli.js exists",
    };
  }
  return {
    name: "dist-cli",
    severity: "fail",
    message: "dist/cli.js is missing",
    remediation: "Run npm run build before CI report, or let the GitHub Action build first.",
  };
}

async function checkSchemas(): Promise<DoctorCheck> {
  const report = await createSchemaCheckReport([]);
  return {
    name: "schema-compile",
    severity: report.status === "pass" ? "pass" : "fail",
    message: report.status === "pass" ? "schemas compile with Ajv" : "one or more schemas failed to compile",
    remediation: report.status === "pass" ? undefined : "Run qeg schema-check --json and fix the failing schema.",
  };
}

async function checkWorkflow(): Promise<DoctorCheck[]> {
  const path = ".github/workflows/ci.yml";
  if (!(await exists(path))) {
    return [{
      name: "github-actions-workflow",
      severity: "warn",
      message: ".github/workflows/ci.yml is missing",
      remediation: "Use qeg init or qeg-report-action to add a workflow that uploads qeg-ci-report.",
    }];
  }

  const content = await readFile(path, "utf-8");
  const usesQegAction = content.includes("qeg-report-action");
  const uploadsReportArtifact = usesQegAction ||
    (content.includes("actions/upload-artifact") && content.includes("qeg-ci-report"));
  const writesSummary = usesQegAction ||
    content.includes("GITHUB_STEP_SUMMARY") ||
    content.includes("--github-summary") ||
    content.includes("github-summary");
  return [
    {
      name: "github-actions-artifact",
      severity: uploadsReportArtifact ? "pass" : "warn",
      message: uploadsReportArtifact
        ? "workflow uploads qeg-ci-report artifact"
        : "workflow does not clearly upload qeg-ci-report artifact",
      remediation: "Add actions/upload-artifact for .qeg/qeg-ci-report.json.",
    },
    {
      name: "github-actions-summary",
      severity: writesSummary ? "pass" : "warn",
      message: writesSummary
        ? "workflow writes QEG job summary"
        : "workflow does not clearly write a QEG job summary",
      remediation: "Run qeg report --github-summary or use qeg-report-action.",
    },
  ];
}

async function checkTarget(rawTarget: string): Promise<DoctorCheck[]> {
  const target = resolve(rawTarget);
  const inputPath = join(target, "gate-input.json");
  if (!(await exists(inputPath))) {
    return [{
      name: `target:${rawTarget}:gate-input`,
      severity: "fail",
      message: "gate-input.json is missing",
      remediation: "Generate gate-input.json or run qeg init for a minimal starter.",
    }];
  }

  const checks: DoctorCheck[] = [{
    name: `target:${rawTarget}:gate-input`,
    severity: "pass",
    message: "gate-input.json exists",
  }];
  try {
    const input = await readJson<GateInputLike>(inputPath);
    const artifactPaths = [
      ...(input.metadata?.inputArtifacts ?? []).map((artifact) => artifact.path),
      ...(input.evidencePackage?.inputArtifactHashes ?? []).map((artifact) => artifact.path),
    ].filter((path): path is string => Boolean(path));

    for (const artifactPath of artifactPaths) {
      const resolved = resolve(artifactPath);
      checks.push({
        name: `target:${rawTarget}:artifact:${artifactPath}`,
        severity: await exists(resolved) ? "pass" : "warn",
        message: await exists(resolved) ? "artifact path exists" : "artifact path does not exist in this workspace",
        remediation: "Ensure CI checks out or generates the artifact before qeg report.",
      });
    }
  } catch (error) {
    checks.push({
      name: `target:${rawTarget}:parse`,
      severity: "fail",
      message: error instanceof Error ? error.message : String(error),
      remediation: "Fix gate-input.json so it is valid JSON.",
    });
  }
  return checks;
}

export async function createDoctorReport(rawTargets: readonly string[]): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [
    await checkNode(),
    await checkDist(),
    await checkSchemas(),
    ...await checkWorkflow(),
  ];

  const targets = rawTargets.length > 0 ? await collectReportTargets(rawTargets) : [];
  for (const target of targets) {
    checks.push(...await checkTarget(target));
  }

  return {
    reportVersion: "qeg-doctor-v1",
    generatedAt: new Date().toISOString(),
    status: worstSeverity(checks),
    checks,
  };
}

function formatDoctorText(report: DoctorReport): string {
  const lines = [
    "QEG Doctor",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    "",
  ];
  for (const check of report.checks) {
    lines.push(`- ${check.severity.toUpperCase()} ${check.name}: ${check.message}`);
    if (check.remediation && check.severity !== "pass") {
      lines.push(`  remediation: ${check.remediation}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export async function runDoctorCommand(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  const report = await createDoctorReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatDoctorText(report).trimEnd());
  exit(report.status === "fail" ? 1 : 0);
}
