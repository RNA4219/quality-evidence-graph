mod adapter;
mod ctg;
mod ingest;
mod links;
mod manual;
mod placement;
mod rand;

pub use ingest::{load_raw_artifacts, parse_producer_artifact, validate_producer_payload};
pub use placement::{PLACEMENT_LAYERS, place_tests};

use crate::common::{encode, items, s};
use adapter::{Context, assert_no_direct_policy, norm_path, source, stable_id, strings};
use anyhow::{Result, ensure};
use indexmap::IndexMap;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};

pub fn required_artifacts() -> Value {
    let producers: &[(&str, &[&str])] = &[
        (
            "RanD",
            &["requirements_packet", "requirements_audit_packet"],
        ),
        (
            "code-to-gate",
            &[
                "normalized_repo_graph",
                "diff_analysis",
                "findings",
                "risk_register",
                "test_seeds",
                "release_readiness",
                "audit",
            ],
        ),
        (
            "manual-bb-test-harness",
            &[
                "feature_spec",
                "risk_register",
                "manual_case_set",
                "gate_decision",
                "execution_evidence",
            ],
        ),
    ];
    Value::Array(
        producers
            .iter()
            .flat_map(|(producer, kinds)| {
                kinds
                    .iter()
                    .map(move |kind| json!({"adapter":producer,"kind":kind}))
            })
            .collect(),
    )
}
pub fn upstream_input_contract(target: &str) -> Value {
    json!({"mode":"upstream_artifacts","requiredArtifacts":required_artifacts(),"evaluationScope":{"kind":"isolated_consumer","target":target,"notEvaluated":["実環境の受入","人間のrelease approval"]},
        "requireExecutedTests":true,"sourceRefs":[{"id":format!("qeg:input-{}",encode("/policy/inputContract")),"path":"gate-input.json","label":"/policy/inputContract: 必要証跡と評価範囲を設定する"}]})
}
fn ordered(mut values: Vec<String>) -> Vec<String> {
    values.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    values.dedup();
    values
}
fn sort_ids(values: &mut [Value]) {
    values.sort_by(|a, b| s(&a["id"]).encode_utf16().cmp(s(&b["id"]).encode_utf16()));
}
fn merged_refs(a: &Value, b: &Value) -> Value {
    let mut refs = HashMap::new();
    for v in items(a).iter().chain(items(b)) {
        refs.insert(s(&v["id"]), v.clone());
    }
    let mut refs = refs.into_values().collect::<Vec<_>>();
    sort_ids(&mut refs);
    Value::Array(refs)
}
fn merge_requirement(a: &Value, b: &Value) -> Value {
    let mut result = if items(&a["acceptanceCriteriaIds"]).is_empty() {
        b.clone()
    } else {
        a.clone()
    };
    for key in ["acceptanceCriteriaIds", "sourceArtifactIds"] {
        let mut values = strings(&a[key]);
        values.extend(strings(&b[key]));
        result[key] = json!(ordered(values));
    }
    let at = &a["traceability"];
    let bt = &b["traceability"];
    result["traceability"]["sourceRefs"] = merged_refs(&at["sourceRefs"], &bt["sourceRefs"]);
    let mut values = strings(&at["assumptions"]);
    values.extend(strings(&bt["assumptions"]));
    result["traceability"]["assumptions"] = json!(ordered(values));
    result
}
#[derive(Default)]
struct Builder {
    nodes: HashMap<String, Value>,
    edges: IndexMap<String, Value>,
    failures: Vec<Value>,
    claims: Vec<Value>,
    statuses: IndexMap<String, &'static str>,
    seen_ids: HashSet<String>,
}
impl Builder {
    fn failure(&mut self, d: &Value, code: &str, reason: &str, pointer: &str) {
        self.failures.push(json!({"code":code,"path":d["path"],"reason":reason,"sourceRefs":[source(d,pointer,None)]}));
    }
    fn violation(&mut self, producer: &str) {
        self.statuses
            .insert(producer.to_owned(), "contract_violation");
    }
    fn normalize(
        &mut self,
        manifest: &Value,
        artifacts: &[Value],
        loaded: &[(&Value, &Value)],
        d: &Value,
        changes: &HashMap<String, String>,
    ) -> Result<()> {
        let producer = s(&d["adapter"]);
        let id = s(&d["id"]);
        self.statuses
            .entry(producer.to_owned())
            .or_insert("success");
        ensure!(
            self.seen_ids.insert(id.to_owned()),
            "Duplicate artifact ID {id}"
        );
        let mut matches = loaded
            .iter()
            .filter(|(r, _)| r["path"] == d["path"] && r["id"] == d["id"]);
        let item = matches
            .next()
            .map(|(_, item)| *item)
            .filter(|_| matches.next().is_none())
            .ok_or_else(|| anyhow::anyhow!("Expected one loaded payload for {id}"))?;
        if !item["failure"].is_null() {
            let f = &item["failure"];
            self.failure(d, s(&f["code"]), s(&f["message"]), "/");
            self.violation(producer);
            return Ok(());
        }
        let raw = &item["payload"];
        ensure!(raw.is_object(), "{} must be an object", s(&d["path"]));
        assert_no_direct_policy(raw)?;
        validate_producer_payload(d, raw)?;
        if producer == "code-to-gate" {
            let repo = &raw["repo"];
            ensure!(repo.is_object(), "repo must be an object");
            let meta = &manifest["metadata"];
            let head = s(&meta["headRef"]);
            let rev = s(&repo["revision"]);
            let abbreviated = (12..=64).contains(&rev.len())
                && rev
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
                && d["reportedRevision"] == rev
                && head.starts_with(rev);
            if repo["dirty"] == true || !rev.is_empty() && rev != head && !abbreviated {
                self.failure(
                    d,
                    "DQ-12",
                    "CTG reported revision requires explicit canonical binding and clean source",
                    "/repo/revision",
                );
            }
            if !s(&repo["head_ref"]).is_empty() && repo["head_ref"] != meta["headRef"]
                || !s(&repo["base_ref"]).is_empty()
                    && !s(&meta["baseRef"]).is_empty()
                    && repo["base_ref"] != meta["baseRef"]
            {
                self.failure(
                    d,
                    "DQ-12",
                    "CTG raw repo revision differs from manifest metadata",
                    "/repo",
                );
                self.violation(producer);
                return Ok(());
            }
        }
        let c = Context {
            descriptor: d,
            raw,
            profile: &manifest["metadata"]["profile"],
            changes,
            execution_policy: &manifest["policy"]["executionPolicy"],
        };
        let normalized = match producer {
            "RanD" => rand::normalize(&c)?,
            "code-to-gate" => ctg::normalize(&c)?,
            "manual-bb-test-harness" => manual::normalize(&c)?,
            _ => anyhow::bail!("Raw adapter unavailable: {producer}/{}", s(&d["kind"])),
        };
        if !normalized.failures.is_empty() {
            self.violation(producer);
        }
        self.failures.extend(normalized.failures);
        self.claims.extend(normalized.claims);
        for node in normalized.nodes {
            let id = s(&node["id"]).to_owned();
            let Some(prev) = self.nodes.get(&id) else {
                self.nodes.insert(id, node);
                continue;
            };
            let opposite = match s(&d["kind"]) {
                "requirements_packet" => Some("requirements_audit_packet"),
                "requirements_audit_packet" => Some("requirements_packet"),
                _ => None,
            };
            let pair = opposite.is_some_and(|op| {
                items(&prev["sourceArtifactIds"]).len() == 1
                    && artifacts
                        .iter()
                        .find(|a| a["id"] == prev["sourceArtifactIds"][0])
                        .is_some_and(|a| a["kind"] == op)
            });
            if producer == "RanD"
                && pair
                && prev["kind"] == "requirement"
                && node["kind"] == "requirement"
            {
                self.nodes.insert(id, merge_requirement(prev, &node));
            } else {
                self.claims.push(json!({"id":format!("qeg:duplicate-node:{}",encode(&id)),"claim":format!("Duplicate node ID {id}"),"nodeIds":[id],"gateRelevant":true}));
            }
        }
        for edge in normalized.edges {
            let id = s(&edge["id"]).to_owned();
            if let Some(prev) = self.edges.get_mut(&id) {
                ensure!(
                    ["from", "to", "kind"]
                        .iter()
                        .all(|key| prev[key] == edge[key]),
                    "Conflicting edge {id}"
                );
                prev["traceability"]["sourceRefs"] = merged_refs(
                    &prev["traceability"]["sourceRefs"],
                    &edge["traceability"]["sourceRefs"],
                );
            } else {
                self.edges.insert(id, edge);
            }
        }
        Ok(())
    }
}
fn descriptor_key(d: &Value) -> String {
    format!("{}/{}", s(&d["adapter"]), s(&d["kind"]))
}
pub fn build_graph(manifest: &Value, loaded: &Value) -> Result<Value> {
    let mut artifacts = manifest["artifacts"]
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("Manifest requires artifacts"))?
        .clone();
    artifacts.sort_by(|a, b| {
        s(&a["path"])
            .encode_utf16()
            .cmp(s(&b["path"]).encode_utf16())
            .then_with(|| s(&a["id"]).encode_utf16().cmp(s(&b["id"]).encode_utf16()))
    });
    let loaded = loaded
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("Loaded artifacts must be an array"))?;
    let bound: Vec<_> = loaded
        .iter()
        .filter_map(|item| {
            let r = &item["ref"];
            artifacts
                .iter()
                .find(|a| a["id"] == r["id"] && a["path"] == r["path"])
                .map(|d| (d, item))
        })
        .collect();
    let mut changes = HashMap::new();
    for &(d, item) in &bound {
        if item["failure"].is_null()
            && d["adapter"] == "code-to-gate"
            && d["kind"] == "diff_analysis"
        {
            for file in items(&item["payload"]["changed_files"]) {
                if let Some(raw) = file["path"].as_str() {
                    let path = norm_path(raw);
                    changes.insert(path.clone(), stable_id("ctg", "changed_code", &path));
                }
            }
        }
    }
    let mut b = Builder::default();
    for d in &artifacts {
        if let Err(error) = b.normalize(manifest, &artifacts, &bound, d, &changes) {
            b.violation(s(&d["adapter"]));
            b.failure(d, "DQ-01", &error.to_string(), "/");
        }
    }
    let contract = &manifest["policy"]["inputContract"];
    let required = if contract["mode"] == "upstream_artifacts" {
        required_artifacts()
    } else {
        contract["requiredArtifacts"].clone()
    };
    let keys = artifacts.iter().map(descriptor_key).collect::<HashSet<_>>();
    for d in items(&required) {
        let key = descriptor_key(d);
        if !keys.contains(&key) {
            b.violation(s(&d["adapter"]));
            b.failures.push(json!({"code":"DQ-01","path":"ingest-manifest.json","reason":format!("Missing required artifact {key}"),"sourceRefs":[{"id":format!("qeg:missing:{key}"),"path":"ingest-manifest.json","label":"/artifacts"}]}));
        }
    }
    let mappings = if artifacts.iter().any(|d| {
        !d["sourceRefMappings"].is_null()
            && (d["adapter"] != "manual-bb-test-harness" || d["kind"] != "feature_spec")
    }) {
        Err(anyhow::anyhow!(
            "sourceRefMappings require a manual-bb feature_spec"
        ))
    } else {
        links::requirement_edges(&b.nodes, &bound)
    };
    match mappings{Ok(links)=>{for edge in links{b.edges.insert(s(&edge["id"]).to_owned(),edge);}},Err(e)=>b.failures.push(json!({"code":"DQ-01","path":"ingest-manifest.json","reason":format!("Error: {e}"),"sourceRefs":[{"id":"qeg:source-mapping","path":"ingest-manifest.json"}]}))};
    let mut edges = Vec::new();
    for e in b.edges.into_values() {
        let from = s(&e["from"]);
        let to = s(&e["to"]);
        if b.nodes.contains_key(from) && b.nodes.contains_key(to) {
            edges.push(e);
        } else {
            b.claims.push(json!({"id":format!("qeg:unresolved:{}",encode(s(&e["id"]))),"claim":format!("Unresolved edge {from} -> {to}"),"nodeIds":[from,to],"gateRelevant":true}));
        }
    }
    for d in &mut artifacts {
        if let Some(object) = d.as_object_mut() {
            for key in [
                "contractVersion",
                "executionContext",
                "reportedRevision",
                "sourceRefMappings",
            ] {
                object.shift_remove(key);
            }
        }
    }
    let mut metadata = manifest["metadata"].clone();
    ensure!(metadata.is_object(), "Manifest requires metadata");
    metadata["inputArtifacts"] = Value::Array(artifacts);
    metadata["requiredConnectorStatus"] = json!(b.statuses);
    let mut nodes = b.nodes.into_values().collect::<Vec<_>>();
    sort_ids(&mut nodes);
    sort_ids(&mut edges);
    sort_ids(&mut b.claims);
    links::enrich_tests(&mut nodes, &edges);
    let partial =
        !b.failures.is_empty() || b.claims.iter().any(|claim| claim["gateRelevant"] == true);
    Ok(
        json!({"metadata":metadata,"nodes":nodes,"edges":edges,"completeness":{"score":if partial{0}else{1},"partial":partial,"parserFailures":b.failures,"unsupportedClaims":b.claims}}),
    )
}
