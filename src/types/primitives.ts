export type QegVersion = "0.2";

export type StableId = string;

export type IsoDateTime = string;

export type Confidence = "low" | "medium" | "high";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Priority = "P0" | "P1" | "P2" | "P3";

export type GateProfile = "lean" | "standard" | "strict" | "ipo_controlled";

export type GateVerdict = "go" | "conditional_go" | "no_go" | "disqualified";

export type PlacementLayer =
  | "unit"
  | "integration"
  | "system"
  | "e2e"
  | "manual-scripted"
  | "manual-exploratory"
  | "spec-clarification";

export type PlacementChangeLayer = PlacementLayer | "automated";

export type PlacementDisposition =
  | "reuse"
  | "adapt"
  | "add"
  | "manual-only"
  | "blocked";

export type GateRelevance = "informational" | "advisory" | "blocking";

export type NodeKind =
  | "requirement"
  | "acceptance_criteria"
  | "risk"
  | "failure_mode"
  | "changed_code"
  | "finding"
  | "test"
  | "test_placement"
  | "execution_evidence"
  | "gate_verdict"
  | "escaped_defect"
  | "waiver"
  | "policy"
  | "acceptance_record";

export type EdgeKind =
  | "derives_from"
  | "satisfies"
  | "risks"
  | "manifests_as"
  | "touches"
  | "supports"
  | "contradicts"
  | "requires_test"
  | "placed_at"
  | "replaced_by"
  | "evidenced_by"
  | "waived_by"
  | "governed_by"
  | "decides";

export type AdapterKind =
  | "manual-bb-test-harness"
  | "code-to-gate"
  | "RanD"
  | "junit"
  | "coverage"
  | "sarif"
  | "git-diff"
  | "qeg-native";

export type RequiredAdapterKind =
  | "manual-bb-test-harness"
  | "code-to-gate"
  | "RanD";

export type WorkflowCookbookRefKind =
  | "birdseye-index"
  | "birdseye-capsule"
  | "task-seed"
  | "acceptance-template";

export type ArtifactKind =
  | "phase_contract"
  | "feature_spec"
  | "test_model"
  | "observation_set"
  | "risk_register"
  | "manual_case_set"
  | "effort_plan"
  | "gate_decision"
  | "release_brief"
  | "execution_evidence"
  | "normalized_repo_graph"
  | "diff_analysis"
  | "findings"
  | "invariants"
  | "test_seeds"
  | "release_readiness"
  | "audit"
  | "requirements_packet"
  | "requirements_audit_packet"
  | "junit"
  | "coverage"
  | "sarif"
  | "git_diff"
  | "quality_evidence_record";

export type DisqualificationCode =
  | "DQ-01"
  | "DQ-02"
  | "DQ-03"
  | "DQ-04"
  | "DQ-05"
  | "DQ-06"
  | "DQ-07"
  | "DQ-08"
  | "DQ-09"
  | "DQ-10"
  | "DQ-11"
  | "DQ-12"
  | "DQ-13"
  | "DQ-14"
  | "DQ-15"
  | "DQ-16"
  | "DQ-17";

export type PackagePhase =
  | "implementation_preparation"
  | "pre_release_review"
  | "release_decision";

export type StorageClassification =
  | "immutable"
  | "append_only"
  | "versioned"
  | "mutable"
  | "unknown";
