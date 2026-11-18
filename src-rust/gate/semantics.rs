use super::*;

pub fn reliability_semantics(raw: &Value) -> Vec<Value> {
    let mut out = vec![];
    let mut add = |rule: &str, path: String, message: &str, id: &str| {
        let mut issue = json!({"ruleId":rule,"path":path,"message":message});
        if !id.is_empty() {
            issue["nodeId"] = json!(id)
        }
        out.push(issue);
    };
    for (i, n) in list(&raw["graph"], "nodes").iter().enumerate() {
        let base = format!("/graph/nodes/{i}");
        let scenario = &n["resilienceScenario"];
        if n["kind"] == "test" && n["testType"] == "resilience" && scenario.is_object() {
            let base = format!("{base}/resilienceScenario");
            let steady = &scenario["steadyState"];
            let mut names = HashSet::new();
            let mut tuples = HashSet::new();
            for (j, slo) in list(steady, "slos")
                .iter()
                .enumerate()
                .filter(|(_, s)| s.is_object())
            {
                let p = format!("{base}/steadyState/slos/{j}");
                if slo["name"].as_str().is_some_and(|name| !names.insert(name)) {
                    add(
                        "REL-SEM-001",
                        format!("{p}/name"),
                        "SLO names must be unique",
                        id(n),
                    )
                }
                if !tuples.insert(
                    ["metricName", "semanticRole", "aggregation", "unit"].map(|k| slo[k].as_str()),
                ) {
                    add(
                        "REL-SEM-002",
                        p.clone(),
                        "metricName/semanticRole/aggregation/unit SLO tuples must be unique",
                        id(n),
                    )
                }
                if slo["metricName"]
                    .as_str()
                    .is_some_and(|m| !contains(&steady["requiredMetrics"], m))
                {
                    add(
                        "REL-SEM-003",
                        format!("{p}/metricName"),
                        "every SLO metric must be present in requiredMetrics",
                        id(n),
                    )
                }
                let target = &slo["target"];
                if target["targetType"] == "range" && num(target, "min") >= num(target, "max") {
                    add(
                        "REL-SEM-004",
                        format!("{p}/target"),
                        "SLO range min must be less than max",
                        id(n),
                    )
                }
            }
            let mut ids = HashSet::new();
            if list(scenario, "abortConditions")
                .iter()
                .filter_map(|c| c["id"].as_str())
                .any(|id| !ids.insert(id))
            {
                add(
                    "REL-SEM-005",
                    format!("{base}/abortConditions"),
                    "abort condition IDs must be unique",
                    id(n),
                )
            }
        }
        if n["kind"] == "execution_evidence" && n["evidenceType"] == "resilience" {
            if n["passed"].is_boolean()
                && n["status"].is_string()
                && (flag(n, "passed") != (n["status"] == "pass"))
            {
                add(
                    "REL-SEM-007",
                    format!("{base}/passed"),
                    "passed must agree with the canonical status when present",
                    id(n),
                )
            }
            let mut ids = HashSet::new();
            if ["metrics", "traces", "logs"]
                .into_iter()
                .flat_map(|k| list(&n["signalManifest"], k))
                .filter_map(|s| s["id"].as_str())
                .any(|id| !ids.insert(id))
            {
                add(
                    "REL-SEM-006",
                    format!("{base}/signalManifest"),
                    "signal entry IDs must be unique across metrics, traces, and logs",
                    id(n),
                )
            }
        }
    }
    let policy = &raw["policy"]["reliabilityPolicy"];
    if policy["requiredEnvironment"]
        .as_str()
        .is_some_and(|e| !contains(&policy["safety"]["allowedEnvironments"], e))
    {
        add(
            "REL-SEM-008",
            "/policy/reliabilityPolicy/requiredEnvironment".into(),
            "requiredEnvironment must be included in safety.allowedEnvironments",
            "",
        )
    }
    out.sort_by(|a, b| {
        ["path", "ruleId", "nodeId"]
            .iter()
            .map(|k| field(a, k))
            .cmp(["path", "ruleId", "nodeId"].iter().map(|k| field(b, k)))
    });
    out
}
