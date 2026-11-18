use super::*;
use std::collections::BTreeMap;
mod qualification;
use qualification::{matches_slo, satisfied};

type FailureClasses<'a> = BTreeMap<&'a str, bool>; // true for revision-only failures
fn rel_ref() -> Value {
    json!({"id":"qeg:reliability-extension","path":"docs/spec/reliability-extension.md"})
}
fn rel_dq(code: &str, msg: impl Into<String>, mut ids: Vec<&str>) -> Value {
    ids.sort();
    dq(code, msg, json!(ids), json!([rel_ref()]))
}
fn qual_required(e: &Value) -> bool {
    matches!(field(e, "status"), "pass" | "fail" | "aborted")
}
fn passing(e: &Value) -> bool {
    e["status"] == "pass" && e["passed"] != false
}
fn ms(v: &Value, key: &str) -> f64 {
    timestamp_nanos(&v[key]).map_or(f64::NAN, |n| n.div_euclid(1_000_000) as f64)
}
fn preflight(c: &Context, classes: &FailureClasses) -> Vec<Value> {
    let pre = list(c.input, "preflightDisqualifications");
    let mut out = vec![];
    if !pre.iter().any(|d| d["code"] == "DQ-01") && timestamp_nanos(&c.meta["createdAt"]).is_some()
    {
        for issue in reliability_semantics(c.input) {
            out.push(rel_dq(
                "DQ-01",
                format!(
                    "[{}] {} at {}",
                    field(&issue, "ruleId"),
                    field(&issue, "message"),
                    field(&issue, "path")
                ),
                issue["nodeId"].as_str().into_iter().collect(),
            ))
        }
    }
    let verified = &c.input["evidenceVerification"];
    let prior = pre.iter().any(|d| d["code"] == "DQ-06");
    if verified.is_null() {
        out.push(rel_dq(
            "DQ-06",
            "Reliability policy is enabled but artifact verification report is missing",
            vec![],
        ))
    } else {
        for (&id, &revision) in classes {
            if revision {
                out.push(rel_dq(
                    "DQ-12",
                    format!("Artifact revision mismatch for {id}"),
                    vec![id],
                ))
            } else if !prior {
                out.push(rel_dq(
                    "DQ-06",
                    format!("Artifact verification failed for {id}"),
                    vec![id],
                ))
            }
        }
        if verified["status"] == "fail" && classes.is_empty() && !prior {
            out.push(rel_dq(
                "DQ-06",
                "Artifact verification failed without a classified artifact diagnostic",
                vec![],
            ))
        }
    }
    let g = &c.input["graph"]["metadata"];
    let rev = &c.meta["headRef"];
    if !execution::full_revision(rev)
        || s(rev).bytes().any(|b| b.is_ascii_uppercase())
        || !execution::valid_hash(&c.policy["policyHash"])
        || !matches!(
            field(c.policy, "profile"),
            "standard" | "strict" | "ipo_controlled"
        )
        || ["DQ-18", "DQ-19", "DQ-20", "DQ-21"]
            .iter()
            .any(|d| !contains(&c.policy["dqScope"], d))
        || &g["headRef"] != rev
        || ["profile", "policyId", "policyHash"]
            .iter()
            .any(|k| c.policy[k] != g[k] || c.policy[k] != c.meta[k])
    {
        out.push(rel_dq("DQ-21","Reliability policy identity, SHA-256 hash, profile, DQ scope, or full revision is invalid or does not match across Gate, graph, and policy",vec![]))
    }
    out
}
fn revision(c: &Context, e: &Value, classes: &FailureClasses) -> Vec<Value> {
    let mut why = vec![];
    let head = &c.meta["headRef"];
    if head.is_null() || &e["targetRevision"] != head {
        why.push("targetRevision".into())
    }
    let raw = &e["rawArtifactRef"];
    if &raw["revision"] != head && !classes.contains_key(id(raw)) {
        why.push("rawArtifactRef.revision".into())
    }
    for r in list(e, "evidenceRefs") {
        if &r["revision"] != head && !classes.contains_key(id(r)) {
            why.push(format!("evidenceRef:{}", id(r)))
        }
    }
    if why.is_empty() {
        vec![]
    } else {
        vec![rel_dq(
            "DQ-12",
            format!("Resilience evidence revision mismatch ({})", why.join(", ")),
            vec![id(e)],
        )]
    }
}
fn decision(e: &Value) -> Value {
    let mut semantic = e.clone();
    if let Some(map) = semantic.as_object_mut() {
        for k in ["id", "title", "traceability", "sourceArtifactIds"] {
            map.remove(k);
        }
    }
    semantic
}
struct Selection<'a> {
    evidence: Option<&'a Value>,
    dqs: Vec<Value>,
    exclusion: Option<&'static str>,
}
fn select<'a>(
    c: &Context<'a>,
    test: &Value,
    all: &[&'a Value],
    classes: &FailureClasses,
) -> Selection<'a> {
    let fail = |dqs, reason| Selection {
        evidence: None,
        dqs,
        exclusion: Some(reason),
    };
    let matching: Vec<_> = all
        .iter()
        .copied()
        .filter(|e| e["testId"] == test["id"])
        .collect();
    let current: Vec<_> = matching
        .iter()
        .copied()
        .filter(|e| e["targetRevision"] == c.meta["headRef"])
        .collect();
    if current.is_empty() {
        let mut dqs: Vec<_> = matching
            .iter()
            .flat_map(|e| revision(c, e, classes))
            .collect();
        if dqs.is_empty() {
            dqs.push(rel_dq(
                "DQ-18",
                "No current resilience evidence exists for required test",
                vec![id(test)],
            ))
        }
        return fail(dqs, "no_current_real_evidence");
    }
    let invalid: Vec<_> = current
        .iter()
        .filter(|e| !ms(e, "endedAt").is_finite())
        .map(|e| id(e))
        .collect();
    if !invalid.is_empty() {
        return fail(
            vec![rel_dq(
                "DQ-18",
                "Current resilience evidence has an invalid endedAt timestamp",
                invalid,
            )],
            "invalid_current_timestamp",
        );
    }
    let mut groups: indexmap::IndexMap<_, Vec<&Value>> = indexmap::IndexMap::new();
    for &e in &current {
        groups
            .entry((
                field(e, "adapter"),
                field(e, "experimentId"),
                e["attempt"].as_u64(),
                field(e, "targetRevision"),
            ))
            .or_default()
            .push(e)
    }
    for group in groups.values() {
        if group.len() > 1 && group[1..].iter().any(|e| decision(e) != decision(group[0])) {
            return fail(
                vec![rel_dq(
                    "DQ-19",
                    "Current resilience evidence reuses an execution identity with conflicting decision fingerprints",
                    group.iter().map(|e| id(e)).collect(),
                )],
                "ambiguous_execution_identity",
            );
        }
    }
    let end = current
        .iter()
        .map(|e| ms(e, "endedAt"))
        .fold(f64::NEG_INFINITY, f64::max);
    let newest = current
        .iter()
        .copied()
        .filter(|e| ms(e, "endedAt") == end)
        .collect::<Vec<_>>();
    if newest[1..]
        .iter()
        .any(|e| decision(e) != decision(newest[0]))
    {
        return fail(
            vec![rel_dq(
                "DQ-19",
                "Latest current resilience evidence has conflicting decision fingerprints",
                newest.iter().map(|e| id(e)).collect(),
            )],
            "ambiguous_latest_evidence",
        );
    }
    let mut contradictions = BTreeSet::new();
    for &e in &newest {
        let from: BTreeSet<_> = c
            .edges
            .iter()
            .filter(|edge| edge["kind"] == "evidenced_by" && edge["to"] == e["id"])
            .map(|edge| field(edge, "from"))
            .collect();
        if !from.is_empty()
            && (from.len() != 1 || !from.contains(id(test)) || c.node(id(test))["kind"] != "test")
        {
            contradictions.insert(id(e));
            contradictions.insert(id(test));
            contradictions.extend(from)
        }
    }
    let mut sel = Selection {
        evidence: Some(newest[0]),
        dqs: vec![],
        exclusion: None,
    };
    if !contradictions.is_empty() {
        sel.dqs.push(rel_dq(
            "DQ-18",
            "Latest resilience evidence has evidenced_by provenance that contradicts testId",
            contradictions.into_iter().collect(),
        ));
        sel.exclusion = Some("contradictory_evidenced_by_provenance")
    }
    sel
}
fn blocker(c: &Context, rule: &str, risk: &str, t: &Value, e: &Value, msg: &str) -> Value {
    let waiver = if rule == "04" {
        None
    } else {
        c.waivers
            .iter()
            .find(|w| contains(&w["linkedRiskIds"], risk) && contains(&w["linkedTestIds"], id(t)))
    };
    let mut sources = BTreeMap::new();
    let r = rel_ref();
    for sr in std::iter::once(&r)
        .chain(list(&c.policy["reliabilityPolicy"], "sourceRefs"))
        .chain(list(&t["traceability"], "sourceRefs"))
        .chain(list(&e["traceability"], "sourceRefs"))
    {
        sources.insert((id(sr), field(sr, "path")), sr);
    }
    let mut b = json!({
        "id": format!("blocker:rel:{rule}:{risk}:{}:{}", id(t), id(e)),
        "message": msg, "riskIds": [risk], "sourceRefs": sources.into_values().collect::<Vec<_>>(),
        "ruleId": format!("BLK-REL-{rule}"), "testId": id(t), "evidenceId": id(e),
        "effective": waiver.is_none(),
    });
    if let Some(w) = waiver {
        b["waiverId"] = w["id"].clone()
    }
    b
}
fn safety(c: &Context, tests: &[&Value], all: &[&Value]) -> Vec<Value> {
    let mut out = vec![];
    let safety = &c.policy["reliabilityPolicy"]["safety"];
    if c.meta["headRef"].is_null() {
        return out;
    }
    for &e in all {
        let Some(t) = tests
            .iter()
            .find(|t| t["id"] == e["testId"] && t["testExecutionMode"] == "real")
        else {
            continue;
        };
        if e["targetRevision"] != c.meta["headRef"] {
            continue;
        }
        let blast = &t["resilienceScenario"]["blastRadius"];
        let f = &e["fault"];
        let targets = strings(&f["actualTargetIds"]);
        let unsafe_env = e["environment"] == "production"
            || !contains(&safety["allowedEnvironments"], field(e, "environment"))
            || e["environment"] != blast["environment"];
        let dur = num(f, "appliedDurationMs");
        let count = targets.len() as f64;
        if unsafe_env
            || f.is_object()
                && (count > num(safety, "maxBlastRadiusTargets")
                    || count > num(blast, "maxTargets")
                    || dur > num(safety, "maxFaultDurationSeconds") * 1000.
                    || dur > num(blast, "maxDurationSeconds") * 1000.
                    || targets
                        .iter()
                        .any(|id| !contains(&blast["allowedTargets"], id)))
        {
            let mut risks = strings(&t["coveredRiskIds"]);
            risks.sort();
            for risk in risks {
                out.push(blocker(
                    c,
                    "04",
                    risk,
                    t,
                    e,
                    "Safety policy violated by a current real resilience attempt",
                ))
            }
        }
    }
    out
}
fn blockers(c: &Context, risk: &str, t: &Value, e: &Value) -> Vec<Value> {
    let p = &c.policy["reliabilityPolicy"];
    let thr = &p["thresholds"];
    let obs = &e["observed"];
    let mut exceeded = num(obs, "requestCount") < num(thr, "minRequestCount")
        || [
            ("errorRate", "maxErrorRate"),
            ("latencyP95Ms", "maxLatencyP95Ms"),
            ("saturationPct", "maxSaturationPct"),
            ("duplicateSideEffects", "maxDuplicateSideEffects"),
            ("dataInconsistencies", "maxDataInconsistencies"),
        ]
        .iter()
        .any(|(k, max)| num(obs, k) > num(thr, max));
    let mut recovery = false;
    for slo in list(&t["resilienceScenario"]["steadyState"], "slos") {
        for m in list(&e["signalManifest"], "metrics").iter().filter(|m| {
            matches_slo(m, slo)
                && contains(&slo["evaluationPhases"], field(m, "phase"))
                && !satisfied(m, slo)
        }) {
            match field(m, "phase") {
                "fault" => exceeded = true,
                "recovery" => recovery = true,
                _ => (),
            }
        }
    }
    let mut out = vec![];
    if exceeded {
        out.push(blocker(
            c,
            "01",
            risk,
            t,
            e,
            "Resilience SLO threshold exceeded",
        ))
    }
    if qual_required(e)
        && flag(p, "requireRecoveryObservation")
        && (!flag(e, "recovered")
            || e["recoveryConfirmedAt"].is_null()
            || e["recoveryDurationMs"].is_null()
            || num(e, "recoveryDurationMs") > num(thr, "maxRecoverySeconds") * 1000.
            || recovery)
    {
        out.push(blocker(
            c,
            "02",
            risk,
            t,
            e,
            "Recovery is absent or exceeds the resilience threshold",
        ))
    }
    if !passing(e) {
        out.push(blocker(
            c,
            "03",
            risk,
            t,
            e,
            &format!("Resilience execution status is {}", field(e, "status")),
        ))
    }
    out
}
pub(super) fn assess(c: &Context) -> Assessment {
    let p = &c.policy["reliabilityPolicy"];
    if p.is_null() {
        return Assessment {
            accounting: json!({"enabled":false}),
            ..Default::default()
        };
    }
    let report = &c.input["evidenceVerification"];
    let mut classes = BTreeMap::new();
    for i in list(report, "items")
        .iter()
        .filter(|i| i["severity"] == "fail" && i["code"] != "VERIFIED")
    {
        let entry = classes.entry(field(i, "artifactId")).or_insert(true);
        *entry &= i["code"] == "REVISION_MISMATCH";
    }
    let mut dqs = preflight(c, &classes);
    let mut all_blockers = vec![];
    let mut tests = only(c.nodes, "test")
        .filter(|n| n["testType"] == "resilience")
        .collect::<Vec<_>>();
    tests.sort_by_key(|n| id(n));
    let mut risks = only(c.nodes, "risk")
        .filter(|r| contains(&p["requiredForSeverities"], field(r, "severity")))
        .collect::<Vec<_>>();
    risks.sort_by_key(|n| id(n));
    let mut all = only(c.nodes, "execution_evidence")
        .filter(|n| n["evidenceType"] == "resilience")
        .collect::<Vec<_>>();
    all.sort_by_key(|e| id(e));
    let mut selections = HashMap::new();
    let mut drill = vec![];
    let mut qualified_risks = HashSet::new();
    let mut passing_risks = HashSet::new();
    let mut emitted = HashSet::new();
    let mut selected = BTreeMap::new();
    for &r in &risks {
        let covered: Vec<_> = tests
            .iter()
            .filter(|t| !flag(t, "deleted") && contains(&t["coveredRiskIds"], id(r)))
            .copied()
            .collect();
        let real: Vec<_> = covered
            .iter()
            .filter(|t| t["testExecutionMode"] == "real")
            .copied()
            .collect();
        if real.is_empty() {
            let mocked = covered.iter().any(|t| t["testExecutionMode"] == "mock");
            dqs.push(rel_dq(
                "DQ-18",
                if mocked {
                    "Required risk has only mock resilience tests"
                } else {
                    "Required risk has no real resilience test"
                },
                vec![id(r)],
            ));
            continue;
        }
        let mut qualified = true;
        let mut passed = true;
        for t in real {
            let sel = selections.entry(id(t)).or_insert_with(|| {
                let mut sel = select(c, t, &all, &classes);
                if let Some(e) = sel.evidence {
                    sel.dqs.extend(qualification::qualify(c, t, e, &classes))
                }
                sel
            });
            if emitted.insert(id(t)) {
                dqs.extend(sel.dqs.iter().cloned())
            }
            let mut item = json!({"riskId":id(r),"testId":id(t)});
            let mut local = vec![];
            if let Some(e) = sel.evidence {
                selected.insert(id(t), e);
                item["selectedEvidenceId"] = e["id"].clone();
                for k in [
                    "adapter",
                    "experimentId",
                    "attempt",
                    "targetRevision",
                    "environmentId",
                ] {
                    if let Some(v) = e.get(k) {
                        item[k] = v.clone()
                    }
                }
                if sel.dqs.is_empty() {
                    local = blockers(c, id(r), t, e)
                }
                if !passing(e) || local.iter().any(|b| b["effective"] != false) {
                    passed = false
                }
            }
            if sel.evidence.is_none() || !sel.dqs.is_empty() {
                qualified = false;
                passed = false
            }
            item["selectionReason"] = json!(if sel.evidence.is_some() {
                "latest_current_execution"
            } else {
                "no_selectable_current_execution"
            });
            if let Some(reason) = sel.exclusion {
                item["exclusionReason"] = json!(reason)
            }
            item["disqualificationCodes"] = json!(
                sel.dqs
                    .iter()
                    .map(|d| field(d, "code"))
                    .collect::<BTreeSet<_>>()
            );
            item["blockerIds"] = json!(local.iter().map(id).collect::<Vec<_>>());
            all_blockers.extend(local);
            drill.push(item)
        }
        if qualified {
            qualified_risks.insert(id(r));
            if passed {
                passing_risks.insert(id(r));
            }
        }
    }
    let unsafe_blocks = safety(c, &tests, &all);
    for d in &mut drill {
        let mut ids: BTreeSet<_> = strings(&d["blockerIds"]).into_iter().collect();
        ids.extend(
            unsafe_blocks
                .iter()
                .filter(|b| {
                    b["testId"] == d["testId"] && contains(&b["riskIds"], field(d, "riskId"))
                })
                .map(id),
        );
        d["blockerIds"] = json!(ids)
    }
    all_blockers.extend(unsafe_blocks);
    all_blockers.sort_by(|a, b| {
        field(a, "ruleId")
            .cmp(field(b, "ruleId"))
            .then_with(|| strings(&a["riskIds"]).cmp(&strings(&b["riskIds"])))
            .then_with(|| {
                ["testId", "evidenceId", "id"]
                    .iter()
                    .map(|k| field(a, k))
                    .cmp(["testId", "evidenceId", "id"].iter().map(|k| field(b, k)))
            })
    });
    dqs.sort_by(|a, b| {
        field(a, "code")
            .cmp(field(b, "code"))
            .then_with(|| strings(&a["nodeIds"]).cmp(&strings(&b["nodeIds"])))
            .then_with(|| field(a, "message").cmp(field(b, "message")))
    });
    let global = report.is_null()
        || report["status"] == "fail"
        || list(c.input, "preflightDisqualifications")
            .iter()
            .any(|d| matches!(field(d, "code"), "DQ-01" | "DQ-06"))
        || timestamp_nanos(&c.meta["createdAt"]).is_none()
        || dqs
            .iter()
            .any(|d| d["code"] == "DQ-21" && list(d, "nodeIds").is_empty());
    if global {
        qualified_risks.clear();
        passing_risks.clear()
    }
    let mut summaries = selected.values().copied().collect::<Vec<_>>();
    summaries.sort_by_key(|e| id(e));
    let failed: HashSet<_> = dqs.iter().flat_map(|d| strings(&d["nodeIds"])).collect();
    let qualified: Vec<_> = summaries
        .iter()
        .copied()
        .filter(|e| !global && !failed.contains(id(e)) && !failed.contains(field(e, "testId")))
        .collect();
    let effective: Vec<_> = all_blockers
        .iter()
        .filter(|b| b["effective"] != false)
        .collect();
    for b in effective.iter().filter(|b| b["ruleId"] == "BLK-REL-04") {
        for r in strings(&b["riskIds"]) {
            passing_risks.remove(r);
        }
    }
    let passes = qualified
        .iter()
        .filter(|e| passing(e) && !effective.iter().any(|b| b["testId"] == e["testId"]))
        .count();
    let mut recovery = qualified
        .iter()
        .filter(|e| flag(e, "recovered"))
        .filter_map(|e| e["recoveryDurationMs"].as_f64().map(|n| n / 1000.))
        .collect::<Vec<_>>();
    recovery.sort_by(f64::total_cmp);
    // Keep integral results integral on the wire: record hashes cover the JSON bytes.
    let wire_number = |n: f64| {
        if n.fract() == 0.0 && n >= 0.0 && n < u64::MAX as f64 {
            json!(n as u64)
        } else {
            json!(n)
        }
    };
    let rank = |p: f64| {
        recovery
            .get(((p * recovery.len() as f64).ceil() as usize).saturating_sub(1))
            .copied()
            .map(wire_number)
    };
    let ratio = |n: usize, den: usize| {
        if den == 0 {
            None
        } else {
            Some(wire_number(n as f64 / den as f64))
        }
    };
    let mut ages = json!({});
    for e in &summaries {
        let age = (ms(c.meta, "createdAt") - ms(e, "endedAt")) / 3600000.;
        if age.is_finite() && age >= 0. {
            ages[id(e)] = wire_number(age)
        }
    }
    let sum = |k: &str| {
        summaries
            .iter()
            .map(|e| e["observed"][k].as_u64().unwrap_or(0))
            .sum::<u64>()
    };
    let excluded: Vec<_> = tests
        .iter()
        .filter(|t| t["testExecutionMode"] == "mock")
        .map(|t| {
            let mut rs = list(&t["traceability"], "sourceRefs").to_vec();
            rs.sort_by(|a, b| (id(a), field(a, "path")).cmp(&(id(b), field(b, "path"))));
            json!({"testId":id(t),"reason":"mock_test","sourceRefs":rs})
        })
        .collect();
    let mut counts = json!({});
    for code in ["DQ-12", "DQ-18", "DQ-19", "DQ-20", "DQ-21"] {
        counts[code] = json!(dqs.iter().filter(|d| d["code"] == code).count())
    }
    let accounting = json!({
        "enabled": true,
        "requiredRiskCount": risks.len(),
        "qualifiedRiskCount": qualified_risks.len(),
        "passingRiskCount": passing_risks.len(),
        "riskCoverageRate": ratio(qualified_risks.len(), risks.len()),
        "requiredExecutionCount": emitted.len(),
        "qualifiedExecutionCount": qualified.len(),
        "passingExecutionCount": passes,
        "resiliencePassRate": ratio(passes, qualified.len()),
        "recoverySecondsP50": rank(0.5),
        "recoverySecondsP95": rank(0.95),
        "recoverySampleCount": recovery.len(),
        "duplicateSideEffectsCount": sum("duplicateSideEffects"),
        "dataInconsistenciesCount": sum("dataInconsistencies"),
        "evidenceAgeHours": ages, "excludedMockTests": excluded,
        "dqCountByRule": counts, "drillDown": drill,
    });
    Assessment {
        accounting,
        dqs,
        blockers: all_blockers,
    }
}
