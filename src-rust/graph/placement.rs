use super::{adapter::strings, links::ancestors, ordered, sort_ids};
use crate::common::{encode, items, s};
use anyhow::{Result, ensure};
use serde_json::{Value, json};
use std::collections::HashSet;

pub const PLACEMENT_LAYERS: [&str; 7] = [
    "unit",
    "integration",
    "system",
    "e2e",
    "manual-scripted",
    "manual-exploratory",
    "spec-clarification",
];
const COSTS: [f64; 7] = [0.1, 0.25, 0.45, 0.7, 0.6, 0.65, 0.15];

fn linked(g: &Value, id: &str, kind: &str) -> Vec<String> {
    let valid = items(&g["nodes"])
        .iter()
        .filter(|n| n["kind"] == kind)
        .map(|n| s(&n["id"]))
        .collect::<HashSet<_>>();
    let mut result = Vec::new();
    for e in items(&g["edges"]) {
        let other = if e["from"] == id {
            &e["to"]
        } else if e["to"] == id {
            &e["from"]
        } else {
            continue;
        };
        if valid.contains(s(other)) {
            result.push(s(other).to_owned());
        }
    }
    ordered(result)
}
fn obligation(g: &Value, n: &Value) -> Value {
    let id = s(&n["id"]);
    let is_risk = n["kind"] == "risk";
    let risks = if is_risk {
        vec![id.to_owned()]
    } else {
        linked(g, id, "risk")
    };
    let mut changes = if n["kind"] == "changed_code" {
        vec![id.to_owned()]
    } else {
        linked(g, id, "changed_code")
    };
    for finding in linked(g, id, "finding") {
        changes.extend(linked(g, &finding, "changed_code"));
    }
    let priority = if is_risk {
        n["priority"].as_str().unwrap_or("P1")
    } else {
        "P1"
    };
    let index = if is_risk {
        let sum: f64 = [
            "likelihood",
            "businessImpact",
            "complianceCriticality",
            "evidenceGap",
            "novelty",
        ]
        .iter()
        .map(|field| n[field].as_f64().unwrap_or(f64::NAN))
        .sum();
        serde_json::Number::from_f64((100.0 * sum / 5.0 + 0.5).floor())
            .map(Value::Number)
            .unwrap_or(Value::Null)
    } else {
        json!(50)
    };
    json!({"id":format!("qeg:obligation:{}",encode(id)),"requirementIds":ancestors(linked(g,id,"requirement"),items(&g["nodes"]),items(&g["edges"])),"riskIds":ordered(risks),"failureModeIds":linked(g,id,"failure_mode"),"changedCodeIds":ordered(changes),"priority":priority,"riskPriorityIndex":index,"gateRelevance":"blocking","traceability":n["traceability"]})
}
fn covers(test: &Value, subject: &Value) -> bool {
    if test["deleted"] == true || test["testExecutionMode"] != "real" {
        return false;
    }
    let (required, declared) = if !items(&subject["riskIds"]).is_empty() {
        (&subject["riskIds"], &test["coveredRiskIds"])
    } else if test["testType"] != "resilience" {
        (&subject["changedCodeIds"], &test["coveredChangedCodeIds"])
    } else {
        return false;
    };
    !items(required).is_empty()
        && items(required)
            .iter()
            .all(|id| items(declared).contains(id))
}
pub(super) fn usable_oracle(t: &Value) -> bool {
    let scripted = t["layer"] == "manual-scripted";
    if t["testType"] == "resilience" {
        return !scripted;
    }
    t.get("oracleType").is_some()
        && t["oracleType"] != "missing"
        && (!scripted || t["oracleType"] != "implicit")
        && !items(&t["oracleRefs"]).is_empty()
        && !items(&t["expectedResults"]).is_empty()
}
fn score(i: usize, tests: &[&Value], subject: &Value) -> Value {
    let layer = PLACEMENT_LAYERS[i];
    let cost = COSTS[i];
    let matching: Vec<_> = tests
        .iter()
        .copied()
        .filter(|t| t["layer"] == layer && usable_oracle(t))
        .collect();
    let fit_test = !matching.is_empty();
    let clarification = layer == "spec-clarification" && !tests.iter().any(|t| usable_oracle(t));
    let fit = json!({"oracleFit":u8::from(fit_test),"changeProximity":u8::from(fit_test && !items(&subject["changedCodeIds"]).is_empty()),"interactionFit":u8::from(fit_test),
        "businessFidelity":if !fit_test{0.0}else if i>=2{1.0}else{0.6},"observability":u8::from(fit_test),"stability":if fit_test{1.0-cost/2.0}else{0.0},"reuseGain":u8::from(matching.iter().any(|t|t["existing"]==true))});
    let penalty = json!({"setupCost":cost,"runtimeCost":if i==6{0.0}else{cost},"flakeRisk":match i{3=>0.4,5=>0.2,_=>0.1}});
    let sum = |v: &Value| {
        v.as_object()
            .unwrap()
            .values()
            .filter_map(Value::as_f64)
            .sum::<f64>()
    };
    let final_score = (1000.0 * (sum(&fit) - sum(&penalty)) + 0.5).floor() / 1000.0;
    let rationale = if fit_test {
        format!(
            "{} explicitly linked test(s) with expected results and oracle references",
            matching.len()
        )
    } else if clarification {
        "Oracle contract is missing; clarification is required".into()
    } else {
        "No eligible test explicitly covers this obligation".into()
    };
    let mut refs = Vec::new();
    for t in matching {
        refs.extend_from_slice(items(if t["testType"] == "resilience" {
            &t["traceability"]["sourceRefs"]
        } else {
            &t["oracleRefs"]
        }));
    }
    refs.extend_from_slice(items(&subject["traceability"]["sourceRefs"]));
    json!({"layer":layer,"eligible":fit_test||clarification,"fit":fit,"costPenalty":penalty,"finalScore":final_score,"rationale":[rationale,"Tie-break: fixed layer order; producer suggestion does not establish execution"],"sourceRefs":refs})
}
fn placement(g: &Value, subject: &Value) -> Value {
    let mut tests: Vec<_> = items(&g["nodes"])
        .iter()
        .filter(|t| t["kind"] == "test" && covers(t, subject))
        .collect();
    tests.sort_by(|a, b| s(&a["id"]).encode_utf16().cmp(s(&b["id"]).encode_utf16()));
    let scores: Vec<_> = (0..PLACEMENT_LAYERS.len())
        .map(|i| score(i, &tests, subject))
        .collect();
    let mut best = None;
    for candidate in &scores {
        if candidate["eligible"] == true
            && best
                .is_none_or(|b: &Value| candidate["finalScore"].as_f64() > b["finalScore"].as_f64())
        {
            best = Some(candidate);
        }
    }
    let layer = best.map(|c| s(&c["layer"])).unwrap_or("spec-clarification");
    let selected: Vec<_> = tests
        .iter()
        .copied()
        .filter(|t| t["layer"] == layer && usable_oracle(t))
        .collect();
    let disposition = if selected.is_empty() {
        "blocked"
    } else if layer.starts_with("manual-") {
        "manual-only"
    } else if selected.iter().all(|t| t["existing"] == true) {
        "reuse"
    } else if selected.iter().any(|t| t["existing"] == true) {
        "adapt"
    } else {
        "add"
    };
    let artifacts = items(&g["nodes"])
        .iter()
        .filter(|n| {
            items(&subject["riskIds"]).contains(&n["id"])
                || items(&subject["changedCodeIds"]).contains(&n["id"])
        })
        .flat_map(|n| strings(&n["sourceArtifactIds"]))
        .collect();
    let id = s(&subject["id"]);
    json!({"id":format!("qeg:placement:{}",encode(id)),"kind":"test_placement","title":format!("{id}: {layer}"),"obligationId":id,"primaryLayer":layer,"disposition":disposition,"gateRelevance":subject["gateRelevance"],"candidateScores":scores,"selectedTestIds":selected.iter().map(|t|&t["id"]).collect::<Vec<_>>(),"traceability":subject["traceability"],"sourceArtifactIds":ordered(artifacts)})
}
pub fn place_tests(g: &Value) -> Result<Value> {
    ensure!(
        g["nodes"].is_array() && g["edges"].is_array(),
        "Graph requires nodes and edges"
    );
    let mut obligations: Vec<_> = items(&g["nodes"])
        .iter()
        .filter(|n| n["kind"] == "risk")
        .map(|n| obligation(g, n))
        .collect();
    let covered = obligations
        .iter()
        .flat_map(|o| strings(&o["changedCodeIds"]))
        .collect::<HashSet<_>>();
    obligations.extend(
        items(&g["nodes"])
            .iter()
            .filter(|n| n["kind"] == "changed_code" && !covered.contains(s(&n["id"])))
            .map(|n| obligation(g, n)),
    );
    sort_ids(&mut obligations);
    let placements: Vec<_> = obligations.iter().map(|o| placement(g, o)).collect();
    Ok(json!({"metadata":g["metadata"],"obligations":obligations,"placements":placements}))
}
