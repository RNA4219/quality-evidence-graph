import type { GateProfile, GateVerdict, GateVerdictNode, IngestArtifact } from "../types.js";
import { base, type RawObject } from "./common.js";

const VERDICTS: Readonly<Record<string, GateVerdict>> = {
  go: "go", pass: "go", passed: "go", conditional_go: "conditional_go", passed_with_risk: "conditional_go", needs_review: "conditional_go",
  no_go: "no_go", fail: "no_go", failed: "no_go", blocked: "no_go", blocked_input: "disqualified", disqualified: "disqualified",
};
export function decision(ref: IngestArtifact, local: string, status: unknown, profile: GateProfile, raw: RawObject): GateVerdictNode {
  const verdict = typeof status === "string" ? VERDICTS[status] : undefined;
  if (!verdict) throw new Error(`Unknown upstream decision: ${String(status)}`);
  return { ...base(ref, "gate_verdict", local, `${ref.adapter}: ${String(status)}`, raw), kind: "gate_verdict", profile, verdict,
    disqualifications: [], blockers: [], residualRisks: [] };
}
