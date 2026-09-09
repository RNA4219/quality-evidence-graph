import type { DisqualificationCode } from "../../types.js";
import { type LintSeverity, type PolicyLike, type PolicyLintItem } from "./model.js";


export const ALL_DQ_CODES: DisqualificationCode[] = [
  "DQ-01", "DQ-02", "DQ-03", "DQ-04", "DQ-05", "DQ-06", "DQ-07", "DQ-08", "DQ-09",
  "DQ-10", "DQ-11", "DQ-12", "DQ-13", "DQ-14", "DQ-15", "DQ-16", "DQ-17", "DQ-18", "DQ-19", "DQ-20", "DQ-21",
];


export function add(items: PolicyLintItem[], target: string, severity: LintSeverity, message: string): void {
  items.push({ target, severity, message });
}


export function lintPolicy(items: PolicyLintItem[], target: string, policy: PolicyLike | undefined, label: string): void {
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
  if (policy.reliabilityPolicy) {
    if (!/^sha256:[a-f0-9]{64}$/.test(policy.policyHash ?? "")) add(items, target, "fail", `${label}.policyHash must be SHA-256 when reliabilityPolicy is enabled`);
    const reliabilityCodes: DisqualificationCode[] = ["DQ-18", "DQ-19", "DQ-20", "DQ-21"];
    const missingReliability = reliabilityCodes.filter((code) => !scope.includes(code));
    if (missingReliability.length > 0) add(items, target, "fail", `${label}.dqScope lacks reliability codes ${missingReliability.join(", ")}`);
  }
}


export function worst(items: readonly PolicyLintItem[]): LintSeverity {
  if (items.some((item) => item.severity === "fail")) return "fail";
  if (items.some((item) => item.severity === "warn")) return "warn";
  return "pass";
}
