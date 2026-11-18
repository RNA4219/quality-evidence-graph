use super::*;
fn issue(out: &mut Vec<Value>, p: &str, msg: String, ids: Vec<&str>) {
    out.push(dq(
        "DQ-03",
        msg.clone(),
        json!(ids),
        json!([source(p, &msg)]),
    ))
}
fn duplicates(out: &mut Vec<Value>, p: &str, values: &[Value]) {
    let mut seen = HashSet::new();
    for v in values {
        let id = id(v);
        if !seen.insert(id) {
            issue(out, p, format!("Duplicate ID \"{id}\""), vec![id]);
        }
    }
}
fn resolve(c: &Context, out: &mut Vec<Value>, p: &str, ids: Vec<&str>, kind: &str) {
    for x in ids {
        let n = c.node(x);
        if n.is_null() || (kind != "node" && n["kind"] != kind) {
            issue(
                out,
                p,
                format!("Unresolved {kind} reference \"{x}\""),
                vec![x],
            );
        }
    }
}
fn layers(c: &Context, out: &mut Vec<Value>, p: &str, placement: &Value) {
    for x in strings(&placement["selectedTestIds"]) {
        let t = c.node(x);
        if t["kind"] == "test" && t["layer"] != placement["primaryLayer"] {
            issue(
                out,
                p,
                format!(
                    "Placement \"{}\" layer disagrees with selected test \"{x}\"",
                    id(placement)
                ),
                vec![id(placement), x],
            )
        }
    }
}
pub(super) fn detect(c: &Context) -> Vec<Value> {
    let mut out = vec![];
    let artifacts = list(c.meta, "inputArtifacts");
    for (p, arr) in [
        ("/graph/nodes", c.nodes),
        ("/graph/edges", c.edges),
        ("/metadata/inputArtifacts", artifacts),
    ] {
        duplicates(&mut out, p, arr)
    }
    for (i, e) in c.edges.iter().enumerate() {
        resolve(
            c,
            &mut out,
            &format!("/graph/edges/{i}"),
            vec![field(e, "from"), field(e, "to")],
            "node",
        )
    }
    for (i, n) in c.nodes.iter().enumerate() {
        let p = &format!("/graph/nodes/{i}");
        for a in strings(&n["sourceArtifactIds"]) {
            if !artifacts.iter().any(|v| v["id"] == a) {
                issue(
                    &mut out,
                    p,
                    format!("Unresolved artifact reference \"{a}\""),
                    vec![id(n), a],
                )
            }
        }
        let mappings: &[(&str, &str)] = match field(n, "kind") {
            "requirement" => &[("acceptanceCriteriaIds", "acceptance_criteria")],
            "acceptance_criteria" => &[("requirementIds", "requirement")],
            "finding" => &[("changedCodeIds", "changed_code")],
            "failure_mode" => &[("riskIds", "risk")],
            "test" if n["testType"] != "resilience" => &[
                ("coveredRiskIds", "risk"),
                ("coveredRequirementIds", "requirement"),
                ("coveredChangedCodeIds", "changed_code"),
            ],
            "test" => &[("coveredRiskIds", "risk")],
            _ => &[],
        };
        for (k, kind) in mappings {
            resolve(c, &mut out, p, strings(&n[k]), kind)
        }
        if n["kind"] == "execution_evidence" && n["evidenceType"] == "resilience" {
            resolve(c, &mut out, p, vec![field(n, "testId")], "test")
        }
    }
    let obs = list(c.plan, "obligations");
    let placements = list(c.plan, "placements");
    let check_obligation = |out: &mut Vec<Value>, p: &str, n: &Value| {
        if !obs.iter().any(|o| o["id"] == n["obligationId"]) {
            issue(
                out,
                p,
                format!("Unresolved obligation \"{}\"", field(n, "obligationId")),
                vec![id(n)],
            )
        }
    };
    for (i, n) in c
        .nodes
        .iter()
        .enumerate()
        .filter(|(_, n)| n["kind"] == "test_placement")
    {
        let p = &format!("/graph/nodes/{i}");
        resolve(c, &mut out, p, strings(&n["selectedTestIds"]), "test");
        layers(c, &mut out, p, n);
        check_obligation(&mut out, p, n);
        if let Some(p2) = placements.iter().find(|p2| p2["id"] == n["id"]) {
            let mut a = strings(&p2["selectedTestIds"]);
            let mut b = strings(&n["selectedTestIds"]);
            a.sort();
            b.sort();
            if a != b
                || ["obligationId", "primaryLayer", "disposition"]
                    .iter()
                    .any(|k| p2[k] != n[k])
            {
                issue(
                    &mut out,
                    p,
                    format!("Graph and plan disagree for placement \"{}\"", id(n)),
                    vec![id(n)],
                )
            }
        }
    }
    duplicates(&mut out, "/placementPlan/obligations", obs);
    duplicates(&mut out, "/placementPlan/placements", placements);
    for (i, o) in obs.iter().enumerate() {
        let p = &format!("/placementPlan/obligations/{i}");
        for (k, kind) in [
            ("changedCodeIds", "changed_code"),
            ("riskIds", "risk"),
            ("requirementIds", "requirement"),
            ("failureModeIds", "failure_mode"),
        ] {
            resolve(c, &mut out, p, strings(&o[k]), kind)
        }
    }
    for (i, n) in placements.iter().enumerate() {
        let p = &format!("/placementPlan/placements/{i}");
        check_obligation(&mut out, p, n);
        resolve(c, &mut out, p, strings(&n["selectedTestIds"]), "test");
        layers(c, &mut out, p, n)
    }
    out
}
