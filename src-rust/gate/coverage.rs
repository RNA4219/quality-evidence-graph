use super::*;

fn manual(layer: &Value) -> bool {
    matches!(
        layer.as_str(),
        Some("manual-scripted" | "manual-exploratory")
    )
}
fn oracle(t: &Value) -> bool {
    t["testType"] != "resilience"
        && !t["oracleType"].is_null()
        && !matches!(field(t, "oracleType"), "missing" | "implicit")
        && !list(t, "oracleRefs").is_empty()
        && !list(t, "expectedResults").is_empty()
}
fn current_manual<'a>(ctx: &Context<'a>, case: &str) -> Option<&'a Value> {
    let n = ctx.node(case);
    (n["kind"] == "test"
        && manual(&n["layer"])
        && n["testExecutionMode"] == "real"
        && !flag(n, "deleted"))
    .then_some(n)
}
pub(super) fn retired(c: &Context, t: &Value) -> bool {
    flag(t, "deleted")
        && !contains(
            &c.plan["manual_case_inventory"]["current_subject_ids"],
            id(t),
        )
        && list(c.plan, "placement_changes").iter().any(|a| {
            a["subject_id"] == t["id"] && manual(&a["from_layer"]) && a["to_layer"] == "automated"
        })
}
fn restored(c: &Context, case: &str) -> bool {
    current_manual(c, case).is_some_and(|test| {
        contains(
            &c.plan["manual_case_inventory"]["current_subject_ids"],
            case,
        ) && (test["layer"] != "manual-scripted" || oracle(test))
            && c.placements.iter().any(|p| {
                p["disposition"] != "blocked"
                    && p["primaryLayer"] == test["layer"]
                    && contains(&p["selectedTestIds"], case)
            })
    })
}
fn consistent_cover(c: &Context, tests: &[&Value], o: &Value) -> bool {
    let risks = !list(o, "riskIds").is_empty();
    let required = strings(&o[if risks { "riskIds" } else { "changedCodeIds" }]);
    if required.is_empty() {
        return true;
    }
    let explicit: Vec<_> = tests
        .iter()
        .filter(|t| {
            t.get("coveredRiskIds").is_some()
                || t["testType"] == "resilience"
                || t.get("coveredChangedCodeIds").is_some()
        })
        .collect();
    if c.policy["inputContract"]["mode"] == "native_graph"
        && !tests.is_empty()
        && explicit.is_empty()
    {
        return true;
    }
    let mut covered = HashSet::new();
    for t in explicit {
        let ids = if risks {
            strings(&t["coveredRiskIds"])
        } else if t["testType"] == "resilience" {
            vec![]
        } else {
            strings(&t["coveredChangedCodeIds"])
        };
        if !ids.iter().any(|id| required.contains(id)) {
            return false;
        }
        covered.extend(ids);
    }
    required.iter().all(|id| covered.contains(id))
}
pub(super) fn coverage(c: &Context) -> Vec<Value> {
    let mut out = vec![];
    let obs = list(c.plan, "obligations");
    let placements = list(c.plan, "placements");
    for o in obs {
        let selected = c.selected(o);
        if selected.is_empty() {
            continue;
        }
        let tests = only(c.nodes, "test")
            .filter(|t| selected.contains(&id(t)))
            .collect::<Vec<_>>();
        if !consistent_cover(c, &tests, o) {
            out.push(dq(
                "DQ-05",
                format!("Selected tests do not cover obligation \"{}\"", id(o)),
                json!([[id(o)].as_slice(), &selected].concat()),
                json!([source("/placementPlan", id(o))]),
            ))
        }
    }
    for n in only(c.nodes, "changed_code") {
        let related: Vec<_> = obs
            .iter()
            .filter(|o| contains(&o["changedCodeIds"], id(n)))
            .collect();
        let covered = !related.is_empty()
            && related.iter().all(|o| {
                placements
                    .iter()
                    .any(|p| p["obligationId"] == o["id"] && p["disposition"] != "blocked")
            });
        let risk_ids = unique(
            related.iter().flat_map(|o| strings(&o["riskIds"])).chain(
                c.edges
                    .iter()
                    .filter_map(|e| {
                        if e["from"] == n["id"] {
                            e["to"].as_str()
                        } else if e["to"] == n["id"] {
                            e["from"].as_str()
                        } else {
                            None
                        }
                    })
                    .filter(|id| c.node(id)["kind"] == "risk"),
            ),
        );
        if !covered && !c.all_waived(&risk_ids) {
            out.push(dq(
                "DQ-05",
                format!(
                    "Changed code \"{}\" without test obligation or waiver",
                    field(n, "path")
                ),
                json!([id(n)]),
                prefer_refs(
                    refs(n),
                    json!([source("/placementPlan", &format!("Coverage for {}", id(n)))]),
                ),
            ))
        }
    }
    out
}
pub(super) fn required_executions(c: &Context, execution: &Value, rel: &Value) -> Vec<Value> {
    let mut out = vec![];
    if !flag(&c.policy["inputContract"], "requireExecutedTests") {
        return out;
    }
    let obligations = list(c.plan, "obligations");
    for r in only(c.nodes, "risk") {
        if !c.waived(id(r))
            && !obligations
                .iter()
                .any(|o| o["gateRelevance"] == "blocking" && contains(&o["riskIds"], id(r)))
        {
            out.push(dq(
                "DQ-05",
                format!("Risk \"{}\" has no blocking test obligation", id(r)),
                json!([id(r)]),
                prefer_refs(refs(r), json!([source("/placementPlan", id(r))])),
            ))
        }
    }
    for o in obligations {
        if (o["gateRelevance"] != "blocking" && list(o, "changedCodeIds").is_empty())
            || c.all_waived(&strings(&o["riskIds"]))
        {
            continue;
        }
        let selected = c.selected(o);
        let missing = selected.is_empty()
            || selected.iter().any(|test_id| {
                let t = c.node(test_id);
                if t["kind"] != "test" || flag(t, "deleted") || t["testExecutionMode"] != "real" {
                    return true;
                }
                if t["testType"] == "resilience" {
                    return !flag(rel, "enabled")
                        || !list(rel, "drillDown")
                            .iter()
                            .any(|d| d["testId"] == *test_id);
                }
                !list(execution, "selections").iter().any(|x| {
                    x["testId"] == *test_id
                        && nonblank(&x["selectedEvidenceId"])
                        && matches!(field(x, "selectedStatus"), "pass" | "fail")
                })
            });
        if missing {
            out.push(dq(
                "DQ-05",
                format!(
                    "Obligation \"{}\" lacks required real execution evidence",
                    id(o)
                ),
                json!([[id(o)].as_slice(), &selected].concat()),
                json!([source("/placementPlan", id(o))]),
            ))
        }
    }
    out
}
pub(super) fn retirement(c: &Context, execution: &Value) -> Vec<Value> {
    let mut out = vec![];
    let inv = &c.plan["manual_case_inventory"];
    let current = strings(&inv["current_subject_ids"]);
    let changes = list(c.plan, "placement_changes");
    let mut seen = HashSet::new();
    for case in &current {
        if !seen.insert(case) || current_manual(c, case).is_none() {
            out.push(dq(
                "DQ-14",
                format!(
                    "Current manual inventory \"{case}\" must identify one current real manual test"
                ),
                json!([case]),
                inv["sourceRefs"].clone(),
            ))
        }
    }
    for p in c
        .placements
        .iter()
        .filter(|p| p["primaryLayer"] == "manual-scripted")
    {
        let ids = strings(&p["selectedTestIds"]);
        let selected: Vec<_> = ids
            .iter()
            .map(|id| c.node(id))
            .filter(|n| n["kind"] != "test" || !retired(c, n))
            .collect();
        if !ids.is_empty() && selected.is_empty() {
            continue;
        }
        if selected.is_empty() || selected.iter().any(|n| n["kind"] != "test" || !oracle(n)) {
            out.push(dq(
                "DQ-14",
                format!(
                    "Manual-scripted placement \"{}\" without acceptable oracle",
                    id(p)
                ),
                json!([id(p)]),
                refs(p),
            ))
        }
    }
    let policy = &c.policy["placementRetirementPolicy"];
    for ch in changes
        .iter()
        .filter(|ch| manual(&ch["from_layer"]) && ch["to_layer"] == "automated")
    {
        let cid = id(ch);
        let case = field(ch, "subject_id");
        let subject = c.node(case);
        let policy_ref = field(ch, "policy_ref");
        let refs = prefer_refs(
            json!(doc_refs(&ch["evidence_refs"])),
            json!(list(c.policy, "sourceRefs")),
        );
        let mut add = |msg: String, ids: Vec<&str>| {
            out.push(dq(
                "DQ-14",
                format!("Placement change \"{cid}\" {msg}"),
                json!(ids),
                refs.clone(),
            ))
        };
        if subject["kind"] != "test"
            || subject["layer"] != ch["from_layer"]
            || ch["policy_ref"] != c.policy["policyId"]
        {
            add(
                "has an inconsistent manual subject or policy reference".into(),
                vec![cid, case, policy_ref],
            );
            continue;
        }
        if list(ch, "evidence_refs").is_empty() {
            add(
                format!("retires manual case \"{case}\" without evidence_refs"),
                vec![cid, case],
            );
            continue;
        }
        if list(policy, "sourceRefs").is_empty() {
            add(
                "has no source-backed retirement policy".into(),
                vec![cid, policy_ref],
            );
            continue;
        }
        let ids = strings(&ch["replacement_ids"]);
        let tests: Vec<_> = ids.iter().map(|id| c.node(id)).collect();
        let mut subjects = vec![cid, case];
        subjects.extend(&ids);
        if restored(c, case) {
            continue;
        }
        if tests
            .iter()
            .any(|n| n["kind"] != "test" || flag(n, "deleted"))
        {
            add(
                format!(
                    "replacement test is missing or deleted and manual case \"{case}\" is not restored"
                ),
                subjects,
            );
            continue;
        }
        let invalid = tests.is_empty()
            || tests.iter().any(|n| {
                !matches!(field(n, "layer"), "unit" | "integration" | "system" | "e2e")
                    || !c.edges.iter().any(|e| {
                        e["kind"] == "replaced_by" && e["from"] == case && e["to"] == n["id"]
                    })
            });
        let mocked = tests.iter().any(|n| n["testExecutionMode"] != "real");
        let weak = mocked
            || tests.iter().any(|n| {
                n["testType"] != "resilience"
                    && !list(execution, "selections").iter().any(|s| {
                        s["testId"] == n["id"]
                            && s["selectedStatus"] == "pass"
                            && num(s, "consecutivePasses") >= num(policy, "minConsecutiveGreen")
                    })
                    || n["evidenceStrength"].as_f64().unwrap_or(0.)
                        < num(policy, "minEvidenceStrength")
                    || n["recentGreenRuns"].as_f64().unwrap_or(0.)
                        < num(policy, "minConsecutiveGreen")
            });
        let obs: HashSet<_> = list(c.plan, "placements")
            .iter()
            .filter(|p| p["id"] == case || contains(&p["selectedTestIds"], case))
            .map(|p| field(p, "obligationId"))
            .collect();
        let risks = unique(
            list(c.plan, "obligations")
                .iter()
                .filter(|o| obs.contains(id(o)))
                .flat_map(|o| strings(&o["riskIds"])),
        );
        let missing = flag(policy, "requireRiskCoverage")
            && risks
                .iter()
                .any(|r| !tests.iter().any(|t| contains(&t["coveredRiskIds"], r)));
        if weak || missing {
            subjects.extend(risks);
            let reason = if mocked {
                "mock test evidence is not Gate-eligible"
            } else if weak {
                "evidence strength or green-run threshold fell below policy"
            } else {
                "required risk coverage is missing"
            };
            add(format!("is a revert candidate: {reason}"), subjects)
        } else if invalid {
            add(
                "requires automated replacements linked by replaced_by".into(),
                subjects,
            )
        }
    }
    for case in strings(&inv["previous_subject_ids"])
        .iter()
        .filter(|id| !current.contains(id) && !changes.iter().any(|ch| ch["subject_id"] == **id))
    {
        out.push(dq(
            "DQ-14",
            format!(
                "Manual case \"{case}\" disappeared without placement_change retirement record"
            ),
            json!([case]),
            inv["sourceRefs"].clone(),
        ))
    }
    out
}
