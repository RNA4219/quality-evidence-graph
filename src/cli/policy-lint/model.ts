import type { DisqualificationCode, GateProfile } from "../../types.js";


export type LintSeverity = "pass" | "warn" | "fail";


export interface PolicyLintItem {
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


export interface PolicyLike {
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
  readonly reliabilityPolicy?: unknown;
}


export interface GateInputLike {
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
