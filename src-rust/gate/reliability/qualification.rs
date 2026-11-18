use super::*;

pub(super) fn matches_slo(m: &Value, slo: &Value) -> bool {
    ["metricName", "semanticRole", "aggregation", "unit"]
        .iter()
        .all(|k| m[k] == slo[k])
        && (slo["semanticRole"] != "custom"
            || slo["customSemanticRoleName"] == m["customSemanticRoleName"])
}
fn bounds(slo: &Value) -> (f64, f64) {
    let t = &slo["target"];
    match field(t, "targetType") {
        "min" => (num(t, "value"), f64::INFINITY),
        "max" => (f64::NEG_INFINITY, num(t, "value")),
        _ => (num(t, "min"), num(t, "max")),
    }
}
pub(super) fn satisfied(m: &Value, slo: &Value) -> bool {
    let (min, max) = bounds(slo);
    (min..=max).contains(&num(m, "observedValue"))
}
fn policy_bound(t: &Value, role: &str, phase: &str) -> Option<(f64, f64)> {
    let k = match (role, phase) {
        ("traffic_count", "fault") => return Some((num(t, "minRequestCount"), f64::INFINITY)),
        ("error_rate", "fault") => "maxErrorRate",
        ("latency_p95", "fault") => "maxLatencyP95Ms",
        ("saturation", "fault") => "maxSaturationPct",
        ("duplicate_side_effects", "experiment") => "maxDuplicateSideEffects",
        ("data_inconsistencies", "experiment") => "maxDataInconsistencies",
        _ => return None,
    };
    Some((f64::NEG_INFINITY, num(t, k)))
}
fn scenario(policy: &Value, t: &Value) -> Vec<String> {
    let mut out = vec![];
    for slo in list(&t["resilienceScenario"]["steadyState"], "slos") {
        let name = field(slo, "name");
        let (min, max) = bounds(slo);
        if flag(policy, "requireRecoveryObservation")
            && !contains(&slo["evaluationPhases"], "recovery")
        {
            out.push(format!("SLO {name} omits recovery phase"))
        }
        for phase in strings(&slo["evaluationPhases"]) {
            if policy_bound(&policy["thresholds"], field(slo, "semanticRole"), phase)
                .is_some_and(|(a, b)| min.max(a) > max.min(b))
            {
                out.push(format!(
                    "SLO {name} conflicts with the effective policy threshold in {phase}"
                ))
            }
        }
    }
    out
}
fn lifecycle(c: &Context, t: &Value, e: &Value) -> Vec<String> {
    let mut reasons = vec![];
    let policy = &c.policy["reliabilityPolicy"];
    let sc = &t["resilienceScenario"];
    let start = ms(e, "startedAt");
    let end = ms(e, "endedAt");
    let clock = ms(c.meta, "createdAt");
    if !start.is_finite() || !end.is_finite() || start > end || end > clock {
        reasons.push("invalid or future execution timestamps")
    }
    if clock - end > num(policy, "maxEvidenceAgeHours") * 3600000. {
        reasons.push("evidence exceeds maximum age")
    }
    if e["environment"] != policy["requiredEnvironment"]
        || e["environment"] != sc["blastRadius"]["environment"]
    {
        reasons.push("environment differs from policy or scenario")
    }
    let required = qual_required(e);
    let f = &e["fault"];
    let fs = ms(f, "faultStartedAt");
    let fe = ms(f, "faultEndedAt");
    if required && flag(policy, "requireSteadyStateBeforeFault") && !flag(e, "steadyStateConfirmed")
    {
        reasons.push("steady state is not confirmed")
    }
    if required && (f.is_null() || f["type"] != sc["faultModel"]) {
        reasons.push("fault is absent or differs from scenario")
    }
    if required && !f.is_null() {
        if !fs.is_finite() || !fe.is_finite() || fs < start || fe > end || fs > fe {
            reasons.push("fault interval is outside execution")
        }
        if fs.is_finite() && fe.is_finite() && num(f, "appliedDurationMs") != fe - fs {
            reasons.push("appliedDurationMs differs from the fault interval")
        }
        if e.get("recoveryConfirmedAt").is_some() {
            let time = ms(e, "recoveryConfirmedAt");
            if !time.is_finite() || time < fe || time > end {
                reasons.push("recoveryConfirmedAt is outside the recovery interval")
            }
            if e.get("recoveryDurationMs").is_some()
                && time.is_finite()
                && num(e, "recoveryDurationMs") != time - fe
            {
                reasons.push("recoveryDurationMs differs from the measured recovery interval")
            }
        }
    }
    let rec = &e["abortRecord"];
    if e["status"] == "aborted" {
        let cond = list(sc, "abortConditions")
            .iter()
            .find(|x| x["id"] == rec["conditionId"]);
        let resolved = [
            ("metrics", "metric"),
            ("traces", "trace_count"),
            ("logs", "log_count"),
        ]
        .into_iter()
        .find_map(|(k, kind)| {
            list(&e["signalManifest"], k)
                .iter()
                .find(|s| s["id"] == rec["signalEntryId"])
                .map(|entry| (kind, entry))
        });
        if let (Some(condition), Some((kind, entry))) = (cond, resolved) {
            let value = if entry.get("observedValue").is_some() {
                num(entry, "observedValue")
            } else {
                num(entry, "matchedCount")
            };
            let signal = entry.get("metricName").unwrap_or(&entry["signalName"]);
            if condition["source"] != kind
                || signal != &condition["signal"]
                || condition["aggregation"] != entry["aggregation"].as_str().unwrap_or("count")
                || rec["unit"] != condition["unit"]
                || entry.get("unit").is_some_and(|v| v != &condition["unit"])
            {
                reasons.push("abort signal contract differs from its condition")
            }
            let limit = num(condition, "threshold");
            let triggered = match field(condition, "operator") {
                "gt" => value > limit,
                "gte" => value >= limit,
                "lt" => value < limit,
                "lte" => value <= limit,
                "eq" => value == limit,
                "ne" => value != limit,
                _ => false,
            };
            if num(rec, "observedValue") != value || !triggered {
                reasons.push("abort observed value does not trigger its condition")
            }
            let time = ms(rec, "triggeredAt");
            if !time.is_finite()
                || time < ms(entry, "windowStart")
                || time > ms(entry, "windowEnd")
                || time < fs
                || time > fe
            {
                reasons.push("abort timestamp is outside signal or fault windows")
            }
        } else {
            reasons.push("abort record, condition, or signal entry is absent")
        }
    } else if !rec.is_null() {
        reasons.push("non-aborted evidence contains an abort record")
    }
    reasons.into_iter().map(str::to_owned).collect()
}
const OBSERVED: [(&str, &str, &str, &str, &str); 6] = [
    ("requestCount", "fault", "traffic_count", "count", "count"),
    ("errorRate", "fault", "error_rate", "rate", "ratio"),
    ("latencyP95Ms", "fault", "latency_p95", "p95", "ms"),
    ("saturationPct", "fault", "saturation", "max", "percent"),
    (
        "duplicateSideEffects",
        "experiment",
        "duplicate_side_effects",
        "count",
        "count",
    ),
    (
        "dataInconsistencies",
        "experiment",
        "data_inconsistencies",
        "count",
        "count",
    ),
];
fn signals(c: &Context, t: &Value, e: &Value) -> Vec<String> {
    let policy = &c.policy["reliabilityPolicy"];
    let mut reasons = vec![];
    let sc = &t["resilienceScenario"];
    let steady = &sc["steadyState"];
    let manifest = &e["signalManifest"];
    let required = qual_required(e);
    let refs: HashMap<_, _> = list(e, "evidenceRefs").iter().map(|r| (id(r), r)).collect();
    if refs.len() != list(e, "evidenceRefs").len() {
        reasons.push("signal evidenceRef IDs are not unique".into())
    }
    let start = ms(e, "startedAt");
    let end = ms(e, "endedAt");
    let fs = ms(&e["fault"], "faultStartedAt");
    let fe = ms(&e["fault"], "faultEndedAt");
    let re = ms(e, "recoveryConfirmedAt");
    let clock = ms(c.meta, "createdAt");
    for (key, kind) in [
        ("metrics", "observability_metric"),
        ("traces", "observability_trace"),
        ("logs", "observability_log"),
    ] {
        for entry in list(manifest, key) {
            let eid = id(entry);
            let r = refs.get(field(entry, "evidenceRefId"));
            if r.is_none_or(|r| {
                !nonblank(&r["contentHash"])
                    || r["revision"] != e["targetRevision"]
                    || r["evidenceKind"] != kind
            }) {
                reasons.push(format!(
                    "signal {eid} has no matching hash-backed {kind} reference"
                ))
            }
            let a = ms(entry, "windowStart");
            let b = ms(entry, "windowEnd");
            if !a.is_finite() || !b.is_finite() || a < start || b > end || a > b {
                reasons.push(format!("signal {eid} has an invalid execution window"))
            }
            match field(entry, "phase") {
                "steady_state" if b > fs => {
                    reasons.push(format!("signal {eid} exceeds the steady-state window"))
                }
                "fault" if fs.is_finite() && fe.is_finite() && (a < fs || b > fe) => {
                    reasons.push(format!("signal {eid} is outside the fault window"))
                }
                "recovery" if re.is_finite() && fe.is_finite() && (a < fe || b > re) => {
                    reasons.push(format!("signal {eid} is outside the recovery window"))
                }
                _ => (),
            }
            if r.is_some_and(|r| {
                let cap = ms(r, "capturedAt");
                !cap.is_finite() || cap < b || cap > clock
            }) {
                reasons.push(format!("signal {eid} has an invalid capturedAt"))
            }
        }
    }
    let metrics = list(manifest, "metrics");
    if required {
        if flag(&policy["requiredSignals"], "metrics") && metrics.is_empty() {
            reasons.push("policy requires metrics".into())
        }
        for name in strings(&steady["requiredMetrics"]) {
            if !metrics
                .iter()
                .any(|m| m["metricName"] == name && m["phase"] == "steady_state")
            {
                reasons.push(format!("required steady-state metric {name} is missing"))
            }
        }
        for slo in list(steady, "slos") {
            for phase in strings(&slo["evaluationPhases"]) {
                if !metrics
                    .iter()
                    .any(|m| matches_slo(m, slo) && m["phase"] == phase)
                {
                    reasons.push(format!(
                        "SLO {} has no exact {phase} signal",
                        field(slo, "name")
                    ))
                }
            }
        }
    }
    let mut groups = HashMap::new();
    if metrics.iter().any(|m| {
        groups
            .insert(
                [
                    "phase",
                    "semanticRole",
                    "customSemanticRoleName",
                    "aggregation",
                    "unit",
                ]
                .map(|k| field(m, k)),
                num(m, "observedValue"),
            )
            .is_some_and(|prior| prior != num(m, "observedValue"))
    }) {
        reasons.push("same-role signal measurements contain conflicting values".into())
    }
    if required {
        let phases = if flag(policy, "requireRecoveryObservation") {
            &["fault", "recovery"][..]
        } else {
            &["fault"]
        };
        for (entries, sk, name) in [
            ("traces", "requiredTraces", "trace"),
            ("logs", "requiredLogs", "log"),
        ] {
            if (flag(&policy["requiredSignals"], entries) || flag(steady, sk))
                && phases.iter().any(|phase| {
                    !list(manifest, entries)
                        .iter()
                        .any(|e| e["phase"] == *phase && num(e, "matchedCount") > 0.)
                })
            {
                reasons.push(format!("required {name} phases are missing or empty"))
            }
        }
        for cond in list(sc, "abortConditions") {
            let signal = field(cond, "signal");
            match field(cond, "source") {
                "metric"
                    if !metrics.iter().any(|m| {
                        m["phase"] == "fault"
                            && m["metricName"] == signal
                            && m["aggregation"] == cond["aggregation"]
                            && m["unit"] == cond["unit"]
                    }) =>
                {
                    reasons.push(format!("abort metric {signal} is missing"))
                }
                "trace_count" | "log_count" => {
                    let (k, name) = if cond["source"] == "trace_count" {
                        ("traces", "trace")
                    } else {
                        ("logs", "log")
                    };
                    if !list(manifest, k).iter().any(|m| {
                        m["phase"] == "fault"
                            && m["signalName"] == signal
                            && num(m, "matchedCount") > 0.
                    }) {
                        reasons.push(format!("abort {name} {signal} is missing or empty"))
                    }
                }
                _ => (),
            }
        }
    }
    let observed = &e["observed"];
    if required && observed.is_null() {
        reasons.push("observed summary is missing".into())
    }
    if !observed.is_null() {
        for (key, phase, role, aggr, unit) in OBSERVED {
            let matches: Vec<_> = metrics
                .iter()
                .filter(|m| {
                    m["phase"] == phase
                        && m["semanticRole"] == role
                        && m["aggregation"] == aggr
                        && m["unit"] == unit
                })
                .collect();
            let Some(first) = matches.first() else {
                reasons.push(format!("observed {key} has no canonical signal"));
                continue;
            };
            if matches
                .iter()
                .any(|m| num(m, "observedValue") != num(first, "observedValue"))
            {
                reasons.push(format!("observed {key} has conflicting signal values"))
            }
            if first.get("observedValue").is_some()
                && num(first, "observedValue") != num(observed, key)
            {
                reasons.push(format!("observed {key} differs from signal manifest"))
            }
        }
    }
    reasons
}
pub(super) fn qualify(c: &Context, t: &Value, e: &Value, classes: &FailureClasses) -> Vec<Value> {
    let rev = revision(c, e, classes);
    if !rev.is_empty() {
        return rev;
    }
    let policy = &c.policy["reliabilityPolicy"];
    let issues = scenario(policy, t);
    if !issues.is_empty() {
        return vec![rel_dq(
            "DQ-18",
            format!(
                "Resilience scenario is incompatible with policy: {}",
                unique(issues).join("; ")
            ),
            vec![id(t)],
        )];
    }
    let ids = vec![id(e), id(t)];
    let issues = lifecycle(c, t, e);
    if !issues.is_empty() {
        return vec![rel_dq(
            "DQ-18",
            format!(
                "Resilience lifecycle invalid: {}",
                unique(issues).join("; ")
            ),
            ids,
        )];
    }
    if e["signalManifest"].is_null() {
        return if qual_required(e) || !e["observed"].is_null() {
            vec![rel_dq("DQ-20", "Resilience signalManifest is missing", ids)]
        } else {
            vec![]
        };
    }
    let issues = signals(c, t, e);
    if !issues.is_empty() {
        return vec![rel_dq(
            "DQ-20",
            format!("Resilience signals invalid: {}", unique(issues).join("; ")),
            ids,
        )];
    }
    if qual_required(e) {
        let violations: Vec<_> = list(&t["resilienceScenario"]["steadyState"], "slos")
            .iter()
            .filter(|slo| {
                contains(&slo["evaluationPhases"], "steady_state")
                    && list(&e["signalManifest"], "metrics").iter().any(|m| {
                        m["phase"] == "steady_state" && matches_slo(m, slo) && !satisfied(m, slo)
                    })
            })
            .map(|s| field(s, "name"))
            .collect();
        if !violations.is_empty() {
            return vec![rel_dq(
                "DQ-18",
                format!(
                    "Steady-state SLO is not satisfied: {}",
                    violations.join(", ")
                ),
                ids,
            )];
        }
    }
    vec![]
}
