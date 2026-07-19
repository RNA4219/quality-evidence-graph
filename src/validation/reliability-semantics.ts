export type ReliabilitySemanticRuleId =
  | "REL-SEM-001"
  | "REL-SEM-002"
  | "REL-SEM-003"
  | "REL-SEM-004"
  | "REL-SEM-005"
  | "REL-SEM-006"
  | "REL-SEM-007"
  | "REL-SEM-008";

export interface ReliabilitySemanticIssue {
  readonly ruleId: ReliabilitySemanticRuleId;
  readonly path: string;
  readonly message: string;
  readonly nodeId?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function validateReliabilitySemantics(raw: unknown): readonly ReliabilitySemanticIssue[] {
  if (!isObject(raw)) return [];
  const issues: ReliabilitySemanticIssue[] = [];
  const add = (
    ruleId: ReliabilitySemanticRuleId,
    path: string,
    message: string,
    nodeId?: string,
  ): void => {
    issues.push({ ruleId, path, message, ...(nodeId ? { nodeId } : {}) });
  };

  if (isObject(raw.graph) && Array.isArray(raw.graph.nodes)) {
    raw.graph.nodes.forEach((node, nodeIndex) => {
      if (!isObject(node)) return;
      const nodeId = typeof node.id === "string" ? node.id : undefined;
      if (node.kind === "test" && node.testType === "resilience" && isObject(node.resilienceScenario)) {
        const scenarioPath = "/graph/nodes/" + nodeIndex + "/resilienceScenario";
        const steadyState = isObject(node.resilienceScenario.steadyState)
          ? node.resilienceScenario.steadyState
          : undefined;
        const slos = Array.isArray(steadyState?.slos) ? steadyState.slos : [];
        const requiredMetrics = Array.isArray(steadyState?.requiredMetrics)
          ? steadyState.requiredMetrics.filter((value): value is string => typeof value === "string")
          : [];
        const names = new Set<string>();
        const tuples = new Set<string>();
        slos.forEach((slo, sloIndex) => {
          if (!isObject(slo)) return;
          const base = scenarioPath + "/steadyState/slos/" + sloIndex;
          if (typeof slo.name === "string") {
            if (names.has(slo.name)) {
              add("REL-SEM-001", base + "/name", "SLO names must be unique", nodeId);
            }
            names.add(slo.name);
          }
          const tuple = [slo.metricName, slo.semanticRole, slo.aggregation, slo.unit]
            .map(String)
            .join(String.fromCharCode(0));
          if (tuples.has(tuple)) {
            add(
              "REL-SEM-002",
              base,
              "metricName/semanticRole/aggregation/unit SLO tuples must be unique",
              nodeId,
            );
          }
          tuples.add(tuple);
          if (typeof slo.metricName === "string" && !requiredMetrics.includes(slo.metricName)) {
            add(
              "REL-SEM-003",
              base + "/metricName",
              "every SLO metric must be present in requiredMetrics",
              nodeId,
            );
          }
          if (
            isObject(slo.target) &&
            slo.target.targetType === "range" &&
            typeof slo.target.min === "number" &&
            typeof slo.target.max === "number" &&
            slo.target.min >= slo.target.max
          ) {
            add("REL-SEM-004", base + "/target", "SLO range min must be less than max", nodeId);
          }
        });
        const abortConditions = Array.isArray(node.resilienceScenario.abortConditions)
          ? node.resilienceScenario.abortConditions
          : [];
        const abortIds = abortConditions
          .map((condition) => (isObject(condition) ? condition.id : undefined))
          .filter((id): id is string => typeof id === "string");
        if (new Set(abortIds).size !== abortIds.length) {
          add(
            "REL-SEM-005",
            scenarioPath + "/abortConditions",
            "abort condition IDs must be unique",
            nodeId,
          );
        }
      }

      if (node.kind === "execution_evidence" && node.evidenceType === "resilience") {
        if (
          typeof node.passed === "boolean" &&
          typeof node.status === "string" &&
          node.passed !== (node.status === "pass")
        ) {
          add(
            "REL-SEM-007",
            "/graph/nodes/" + nodeIndex + "/passed",
            "passed must agree with the canonical status when present",
            nodeId,
          );
        }
        if (isObject(node.signalManifest)) {
          const entries = [
            node.signalManifest.metrics,
            node.signalManifest.traces,
            node.signalManifest.logs,
          ]
            .flatMap((value) => (Array.isArray(value) ? value : []))
            .filter(isObject);
          const entryIds = entries
            .map((entry) => entry.id)
            .filter((id): id is string => typeof id === "string");
          if (new Set(entryIds).size !== entryIds.length) {
            add(
              "REL-SEM-006",
              "/graph/nodes/" + nodeIndex + "/signalManifest",
              "signal entry IDs must be unique across metrics, traces, and logs",
              nodeId,
            );
          }
        }
      }
    });
  }

  if (isObject(raw.policy) && isObject(raw.policy.reliabilityPolicy)) {
    const reliability = raw.policy.reliabilityPolicy;
    const safety = isObject(reliability.safety) ? reliability.safety : undefined;
    const allowed = Array.isArray(safety?.allowedEnvironments)
      ? safety.allowedEnvironments
      : [];
    if (
      typeof reliability.requiredEnvironment === "string" &&
      !allowed.includes(reliability.requiredEnvironment)
    ) {
      add(
        "REL-SEM-008",
        "/policy/reliabilityPolicy/requiredEnvironment",
        "requiredEnvironment must be included in safety.allowedEnvironments",
      );
    }
  }

  return issues.sort(
    (left, right) =>
      compareText(left.path, right.path) ||
      compareText(left.ruleId, right.ruleId) ||
      compareText(left.nodeId ?? "", right.nodeId ?? ""),
  );
}
