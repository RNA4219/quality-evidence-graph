use super::{
    adapter::{strings, trace},
    manual::scoped_id,
    ordered,
};
use crate::common::{encode, items, s};
use anyhow::{Result, ensure};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};

pub(super) fn ancestors(ids: Vec<String>, nodes: &[Value], edges: &[Value]) -> Vec<String> {
    let valid: HashSet<_> = nodes
        .iter()
        .filter(|n| n["kind"] == "requirement")
        .map(|n| s(&n["id"]))
        .collect();
    let mut seen: HashSet<String> = ids.iter().cloned().collect();
    let mut queue = ids;
    while let Some(id) = queue.pop() {
        for edge in edges
            .iter()
            .filter(|e| e["kind"] == "derives_from" && e["from"] == id)
        {
            let target = s(&edge["to"]);
            if valid.contains(target) && seen.insert(target.to_owned()) {
                queue.push(target.to_owned());
            }
        }
    }
    ordered(seen.into_iter().collect())
}

pub(super) fn requirement_edges(
    nodes: &HashMap<String, Value>,
    loaded: &[(&Value, &Value)],
) -> Result<Vec<Value>> {
    let is_requirement = |id: &str| nodes.get(id).is_some_and(|n| n["kind"] == "requirement");
    let mut edges = Vec::new();
    for &(d, item) in loaded {
        let raw = &item["payload"];
        if !item["failure"].is_null()
            || d["adapter"] != "manual-bb-test-harness"
            || d["kind"] != "feature_spec"
            || !raw["feature_id"].is_string()
            || !raw["source_refs"].is_array()
            || d["executionContext"].is_null()
        {
            continue;
        }
        let feature = s(&raw["feature_id"]);
        let from = scoped_id(
            s(&d["executionContext"]["projectId"]),
            feature,
            "requirement",
            feature,
        );
        if !is_requirement(&from) {
            continue;
        }
        let mut mappings = HashMap::new();
        for m in items(&d["sourceRefMappings"]) {
            let id = s(&m["sourceId"]);
            let req = s(&m["requirementId"]);
            ensure!(
                items(&raw["source_refs"]).iter().any(|r| r["id"] == id)
                    && is_requirement(req)
                    && mappings.insert(id, req).is_none(),
                "Unresolved or duplicate sourceRefMapping in {}",
                s(&d["path"])
            );
        }
        for src in items(&raw["source_refs"]) {
            let Some(id) = src["id"].as_str() else {
                continue;
            };
            let mapped = mappings.get(id);
            let to = mapped.copied().unwrap_or(id);
            if to == from || !is_requirement(to) {
                continue;
            }
            let mut tr = trace(d, "/source_refs", &Value::Null);
            if mapped.is_some() {
                let rid = s(&d["id"]);
                let mut provenance = json!({"id":format!("qeg:source-mapping:{}",encode(&format!("{rid}/{id}"))),"path":"ingest-manifest.json"});
                if let Some(rev) = d.get("revision") {
                    provenance["revision"] = rev.clone();
                }
                provenance["label"] = json!(format!("{rid}/sourceRefMappings: {id} -> {to}"));
                tr["sourceRefs"].as_array_mut().unwrap().push(provenance);
            }
            edges.push(json!({"id":format!("qeg:requirement-link:{}",encode(&format!("{from}/{to}"))),"from":from,"to":to,"kind":"derives_from","traceability":tr}));
        }
    }
    Ok(edges)
}
fn related_changes(id: &str, nodes: &HashMap<&str, &Value>, edges: &[Value]) -> Vec<String> {
    let mut related = Vec::new();
    for edge in edges {
        let other = if edge["from"] == id && matches!(s(&edge["kind"]), "touches" | "derives_from")
        {
            &edge["to"]
        } else if edge["to"] == id && edge["kind"] == "touches" {
            &edge["from"]
        } else {
            continue;
        };
        if let Some(node) = nodes.get(s(other)) {
            match s(&node["kind"]) {
                "changed_code" => related.push(s(&node["id"]).to_owned()),
                "finding" => related.extend(strings(&node["changedCodeIds"])),
                _ => (),
            }
        }
    }
    related
}
pub(super) fn enrich_tests(nodes: &mut [Value], edges: &[Value]) {
    let by_id = nodes
        .iter()
        .map(|n| (s(&n["id"]), n))
        .collect::<HashMap<_, _>>();
    let mut updates = Vec::new();
    for (i, n) in nodes
        .iter()
        .enumerate()
        .filter(|(_, n)| n["kind"] == "test" && n["testType"] != "resilience")
    {
        let mut risks = strings(&n["coveredRiskIds"]);
        let mut reqs = strings(&n["coveredRequirementIds"]);
        for e in edges
            .iter()
            .filter(|e| e["kind"] == "requires_test" && e["to"] == n["id"])
        {
            if let Some(other) = by_id.get(s(&e["from"])) {
                match s(&other["kind"]) {
                    "risk" => risks.push(s(&other["id"]).to_owned()),
                    "requirement" => reqs.push(s(&other["id"]).to_owned()),
                    _ => (),
                }
            }
        }
        let risks = ordered(risks);
        let reqs = ancestors(reqs, nodes, edges);
        let mut changes = strings(&n["coveredChangedCodeIds"]);
        for id in risks.iter().chain(&reqs) {
            changes.extend(related_changes(id, &by_id, edges));
        }
        updates.push((i, risks, reqs, ordered(changes)));
    }
    for (i, risks, reqs, changes) in updates {
        nodes[i]["coveredRiskIds"] = json!(risks);
        nodes[i]["coveredRequirementIds"] = json!(reqs);
        nodes[i]["coveredChangedCodeIds"] = json!(changes);
    }
    let executions = nodes
        .iter()
        .filter(|n| {
            n["kind"] == "execution_evidence"
                && n.get("passed").is_some()
                && !items(&n["evidenceRefs"]).is_empty()
        })
        .map(|n| s(&n["id"]))
        .collect::<HashSet<_>>();
    let tests = edges
        .iter()
        .filter(|e| e["kind"] == "evidenced_by" && executions.contains(s(&e["to"])))
        .map(|e| s(&e["from"]))
        .collect::<HashSet<_>>();
    let observed: HashSet<_> = nodes
        .iter()
        .filter(|n| {
            n["kind"] == "test"
                && n["testType"] != "resilience"
                && n["deleted"] != true
                && n["testExecutionMode"] == "real"
                && tests.contains(s(&n["id"]))
                && !items(&n["oracleRefs"]).is_empty()
                && !items(&n["expectedResults"]).is_empty()
                && !s(&n["oracleType"]).is_empty()
                && n["oracleType"] != "missing"
        })
        .flat_map(|n| strings(&n["coveredRiskIds"]))
        .collect();
    for n in nodes.iter_mut() {
        if n["kind"] == "risk" && observed.contains(s(&n["id"])) {
            n["evidenceGap"] = json!(0);
        }
    }
}
