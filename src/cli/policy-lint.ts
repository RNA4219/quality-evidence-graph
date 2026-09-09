import { readFile } from "fs/promises";
import { join } from "path";
import { exit } from "process";
import { CliError } from "./errors.js";
import { formatPolicyLintText } from "./policy-lint/format.js";
import { type GateInputLike, type PolicyLintItem, type PolicyLintReport } from "./policy-lint/model.js";
import { add, lintPolicy, worst } from "./policy-lint/rules.js";
import { collectReportTargets } from "./report.js";
export type { PolicyLintReport } from "./policy-lint/model.js";


async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
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
