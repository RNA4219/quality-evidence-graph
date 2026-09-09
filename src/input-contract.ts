import type { InputContract, RequiredArtifact, SourceRef } from "./types.js";

export const UPSTREAM_REQUIRED_ARTIFACTS: readonly RequiredArtifact[] = [
  ...(["requirements_packet", "requirements_audit_packet"] as const).map(kind => ({ adapter: "RanD" as const, kind })),
  ...(["normalized_repo_graph", "diff_analysis", "findings", "risk_register", "test_seeds", "release_readiness", "audit"] as const)
    .map(kind => ({ adapter: "code-to-gate" as const, kind })),
  ...(["feature_spec", "risk_register", "manual_case_set", "gate_decision", "execution_evidence"] as const)
    .map(kind => ({ adapter: "manual-bb-test-harness" as const, kind })),
];

export function artifactKey(artifact: RequiredArtifact): string {
  return `${artifact.adapter}/${artifact.kind}`;
}

export function inputSource(pointer: string, label: string): SourceRef {
  return { id: `qeg:input-${encodeURIComponent(pointer)}`, path: "gate-input.json", label: `${pointer}: ${label}` };
}

export function upstreamInputContract(target: string): InputContract {
  return {
    mode: "upstream_artifacts",
    requiredArtifacts: UPSTREAM_REQUIRED_ARTIFACTS,
    evaluationScope: { kind: "isolated_consumer", target, notEvaluated: ["実環境の受入", "人間のrelease approval"] },
    requireExecutedTests: true,
    sourceRefs: [inputSource("/policy/inputContract", "必要証跡と評価範囲を設定する")],
  };
}
