import { readFile } from "fs/promises";
import { join } from "path";
import { exit } from "process";
import type { DisqualificationCode, GateProfile } from "../types.js";
import { collectReportTargets } from "./report.js";
import { CliError } from "./errors.js";

type LintSeverity = "pass" | "warn" | "fail";

interface PolicyLintItem {
  readonly target: string;
  readonly severity: LintSeverity;
  readonly message: string;
}

export interface PolicyLintReport {
  readonly reportVersion: "qeg-policy-lint-v1";
  readonly generatedAt: string;
  readonly status: LintSeverity;
  readonly items: readonly PolicyLintItem[];
}

interface PolicyLike {
  readonly policyId?: string;
  readonly policyHash?: string;
  readonly profile?: GateProfile;
  readonly sourceRefs?: readonly unknown[];
  readonly dqScope?: readonly DisqualificationCode[];
  readonly exitCodePolicy?: {
    readonly go?: number;
    readonly conditional_go?: number;
    readonly no_go?: number;
    readonly disqualified?: number;
  };
}

interface GateInputLike {
  readonly metadata?: {
    readonly profile?: GateProfile;
    readonly policyId?: string;
    readonly policyHash?: string;
  };
  readonly policy?: PolicyLike;
  readonly evidencePackage?: {
    readonly gatePolicy?: PolicyLike;
  };
}

const ALL_DQ_CODES: DisqualificationCode[] = [
  "DQ-01", "DQ-02", "DQ-03", "DQ-04", "DQ-05", "DQ-06", "DQ-07", "DQ-08", "DQ-09",
  "DQ-10", "DQ-11", "DQ-12", "DQ-13", "DQ-14", "DQ-15", "DQ-16", "DQ-17",
];

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

function add(items: PolicyLintItem[], target: string, severity: LintSeverity, message: string): void {
  items.push({ target, severity, message });
}

function lintPolicy(items: PolicyLintItem[], target: string, policy: PolicyLike | undefined, label: string): void {
  if (!policy) {
    add(items, target, "fail", `${label} is missing`);
    return;
  }
  if (!policy.policyId) add(items, target, "fail", `${label}.policyId is missing`);
  if (!policy.policyHash) {
    add(items, target, "fail", `${label}.policyHash is missing`);
  } else if (!policy.policyHash.startsWith("sha256:")) {
    add(items, target, "warn", `${label}.policyHash does not use sha256: prefix`);
  }
  if (!policy.sourceRefs || policy.sourceRefs.length === 0) {
    add(items, target, "fail", `${label}.sourceRefs is empty`);
  }
  const exit = policy.exitCodePolicy;
  if (!exit) {
    add(items, target, "fail", `${label}.exitCodePolicy is missing`);
  } else {
    if (exit.go !== 0) add(items, target, "fail", `${label}.exitCodePolicy.go must be 0`);
    for (const verdict of ["conditional_go", "no_go", "disqualified"] as const) {
      if (exit[verdict] !== 2) add(items, target, "fail", `${label}.exitCodePolicy.${verdict} must be 2`);
    }
  }
  const scope = policy.dqScope ?? [];
  const duplicates = scope.filter((code, index) => scope.indexOf(code) !== index);
  for (const duplicate of [...new Set(duplicates)]) {
    add(items, target, "fail", `${label}.dqScope duplicates ${duplicate}`);
  }
  const missing = ALL_DQ_CODES.filter((code) => !scope.includes(code));
  if (missing.length > 0) {
    add(items, target, "warn", `${label}.dqScope does not include ${missing.join(", ")}`);
  }
}

function worst(items: readonly PolicyLintItem[]): LintSeverity {
  if (items.some((item) => item.severity === "fail")) return "fail";
  if (items.some((item) => item.severity === "warn")) return "warn";
  return "pass";
}

export async function createPolicyLintReport(rawTargets: readonly string[]): Promise<PolicyLintReport> {
  const targets = await collectReportTargets(rawTargets);
  const items: PolicyLintItem[] = [];
  for (const target of targets) {
    try {
      const input = await readJson<GateInputLike>(join(target, "gate-input.json"));
      lintPolicy(items, target, input.policy, "policy");
      if (input.evidencePackage?.gatePolicy) {
        lintPolicy(items, target, input.evidencePackage.gatePolicy, "evidencePackage.gatePolicy");
        if (input.policy?.policyId && input.evidencePackage.gatePolicy.policyId && input.policy.policyId !== input.evidencePackage.gatePolicy.policyId) {
          add(items, target, "fail", "policy.policyId does not match evidencePackage.gatePolicy.policyId");
        }
        if (input.policy?.policyHash && input.evidencePackage.gatePolicy.policyHash && input.policy.policyHash !== input.evidencePackage.gatePolicy.policyHash) {
          add(items, target, "fail", "policy.policyHash does not match evidencePackage.gatePolicy.policyHash");
        }
      }
      if (input.metadata?.profile && input.policy?.profile && input.metadata.profile !== input.policy.profile) {
        add(items, target, "fail", "metadata.profile does not match policy.profile");
      }
      if (input.metadata?.policyHash && input.policy?.policyHash && input.metadata.policyHash !== input.policy.policyHash) {
        add(items, target, "fail", "metadata.policyHash does not match policy.policyHash");
      }
      if (!items.some((item) => item.target === target)) {
        add(items, target, "pass", "policy lint passed");
      }
    } catch (error) {
      add(items, target, "fail", error instanceof Error ? error.message : String(error));
    }
  }
  return {
    reportVersion: "qeg-policy-lint-v1",
    generatedAt: new Date().toISOString(),
    status: worst(items),
    items,
  };
}

function formatPolicyLintText(report: PolicyLintReport): string {
  const lines = [
    "QEG Policy Lint",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    "",
  ];
  for (const item of report.items) {
    lines.push(`- ${item.severity.toUpperCase()} ${item.target}: ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function runPolicyLintCommand(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const targets = args.filter((arg) => arg !== "--json");
  if (targets.length === 0) {
    throw new CliError("Usage: qeg policy lint [--json] <fixture-dir-or-parent> [...]");
  }
  const report = await createPolicyLintReport(targets);
  console.log(json ? JSON.stringify(report, null, 2) : formatPolicyLintText(report).trimEnd());
  exit(report.status === "fail" ? 1 : 0);
}

