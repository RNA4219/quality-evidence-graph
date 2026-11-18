use super::*;
fn label(v: &Value, fallback: &str) -> String {
    match v {
        Value::String(x) => x.clone(),
        Value::Null => fallback.to_string(),
        _ => v.to_string(),
    }
}
fn or_none(v: &Value) -> String {
    let text = join_values(v, ", ");
    if text.is_empty() { "none".into() } else { text }
}
fn refs(v: &Value) -> String {
    let rows = items(v)
        .iter()
        .map(|v| {
            ["id", "path", "label"]
                .iter()
                .filter_map(|k| v[*k].as_str())
                .collect::<Vec<_>>()
                .join(" ")
        })
        .collect::<Vec<_>>();
    if rows.is_empty() {
        "none".into()
    } else {
        rows.join("; ")
    }
}
fn rate(v: &Value) -> String {
    v.as_f64()
        .map(|n| format!("{:.2}%", n * 100.0))
        .unwrap_or("n/a".into())
}
pub fn execution_summary(a: &Value) -> Vec<String> {
    if !a.is_object() {
        return vec![];
    }
    let mut lines = vec![
        "".to_string(),
        "実行証跡の採用".into(),
        format!("- 評価時計: {}", s(&a["evaluatedAt"])),
    ];
    if let Some(t) = a.get("target").filter(|v| v.is_object()) {
        lines.push(format!(
            "- 対象: {} / {} / {} / {}",
            s(&t["projectId"]),
            s(&t["buildId"]),
            s(&t["environmentId"]),
            s(&t["revision"])
        ));
    }
    for sel in items(&a["selections"]) {
        lines.push(format!(
            "- {}: run={}; evidence={}; status={}; reason={}; consecutivePasses={}",
            s(&sel["testId"]),
            label(&sel["selectedRunId"], "none"),
            label(&sel["selectedEvidenceId"], "none"),
            label(&sel["selectedStatus"], "none"),
            s(&sel["reason"]),
            sel["consecutivePasses"]
        ));
        for e in items(&sel["excluded"]) {
            lines.push(format!(
                "  - excluded={}; reason={}",
                s(&e["evidenceId"]),
                s(&e["reason"])
            ));
        }
    }
    lines
}
fn reliability(lines: &mut Vec<String>, t: &Value) {
    lines.extend(execution_summary(&t["executionAccounting"]));
    let r = &t["reliability"];
    lines.push(format!("- {}", s(&t["target"])));
    lines.push(format!("  enabled: {}", r["enabled"]));
    if r["enabled"] != true {
        return;
    }
    lines.extend([
        format!(
            "  risk coverage: {}/{} ({})",
            r["qualifiedRiskCount"],
            r["requiredRiskCount"],
            rate(&r["riskCoverageRate"])
        ),
        format!(
            "  executions required/qualified/passing: {}/{}/{}",
            r["requiredExecutionCount"], r["qualifiedExecutionCount"], r["passingExecutionCount"]
        ),
        format!(
            "  execution pass rate: {}/{} ({})",
            r["passingExecutionCount"],
            r["qualifiedExecutionCount"],
            rate(&r["resiliencePassRate"])
        ),
        format!(
            "  recovery seconds p50/p95/sample: {}/{}/{}",
            label(&r["recoverySecondsP50"], "n/a"),
            label(&r["recoverySecondsP95"], "n/a"),
            r["recoverySampleCount"]
        ),
        format!(
            "  duplicate side effects/data inconsistencies: {}/{}",
            r["duplicateSideEffectsCount"], r["dataInconsistenciesCount"]
        ),
    ]);
    let mut ages = r["evidenceAgeHours"]
        .as_object()
        .into_iter()
        .flatten()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>();
    ages.sort();
    lines.push(format!(
        "  evidence age hours: {}",
        if ages.is_empty() {
            "none".to_owned()
        } else {
            ages.join(", ")
        }
    ));
    let mocks: Vec<_> = items(&r["excludedMockTests"])
        .iter()
        .map(|x| s(&x["testId"]))
        .collect();
    lines.push(format!(
        "  excluded mock tests: {}",
        if mocks.is_empty() {
            "none".to_owned()
        } else {
            mocks.join(", ")
        }
    ));
    lines.push(format!(
        "  DQ counts: {}",
        r["dqCountByRule"]
            .as_object()
            .into_iter()
            .flatten()
            .map(|(k, v)| format!("{k}={v}"))
            .collect::<Vec<_>>()
            .join(", ")
    ));
    for x in items(&r["drillDown"]) {
        let mut cols = vec![];
        for (name, k) in [
            ("risk", "riskId"),
            ("test", "testId"),
            ("evidence", "selectedEvidenceId"),
            ("adapter", "adapter"),
            ("experiment", "experimentId"),
            ("attempt", "attempt"),
            ("revision", "targetRevision"),
            ("environment", "environmentId"),
            ("reason", "selectionReason"),
            ("exclusion", "exclusionReason"),
        ] {
            cols.push(format!("{name}={}", label(&x[k], "none")));
        }
        for (name, k) in [("DQs", "disqualificationCodes"), ("blockers", "blockerIds")] {
            let ids = join_values(&x[k], ",");
            cols.push(format!(
                "{name}={}",
                if ids.is_empty() { "none" } else { &ids }
            ));
        }
        lines.push(format!("  selection: {}", cols.join(" ")));
    }
}
fn detail(lines: &mut Vec<String>, t: &Value, markdown: bool) {
    if markdown {
        let v = t["verdict"]
            .as_str()
            .map(|x| format!(" / {x}"))
            .unwrap_or_default();
        lines.push(format!("- {}: {}{v}", s(&t["target"]), s(&t["status"])));
        if let Some(e) = t["error"].as_str() {
            lines.push(format!("  - {e}"));
        }
        for d in items(&t["disqualifications"]) {
            lines.push(format!("  - {}: {}", s(&d["code"]), s(&d["message"])));
        }
        return;
    }
    lines.push(format!("- {}", s(&t["target"])));
    lines.push(format!("  status: {}", s(&t["status"])));
    if let Some(v) = t["verdict"].as_str() {
        lines.push(format!("  verdict: {v} (exit {})", t["exitCode"]));
    } else {
        lines.push(format!("  exit: {}", t["exitCode"]));
    }
    if let Some(e) = t["error"].as_str() {
        lines.push(format!("  error: {e}"));
    }
    for r in items(&t["reasons"]) {
        lines.push(format!("  reason: {}", s(r)));
    }
    for (k, id, prefix, links, linklabel) in [
        ("disqualifications", "code", "DQ", "nodeIds", "nodes"),
        ("blockers", "id", "blocker", "riskIds", "risks"),
    ] {
        for d in items(&t[k]) {
            lines.push(format!("  {prefix} {}: {}", s(&d[id]), s(&d["message"])));
            lines.push(format!("    {linklabel}: {}", or_none(&d[links])));
            lines.push(format!("    sourceRefs: {}", refs(&d["sourceRefs"])));
        }
    }
    for (k, name) in [
        ("residualRisks", "residual risks"),
        ("requiredHumanReview", "required human review"),
    ] {
        if !items(&t[k]).is_empty() {
            lines.push(format!("  {name}: {}", join_values(&t[k], ", ")));
        }
    }
    let e = &t["expected"];
    if e["validationPassed"] == false {
        lines.push("  Expected comparison:".into());
        lines.push(format!("  - fixture: {}", s(&e["fixture"])));
        for (k, name) in [
            ("verdictMatch", "verdict"),
            ("exitCodeMatch", "exit code"),
            ("dqMatch", "DQ"),
        ] {
            lines.push(format!(
                "  - {name} match: {}",
                if e[k] == true { "PASS" } else { "FAIL" }
            ));
        }
        for (k, name) in [
            ("unexpectedDqCodes", "unexpected DQ codes"),
            ("missingDqCodes", "missing expected DQ codes"),
        ] {
            if !items(&e[k]).is_empty() {
                lines.push(format!("  - {name}: {}", join_values(&e[k], ", ")));
            }
        }
    }
}
pub(super) fn report(r: &Value, md: bool) -> String {
    let sum = &r["summary"];
    let rows = items(&r["targets"]);
    let mut lines = vec![];
    if md {
        lines.extend(["## QEG CI Report".into(), "".into()]);
    } else {
        let pass = sum["cliErrors"] == 0 && sum["gateFailed"] == 0;
        lines.extend([
            "Quality Evidence Graph CI Report".into(),
            format!("Generated at: {}", s(&r["generatedAt"])),
            format!("Overall: {}", if pass { "PASS" } else { "FAIL" }),
            "".into(),
            "Summary".into(),
        ]);
    }
    for (k, name) in [
        ("totalTargets", "targets"),
        ("passed", "passed"),
        ("baselineAccepted", "baseline accepted"),
        ("gateFailed", "gate failed"),
        ("cliErrors", "cli errors"),
        ("blockerCount", "blockers"),
        ("residualRiskCount", "residual risks"),
        ("humanReviewCount", "required human review"),
    ] {
        lines.push(format!("- {name}: {}", sum[k]));
    }
    for e in items(&r["errors"]) {
        lines.push(format!("- {}: {}", s(&e["code"]), s(&e["message"])));
    }
    for t in rows {
        if let Some(scope) = t.get("evaluationScope") {
            lines.push(format!(
                "{}: {} / {}",
                if md { "- scope" } else { "Scope" },
                s(&scope["kind"]),
                s(&scope["target"])
            ));
            let n = join_values(&scope["notEvaluated"], ", ");
            lines.push(format!(
                "{}: {}",
                if md {
                    "- not evaluated"
                } else {
                    "Not evaluated"
                },
                if n.is_empty() { "none declared" } else { &n }
            ));
        }
    }
    if !rows.is_empty() {
        lines.push("".into());
        lines.push(if md { "### Reliability" } else { "Reliability" }.into());
        for t in rows {
            reliability(&mut lines, t);
        }
    }
    if !items(&sum["dqCounts"]).is_empty() {
        lines.push("".into());
        lines.push(
            if md {
                "### Disqualifications"
            } else {
                "Disqualification summary"
            }
            .into(),
        );
        for d in items(&sum["dqCounts"]) {
            if md {
                lines.push(format!(
                    "- {}: {} - {}",
                    s(&d["code"]),
                    d["count"],
                    s(&d["remediation"])
                ));
            } else {
                lines.push(format!("- {}: {}", s(&d["code"]), d["count"]));
                lines.push(format!("  remediation: {}", s(&d["remediation"])));
            }
        }
    }
    if let Some(diff) = r.get("diff") {
        lines.push("".into());
        lines.push(if md { "### Diff" } else { "Diff summary" }.into());
        lines.push(format!("- previous report: {}", s(&diff["previousReport"])));
        for k in ["new", "resolved", "unchanged", "unverified"] {
            lines.push(format!("- {k} DQs: {}", items(&diff[k]).len()));
        }
        for k in ["new", "resolved", "unverified"] {
            for d in items(&diff[k]) {
                lines.push(format!(
                    "  {k} {}: {} - {}",
                    s(&d["code"]),
                    s(&d["target"]),
                    s(&d[if k == "unverified" {
                        "reason"
                    } else {
                        "message"
                    }])
                ));
            }
        }
    }
    for base in [false, true] {
        let filtered: Vec<_> = rows
            .iter()
            .filter(|t| {
                if base {
                    t["status"] == "baseline_accepted"
                } else {
                    t["status"] == "gate_failed" || t["status"] == "cli_error"
                }
            })
            .collect();
        if filtered.is_empty() {
            continue;
        }
        lines.push("".into());
        lines.push(
            match (md, base) {
                (true, true) => "### Baseline accepted targets",
                (true, false) => "### Targets",
                (false, true) => "Baseline accepted targets",
                (false, false) => "Target details",
            }
            .into(),
        );
        for t in filtered {
            detail(&mut lines, t, md);
        }
    }
    lines.join("\n") + "\n"
}
