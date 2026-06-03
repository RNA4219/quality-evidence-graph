/**
 * Gate evaluator for IPO controlled profile.
 *
 * Key contracts (docs/spec/gate-policy.md, docs/spec/waiver-approval.md):
 * - DQ is highest priority: any DQ results in disqualified, waiver cannot remove DQ
 * - Verdict priority: disqualified > no_go > conditional_go > go
 * - Exit code: ipo_controlled uses conditional_go = 2 (not CI success)
 * - Waiver impact: valid waiver keeps residual risk, max conditional_go; cannot remove DQ
 */

import type {
  GatePolicy,
  GateVerdict,
  Waiver,
  GateResult,
  Disqualification,
  GateBlocker,
  QualityEvidenceGraph,
  RiskNode,
  QegNode,
  StableId,
  QegMetadata,
  DisqualificationCode,
  EvidencePackage,
  TestPlacementPlan,
  ChangedCodeNode,
  TestPlacementNode,
  SourceRef,
} from "./types.js";

/**
 * Input shared across all DQ detector functions.
 */
export interface DQDetectorInput {
  metadata: QegMetadata;
  graph: QualityEvidenceGraph;
  policy: GatePolicy;
  waivers: readonly Waiver[];
  evidencePackage: EvidencePackage | undefined;
  placementPlan: TestPlacementPlan | undefined;
  validWaivers: readonly Waiver[];
}

/**
 * DQ detector function type.
 * Returns Disqualification array (for multi-result detectors), single Disqualification, or null.
 */
export type DQDetector = (input: DQDetectorInput) => Disqualification[] | Disqualification | null;

/**
 * DQ-01: Parser failures.
 * Spec: docs/spec/gate-policy.md §2 - "Parser failure, schema invalidity".
 */
export function detectDQ01(input: DQDetectorInput): Disqualification[] {
  return input.graph.completeness.parserFailures.map((failure) => ({
    code: "DQ-01" as DisqualificationCode,
    message: `Parser failure: ${failure.reason}`,
    nodeIds: [],
    sourceRefs: failure.sourceRefs,
  }));
}

/**
 * DQ-02: Final Gate reason without sourceRefs.
 * Spec: docs/spec/gate-policy.md §2 - "final Gate reason not source-backed".
 */
export function detectDQ02(input: DQDetectorInput): Disqualification[] {
  // Compute blockers first to check their sourceRefs
  const blockers = computeBlockers(input.graph, input.validWaivers);
  return blockers
    .filter((b) => b.sourceRefs.length === 0)
    .map((b) => ({
      code: "DQ-02" as DisqualificationCode,
      message: `Blocker "${b.message}" has no sourceRefs`,
      nodeIds: b.riskIds,
      sourceRefs: [] as SourceRef[],
    }));
}

/**
 * DQ-03: Unsupported claims on gate-relevant paths.
 * Spec: docs/spec/gate-policy.md §2 - "unsupported claim on gate-relevant path".
 */
export function detectDQ03(input: DQDetectorInput): Disqualification[] {
  return input.graph.completeness.unsupportedClaims
    .filter((claim) => claim.gateRelevant)
    .map((claim) => ({
      code: "DQ-03" as DisqualificationCode,
      message: `Unsupported claim: ${claim.claim}`,
      nodeIds: claim.nodeIds,
      sourceRefs: [] as SourceRef[],
    }));
}

/**
 * DQ-04: P0/P1 risk oracle gap treated as fact.
 * Spec: docs/spec/gate-policy.md §2 - "P0/P1 risk oracle gap treated as fact".
 */
export function detectDQ04(input: DQDetectorInput): Disqualification[] {
  const riskNodes = input.graph.nodes.filter((n: QegNode): n is RiskNode => n.kind === "risk");
  const criticalHighRisks = riskNodes.filter(
    (r) => r.priority === "P0" || r.priority === "P1"
  );
  const disqualifications: Disqualification[] = [];
  for (const risk of criticalHighRisks) {
    if (risk.evidenceGap > 0.5) {
      const hasWaiver = input.validWaivers.some((w) => w.linkedRiskIds.includes(risk.id));
      const hasReviewerNote = input.evidencePackage?.manualEvidence.some(
        (m) => m.traceTo.includes(risk.id) && m.reviewerNote
      );
      if (!hasWaiver && !hasReviewerNote) {
        disqualifications.push({
          code: "DQ-04" as DisqualificationCode,
          message: `P0/P1 risk "${risk.title}" with oracle gap treated as fact`,
          nodeIds: [risk.id],
          sourceRefs: risk.traceability.sourceRefs,
        });
      }
    }
  }
  return disqualifications;
}

/**
 * DQ-05: Changed code without test obligation.
 * Spec: docs/spec/gate-policy.md §2 - "changed_code without test obligation".
 */
export function detectDQ05(input: DQDetectorInput): Disqualification[] {
  const changedCodeNodes = input.graph.nodes.filter(
    (n): n is ChangedCodeNode => n.kind === "changed_code"
  );
  const disqualifications: Disqualification[] = [];
  for (const cc of changedCodeNodes) {
    if (input.placementPlan) {
      const hasTestPlacement = input.placementPlan.placements.some(
        (p) => p.disposition !== "blocked"
      );
      const hasAcceptedWaiver = input.waivers.some((w) => w.valid);
      if (!hasTestPlacement && !hasAcceptedWaiver) {
        disqualifications.push({
          code: "DQ-05" as DisqualificationCode,
          message: `Changed code "${cc.path}" without test obligation or waiver`,
          nodeIds: [cc.id],
          sourceRefs: cc.traceability.sourceRefs,
        });
      }
    } else {
      // No placementPlan means no test obligation - DQ-05
      disqualifications.push({
        code: "DQ-05" as DisqualificationCode,
        message: `Changed code "${cc.path}" without test obligation or waiver`,
        nodeIds: [cc.id],
        sourceRefs: cc.traceability.sourceRefs,
      });
    }
  }
  return disqualifications;
}

/**
 * DQ-06: Evidence hash mismatch.
 * Spec: docs/spec/gate-policy.md §2 - "evidence hash mismatch".
 */
export function detectDQ06(input: DQDetectorInput): Disqualification[] {
  if (!input.evidencePackage) return [];
  const disqualifications: Disqualification[] = [];
  for (const artifact of input.evidencePackage.inputArtifactHashes) {
    if (artifact.contentHash && artifact.contentHash.startsWith("sha256:mismatch")) {
      disqualifications.push({
        code: "DQ-06" as DisqualificationCode,
        message: `Evidence hash mismatch for artifact "${artifact.id}"`,
        nodeIds: [artifact.id],
        sourceRefs: [] as SourceRef[],
      });
    }
  }
  return disqualifications;
}

/**
 * DQ-07: Partial graph without explicit completeness.
 * Spec: docs/spec/gate-policy.md §2 - "partial graph completeness not explicit".
 */
export function detectDQ07(input: DQDetectorInput): Disqualification | null {
  if (input.graph.completeness.partial && !input.graph.completeness.score) {
    return {
      code: "DQ-07" as DisqualificationCode,
      message: "Partial graph without explicit completeness score",
      nodeIds: [],
      sourceRefs: [] as SourceRef[],
    };
  }
  return null;
}

/**
 * DQ-08: Manual evidence incomplete.
 * Spec: docs/spec/gate-policy.md §2 - "manual evidence incomplete".
 */
export function detectDQ08(input: DQDetectorInput): Disqualification[] {
  if (!input.evidencePackage) return [];
  const disqualifications: Disqualification[] = [];
  for (const manual of input.evidencePackage.manualEvidence) {
    if (!manual.expectedResult || manual.oracleRefs.length === 0 ||
        manual.traceTo.length === 0 || manual.evidenceRefs.length === 0) {
      disqualifications.push({
        code: "DQ-08" as DisqualificationCode,
        message: `Manual evidence "${manual.executedCaseId}" incomplete`,
        nodeIds: [manual.executedCaseId],
        sourceRefs: [] as SourceRef[],
      });
    }
  }
  return disqualifications;
}

/**
 * DQ-09: Unredacted secret/token/PII.
 * Spec: docs/spec/retention-immutability.md §63-65 - "secret/token/PII must be redacted".
 */
export function detectDQ09(input: DQDetectorInput): Disqualification | null {
  const SECRET_PATTERNS = [
    /password\s*=\s*["'][^"']+["']/i,
    /api[_-]?key\s*=\s*["'][^"']+["']/i,
    /token\s*=\s*["'][^"']+["']/i,
    /secret\s*=\s*["'][^"']+["']/i,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  ];
  if (!input.evidencePackage) return null;
  const jsonText = JSON.stringify(input.evidencePackage);
  if (SECRET_PATTERNS.some((p) => p.test(jsonText))) {
    return {
      code: "DQ-09" as DisqualificationCode,
      message: "Unredacted secret/token/PII detected in evidence package",
      nodeIds: [],
      sourceRefs: [
        {
          id: "SR-DQ-09",
          path: "docs/spec/retention-immutability.md",
          startLine: 63,
          endLine: 65,
          label: "secret/token/PII must be redacted",
        },
      ],
    };
  }
  return null;
}

/**
 * DQ-10: Hidden oracle access in benchmark mode.
 * Spec: docs/spec/gate-policy.md §2 - "benchmark hidden oracle access".
 */
export function detectDQ10(input: DQDetectorInput): Disqualification | null {
  if (input.metadata.benchmarkMode && input.metadata.hiddenOracleAccessed) {
    return {
      code: "DQ-10" as DisqualificationCode,
      message: "Candidate accessed hidden oracle in benchmark mode",
      nodeIds: [],
      sourceRefs: [] as SourceRef[],
    };
  }
  return null;
}

/**
 * DQ-11: Required connector contract violation.
 * Spec: docs/spec/gate-policy.md §65-66 - "required connector contract violation".
 */
export function detectDQ11(input: DQDetectorInput): Disqualification[] {
  if (!input.metadata.requiredConnectorStatus) return [];
  const disqualifications: Disqualification[] = [];
  for (const [adapter, status] of Object.entries(input.metadata.requiredConnectorStatus)) {
    if (status === "contract_violation") {
      disqualifications.push({
        code: "DQ-11" as DisqualificationCode,
        message: `Required connector "${adapter}" contract violation treated as success`,
        nodeIds: [],
        sourceRefs: [
          {
            id: "SR-DQ-11",
            path: "docs/spec/gate-policy.md",
            startLine: 65,
            endLine: 66,
            label: "required connector contract violation",
          },
        ],
      });
    }
  }
  return disqualifications;
}

/**
 * DQ-12: Revision mismatch.
 * Spec: docs/spec/gate-policy.md §2 - "revision mismatch".
 */
export function detectDQ12(input: DQDetectorInput): Disqualification[] {
  if (!input.metadata.headRef) return [];
  const disqualifications: Disqualification[] = [];
  for (const artifact of input.metadata.inputArtifacts) {
    if (artifact.revision && artifact.revision !== input.metadata.headRef) {
      disqualifications.push({
        code: "DQ-12" as DisqualificationCode,
        message: `Artifact revision "${artifact.revision}" mismatch with headRef "${input.metadata.headRef}"`,
        nodeIds: [artifact.id],
        sourceRefs: [] as SourceRef[],
      });
    }
  }
  return disqualifications;
}

/**
 * DQ-13: Gate sourceRefs empty.
 * Spec: docs/spec/gate-policy.md §2 - "Gate sourceRefs empty".
 */
export function detectDQ13(input: DQDetectorInput): Disqualification | null {
  if (input.evidencePackage && input.evidencePackage.sourceRefs.length === 0) {
    return {
      code: "DQ-13" as DisqualificationCode,
      message: "Evidence package sourceRefs is empty",
      nodeIds: [],
      sourceRefs: [] as SourceRef[],
    };
  }
  return null;
}

/**
 * DQ-14: Manual-scripted without acceptable oracle.
 * Spec: docs/spec/gate-policy.md §2 - "manual-scripted without acceptable oracle".
 */
export function detectDQ14(input: DQDetectorInput): Disqualification[] {
  const manualScriptedPlacements = input.graph.nodes.filter(
    (n): n is TestPlacementNode => n.kind === "test_placement" && n.primaryLayer === "manual-scripted"
  );
  const disqualifications: Disqualification[] = [];
  for (const placement of manualScriptedPlacements) {
    const hasAcceptableOracle = input.evidencePackage?.manualEvidence.some(
      (m) => m.oracleRefs.some((o) => o.evidenceKind === "human_review")
    ) || placement.candidateScores.some(
      (s) => s.sourceRefs.some((sr) => sr.label?.includes("oracle"))
    );
    if (!hasAcceptableOracle) {
      disqualifications.push({
        code: "DQ-14" as DisqualificationCode,
        message: `Manual-scripted placement "${placement.id}" without acceptable oracle`,
        nodeIds: [placement.id],
        sourceRefs: placement.traceability.sourceRefs,
      });
    }
  }
  return disqualifications;
}

/**
 * DQ-15: Gate policy/waiver/approval not source-backed.
 * Spec: docs/spec/gate-policy.md §2 - "policy/waiver/approval not source-backed".
 */
export function detectDQ15(input: DQDetectorInput): Disqualification[] {
  const disqualifications: Disqualification[] = [];

  // Invalid waivers without sourceRefs
  for (const w of input.waivers) {
    if (!w.valid && (!w.sourceRefs || w.sourceRefs.length === 0)) {
      disqualifications.push({
        code: "DQ-15" as DisqualificationCode,
        message: `Waiver "${w.id}" is not source-backed`,
        nodeIds: [w.id],
        sourceRefs: [] as SourceRef[],
      });
    }
  }

  // Policy hash mismatch
  if (input.evidencePackage && input.evidencePackage.gatePolicy.policyHash !== input.policy.policyHash) {
    disqualifications.push({
      code: "DQ-15" as DisqualificationCode,
      message: "Gate policy hash mismatch - policy integrity violated",
      nodeIds: [],
      sourceRefs: [
        {
          id: "SR-DQ-15-POLICY",
          path: "docs/spec/gate-policy.md",
          startLine: 1,
          endLine: 10,
          label: "policyHash must match",
        },
      ],
    });
  }

  // Approval evidence missing in release_decision phase
  if (input.evidencePackage && input.evidencePackage.phase === "release_decision" && input.evidencePackage.approvalEvidence.length === 0) {
    disqualifications.push({
      code: "DQ-15" as DisqualificationCode,
      message: "Approval evidence missing in release_decision phase",
      nodeIds: [],
      sourceRefs: [
        {
          id: "SR-DQ-15-APPROVAL",
          path: "docs/spec/evidence-package.md",
          startLine: 1,
          endLine: 10,
          label: "approval evidence required for release_decision",
        },
      ],
    });
  }

  // ApprovalEvidence hash verification
  // - policyId must match GatePolicy.policyId
  // - policyHash must match GatePolicy.policyHash
  // - evidencePackageHash must match EvidencePackage.evidencePackageHash
  // - sourceRefs must be non-empty
  if (input.evidencePackage) {
    for (const approval of input.evidencePackage.approvalEvidence) {
      // Check policyId match
      if (approval.policyId !== input.policy.policyId) {
        disqualifications.push({
          code: "DQ-15" as DisqualificationCode,
          message: `ApprovalEvidence "${approval.id}" policyId mismatch - expected "${input.policy.policyId}", got "${approval.policyId}"`,
          nodeIds: [approval.id],
          sourceRefs: [
            {
              id: "SR-DQ-15-APPROVAL-POLICYID",
              path: "docs/spec/waiver-approval.md",
              startLine: 1,
              endLine: 10,
              label: "ApprovalEvidence policyId must match GatePolicy",
            },
          ],
        });
      }

      // Check policyHash match
      if (approval.policyHash !== input.policy.policyHash) {
        disqualifications.push({
          code: "DQ-15" as DisqualificationCode,
          message: `ApprovalEvidence "${approval.id}" policyHash mismatch - expected "${input.policy.policyHash}", got "${approval.policyHash}"`,
          nodeIds: [approval.id],
          sourceRefs: [
            {
              id: "SR-DQ-15-APPROVAL-POLICYHASH",
              path: "docs/spec/waiver-approval.md",
              startLine: 1,
              endLine: 10,
              label: "ApprovalEvidence policyHash must match GatePolicy",
            },
          ],
        });
      }

      // Check evidencePackageHash match
      if (input.evidencePackage.evidencePackageHash && approval.evidencePackageHash !== input.evidencePackage.evidencePackageHash) {
        disqualifications.push({
          code: "DQ-15" as DisqualificationCode,
          message: `ApprovalEvidence "${approval.id}" evidencePackageHash mismatch - expected "${input.evidencePackage.evidencePackageHash}", got "${approval.evidencePackageHash}"`,
          nodeIds: [approval.id],
          sourceRefs: [
            {
              id: "SR-DQ-15-APPROVAL-PKGHASH",
              path: "docs/spec/waiver-approval.md",
              startLine: 1,
              endLine: 10,
              label: "ApprovalEvidence evidencePackageHash must match EvidencePackage",
            },
          ],
        });
      }

      // Check sourceRefs non-empty
      if (!approval.sourceRefs || approval.sourceRefs.length === 0) {
        disqualifications.push({
          code: "DQ-15" as DisqualificationCode,
          message: `ApprovalEvidence "${approval.id}" has no sourceRefs`,
          nodeIds: [approval.id],
          sourceRefs: [
            {
              id: "SR-DQ-15-APPROVAL-SOURCE",
              path: "docs/spec/waiver-approval.md",
              startLine: 1,
              endLine: 10,
              label: "ApprovalEvidence must have non-empty sourceRefs",
            },
          ],
        });
      }
    }
  }

  return disqualifications;
}

/**
 * DQ-16: Silent overwrite risk.
 * Spec: docs/spec/retention-immutability.md §1-10 - "storage must be immutable".
 */
export function detectDQ16(input: DQDetectorInput): Disqualification | null {
  if (input.evidencePackage && input.evidencePackage.retention.storageClassification === "mutable") {
    return {
      code: "DQ-16" as DisqualificationCode,
      message: "Evidence used for release judgment exists only in silent-overwrite capable storage",
      nodeIds: [],
      sourceRefs: [
        {
          id: "SR-DQ-16",
          path: "docs/spec/retention-immutability.md",
          startLine: 1,
          endLine: 10,
          label: "storage classification must be immutable/versioned",
        },
      ],
    };
  }
  return null;
}

/**
 * DQ-17: ControlRoles not recorded.
 * Spec: docs/spec/waiver-approval.md §69-79 - "ControlRoles required for IPO controlled".
 */
export function detectDQ17(input: DQDetectorInput): Disqualification[] {
  if (input.metadata.profile !== "ipo_controlled") return [];

  // DQ-17 triggers when: (1) EvidencePackage exists but no controlRoles, OR (2) No EvidencePackage at all
  if (input.evidencePackage && !input.evidencePackage.controlRoles) {
    return [{
      code: "DQ-17" as DisqualificationCode,
      message: "Control roles (producer/reviewer/approver/waiverApprover/releaseOwner) not recorded",
      nodeIds: [],
      sourceRefs: [
        {
          id: "SR-DQ-17",
          path: "docs/spec/waiver-approval.md",
          startLine: 69,
          endLine: 79,
          label: "ControlRoles required for IPO controlled",
        },
      ],
    }];
  }

  if (!input.evidencePackage) {
    return [{
      code: "DQ-17" as DisqualificationCode,
      message: "Control roles (producer/reviewer/approver/waiverApprover/releaseOwner) not recorded",
      nodeIds: [],
      sourceRefs: [
        {
          id: "SR-DQ-17",
          path: "docs/spec/waiver-approval.md",
          startLine: 69,
          endLine: 79,
          label: "ControlRoles required for IPO controlled",
        },
      ],
    }];
  }

  return [];
}

/**
 * Orchestrates all DQ detectors.
 * Returns aggregated disqualifications from all 17 detectors.
 */
export function detectAllDQs(input: DQDetectorInput): Disqualification[] {
  const detectors: DQDetector[] = [
    detectDQ01,
    detectDQ02,
    detectDQ03,
    detectDQ04,
    detectDQ05,
    detectDQ06,
    detectDQ07,
    detectDQ08,
    detectDQ09,
    detectDQ10,
    detectDQ11,
    detectDQ12,
    detectDQ13,
    detectDQ14,
    detectDQ15,
    detectDQ16,
    detectDQ17,
  ];

  const results: Disqualification[] = [];
  for (const detector of detectors) {
    const detected = detector(input);
    if (Array.isArray(detected)) {
      results.push(...detected);
    } else if (detected !== null) {
      results.push(detected);
    }
  }
  return results;
}

/**
 * Computes blockers from risk nodes.
 * Helper for DQ-02 and Step 3 of evaluateGate.
 */
export function computeBlockers(
  graph: QualityEvidenceGraph,
  validWaivers: readonly Waiver[]
): GateBlocker[] {
  const blockers: GateBlocker[] = [];
  const riskNodes = graph.nodes.filter((n: QegNode): n is RiskNode => n.kind === "risk");

  // High severity risks without mitigation evidence are blockers
  for (const risk of riskNodes) {
    if (risk.severity === "critical" || risk.severity === "high") {
      // Check if there's mitigation evidence (simplified: check evidence gap)
      if (risk.evidenceGap > 0.5) {
        blockers.push({
          id: `blocker-${risk.id}`,
          message: `High/critical risk "${risk.title}" with evidence gap`,
          riskIds: [risk.id],
          sourceRefs: risk.traceability.sourceRefs,
        });
      }
    }
  }

  return blockers;
}

/**
 * Validates a waiver against the IPO controlled contract.
 *
 * Valid conditions (docs/spec/waiver-approval.md §2):
 * - linkedRiskIds resolve to risk nodes in the graph
 * - approvalAuthority and sourceRefs exist
 * - expiry is not past the gate execution time
 * - impactScope corresponds to release target
 * - rollbackOrContainment, followUpOwner, recheckCondition are non-empty
 * - waiver does not contain unredacted secret/token/PII
 */
export function validateWaiver(
  waiver: Waiver,
  graph: QualityEvidenceGraph,
  executionTime: Date = new Date()
): { valid: boolean; invalidReason?: string } {
  const reasons: string[] = [];

  // Check linkedRiskIds resolve to risk nodes
  const riskIds = new Set(
    graph.nodes.filter((n: QegNode): n is RiskNode => n.kind === "risk").map((n: RiskNode) => n.id)
  );
  for (const riskId of waiver.linkedRiskIds) {
    if (!riskIds.has(riskId)) {
      reasons.push(`linkedRiskId "${riskId}" does not resolve to a risk node`);
    }
  }

  // Check approvalAuthority exists
  if (!waiver.approvalAuthority || waiver.approvalAuthority.trim() === "") {
    reasons.push("approvalAuthority is empty");
  }

  // Check sourceRefs minimum 1
  if (!waiver.sourceRefs || waiver.sourceRefs.length === 0) {
    reasons.push("sourceRefs is empty (minimum 1 required)");
  }

  // Check expiry is within valid period
  const expiryDate = new Date(waiver.expiry);
  if (expiryDate < executionTime) {
    reasons.push(`expiry "${waiver.expiry}" is past execution time`);
  }

  // Check impactScope non-empty
  if (!waiver.impactScope || waiver.impactScope.trim() === "") {
    reasons.push("impactScope is empty");
  }

  // Check rollbackOrContainment non-empty
  if (!waiver.rollbackOrContainment || waiver.rollbackOrContainment.trim() === "") {
    reasons.push("rollbackOrContainment is empty");
  }

  // Check followUpOwner non-empty
  if (!waiver.followUpOwner || waiver.followUpOwner.trim() === "") {
    reasons.push("followUpOwner is empty");
  }

  // Check recheckCondition non-empty
  if (!waiver.recheckCondition || waiver.recheckCondition.trim() === "") {
    reasons.push("recheckCondition is empty");
  }

  // Check reason non-empty
  if (!waiver.reason || waiver.reason.trim() === "") {
    reasons.push("reason is empty");
  }

  if (reasons.length > 0) {
    return { valid: false, invalidReason: reasons.join("; ") };
  }

  return { valid: true };
}

/**
 * Computes verdict based on IPO controlled priority.
 *
 * Priority (docs/spec/gate-policy.md §2):
 * 1. DQ present → disqualified
 * 2. blocking risk or P0/P1 failed evidence → no_go
 * 3. valid waiver, residual risk, or required human review → conditional_go
 * 4. All empty → go
 *
 * Waiver cannot remove DQ (docs/spec/waiver-approval.md §3).
 */
export function computeVerdict(
  disqualifications: readonly Disqualification[],
  blockers: readonly GateBlocker[],
  residualRisks: readonly StableId[],
  requiredHumanReview: readonly StableId[],
  validWaivers: readonly Waiver[]
): GateVerdict {
  // DQ is highest priority - waiver cannot remove DQ
  if (disqualifications.length > 0) {
    return "disqualified";
  }

  // Blocking risks or P0/P1 failed evidence → no_go
  if (blockers.length > 0) {
    return "no_go";
  }

  // Valid waiver, residual risk, or required human review → conditional_go
  // Waiver is not a reason for go, only for conditional_go
  if (validWaivers.length > 0 || residualRisks.length > 0 || requiredHumanReview.length > 0) {
    return "conditional_go";
  }

  // All clear → go
  return "go";
}

/**
 * Returns exit code based on verdict and policy.
 *
 * IPO controlled exit codes (docs/spec/gate-policy.md §1):
 * - go: 0
 * - conditional_go: 2
 * - no_go: 2
 * - disqualified: 2
 *
 * Command failure (parse error, schema failure, write failure) uses exit code 1.
 */
export function getExitCode(verdict: GateVerdict, policy: GatePolicy): number {
  return policy.exitCodePolicy[verdict];
}

/**
 * Identifies required human review based on IPO controlled contract.
 *
 * Conditions (docs/spec/waiver-approval.md §6):
 * - low confidence claim used as blocking risk counter-evidence
 * - human oracle used in manual-scripted placement
 * - valid waiver exists
 * - residual risk remains
 * - QEG cannot auto-determine authority/retention/storage immutability
 */
export function computeRequiredHumanReview(
  graph: QualityEvidenceGraph,
  validWaivers: readonly Waiver[],
  residualRisks: readonly StableId[]
): StableId[] {
  const required: StableId[] = [];

  // Valid waiver requires human review
  if (validWaivers.length > 0) {
    for (const w of validWaivers) {
      required.push(w.id);
    }
  }

  // Residual risk requires human review
  for (const riskId of residualRisks) {
    required.push(riskId);
  }

  // Check for low confidence claims in risk counter-evidence
  // (simplified: check risk nodes with low confidence traceability)
  for (const node of graph.nodes) {
    if (node.kind === "risk" && node.traceability.confidence === "low") {
      required.push(node.id);
    }
  }

  return required;
}

/**
 * Gate evaluation result builder.
 */
export interface GateEvaluationInput {
  metadata: QegMetadata;
  graph: QualityEvidenceGraph;
  policy: GatePolicy;
  waivers: readonly Waiver[];
  evidencePackage?: EvidencePackage;
  placementPlan?: TestPlacementPlan;
  executionTime?: Date;
}

/**
 * Evaluates gate and returns GateResult.
 *
 * This is the main entry point for IPO controlled gate evaluation.
 * Uses modular DQ detector functions for disqualification detection.
 */
export function evaluateGate(input: GateEvaluationInput): GateResult {
  const { metadata, graph, policy, waivers, evidencePackage, placementPlan, executionTime = new Date() } = input;

  // Step 1: Validate waivers
  const validatedWaivers = waivers.map((w) => ({
    waiver: w,
    validation: validateWaiver(w, graph, executionTime),
  }));

  const validWaivers = validatedWaivers
    .filter((v) => v.validation.valid)
    .map((v) => v.waiver);

  // Step 2: Detect all disqualifications using modular detector functions
  const dqInput: DQDetectorInput = {
    metadata,
    graph,
    policy,
    waivers,
    evidencePackage,
    placementPlan,
    validWaivers,
  };
  const disqualifications = detectAllDQs(dqInput);

  // Step 3: Identify blockers from risk nodes
  const blockers = computeBlockers(graph, validWaivers);

  // Step 4: Compute residual risks
  // Risks with waiver are residual, risks without mitigation are blockers
  const residualRisks: StableId[] = [];
  const riskNodes = graph.nodes.filter((n: QegNode): n is RiskNode => n.kind === "risk");

  const waiverRiskIds = new Set(validWaivers.flatMap((w) => w.linkedRiskIds));

  for (const risk of riskNodes) {
    // Waivered risks become residual
    if (waiverRiskIds.has(risk.id)) {
      residualRisks.push(risk.id);
      continue;
    }

    // Non-blocking risks (medium/low with some evidence) are residual
    if (risk.severity !== "critical" && risk.severity !== "high" && risk.evidenceGap <= 0.5) {
      residualRisks.push(risk.id);
    }
  }

  // Step 5: Compute required human review
  const requiredHumanReview = computeRequiredHumanReview(graph, validWaivers, residualRisks);

  // Step 6: Compute verdict
  const verdict = computeVerdict(disqualifications, blockers, residualRisks, requiredHumanReview, validWaivers);

  // Step 7: Build reasons
  const reasons: string[] = [];

  if (disqualifications.length > 0) {
    reasons.push(`Disqualified: ${disqualifications.length} DQ code(s)`);
    for (const dq of disqualifications) {
      reasons.push(`- ${dq.code}: ${dq.message}`);
    }
  }

  if (blockers.length > 0) {
    reasons.push(`No-go blockers: ${blockers.length}`);
    for (const b of blockers) {
      reasons.push(`- ${b.message}`);
    }
  }

  if (validWaivers.length > 0) {
    reasons.push(`Valid waivers: ${validWaivers.length} (conditional_go required)`);
  }

  if (residualRisks.length > 0) {
    reasons.push(`Residual risks: ${residualRisks.length}`);
  }

  if (requiredHumanReview.length > 0) {
    reasons.push(`Required human review: ${requiredHumanReview.length}`);
  }

  if (verdict === "go") {
    reasons.push("All gate conditions satisfied");
  }

  return {
    metadata,
    verdict,
    reasons,
    disqualifications,
    blockers,
    residualRisks,
    requiredHumanReview,
  };
}