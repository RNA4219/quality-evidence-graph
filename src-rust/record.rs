use crate::{
    common::{digest, document, items, s},
    runtime::assert_output,
    storage::{self, Files},
};
use anyhow::{Context, Result};
use indexmap::{IndexMap, IndexSet};
use serde_json::{Value, json};
use std::path::Path;

fn joined(v: &Value) -> String {
    items(v).iter().map(s).collect::<Vec<_>>().join(", ")
}
fn markdown(e: &Value) -> String {
    let g = &e["gateResult"];
    let mut lines = vec![
        "# Quality Evidence Record".into(),
        String::new(),
        format!("Gate: **{}**", s(&g["verdict"])),
        String::new(),
    ];
    if let Some(scope) = g.get("evaluationScope") {
        let excluded = joined(&scope["notEvaluated"]);
        lines.extend([
            format!("評価範囲: {} / {}", s(&scope["kind"]), s(&scope["target"])),
            format!(
                "未評価: {}",
                if excluded.is_empty() {
                    "明記なし"
                } else {
                    &excluded
                }
            ),
            String::new(),
        ])
    }
    lines.extend(["## 判定理由".into(), String::new()]);
    lines.extend(items(&g["reasons"]).iter().map(|v| format!("- {}", s(v))));
    lines.extend([String::new(), "## テスト配置".into(), String::new()]);
    for p in items(&e["placementPlan"]["placements"]) {
        let tests = joined(&p["selectedTestIds"]);
        lines.push(format!(
            "- {}: {} / {}; tests: {}",
            s(&p["obligationId"]),
            s(&p["primaryLayer"]),
            s(&p["disposition"]),
            if tests.is_empty() {
                "未配置"
            } else {
                &tests
            }
        ));
    }
    lines.extend([
        String::new(),
        "## 残存リスク・人間の確認".into(),
        String::new(),
    ]);
    for (k, label) in [("residualRisks", "risk"), ("requiredHumanReview", "review")] {
        for v in items(&g[k]) {
            lines.push(format!("- {label}: {}", s(v)))
        }
    }
    lines.extend([String::new(), "## 証跡".into(), String::new()]);
    for a in items(&e["metadata"]["inputArtifacts"]) {
        lines.push(format!(
            "- {}/{}: {} ({})",
            s(&a["adapter"]),
            s(&a["kind"]),
            s(&a["path"]),
            a["contentHash"].as_str().unwrap_or("hash未指定")
        ))
    }
    if let Some(a) = g.get("executionAccounting") {
        lines.extend([
            String::new(),
            "実行証跡の採用".into(),
            format!("- 評価時計: {}", s(&a["evaluatedAt"])),
        ]);
        if let Some(t) = a.get("target") {
            lines.push(format!(
                "- 対象: {} / {} / {} / {}",
                s(&t["projectId"]),
                s(&t["buildId"]),
                s(&t["environmentId"]),
                s(&t["revision"])
            ))
        }
        for v in items(&a["selections"]) {
            let field = |k: &str| v[k].as_str().unwrap_or("none");
            lines.push(format!(
                "- {}: run={}; evidence={}; status={}; reason={}; consecutivePasses={}",
                s(&v["testId"]),
                field("selectedRunId"),
                field("selectedEvidenceId"),
                field("selectedStatus"),
                s(&v["reason"]),
                v["consecutivePasses"]
            ));
            for ex in items(&v["excluded"]) {
                lines.push(format!(
                    "  - excluded={}; reason={}",
                    s(&ex["evidenceId"]),
                    s(&ex["reason"])
                ))
            }
        }
    }
    lines.join("\n") + "\n"
}
fn picked(value: &Value, fields: &[&str]) -> Value {
    let mut obj = json!({});
    for &key in fields {
        if let Some(v) = value.get(key) {
            obj[key] = v.clone()
        }
    }
    obj
}
fn slug(value: &str) -> String {
    value
        .encode_utf16()
        .map(|b| {
            if b <= 127 && (b as u8).is_ascii_alphanumeric() || b == 95 || b == 45 {
                char::from(b as u8)
            } else {
                '-'
            }
        })
        .collect()
}
fn evidence_ids<'a>(package: &'a Value, defect: &'a Value) -> IndexSet<&'a str> {
    let mut ids = IndexSet::new();
    if !items(&defect["evidenceRefs"]).is_empty() {
        ids.extend(
            items(&defect["evidenceRefs"])
                .iter()
                .filter_map(Value::as_str),
        );
    } else {
        for k in [
            "inputArtifactHashes",
            "approvalEvidence",
            "manualEvidence",
            "sourceRefs",
        ] {
            for item in items(&package[k]) {
                if k == "manualEvidence" {
                    ids.extend(
                        items(&item["evidenceRefs"])
                            .iter()
                            .filter_map(|v| v["id"].as_str()),
                    )
                } else if let Some(id) = item["id"].as_str() {
                    ids.insert(id);
                }
            }
        }
    }
    ids.retain(|v| !v.is_empty());
    ids
}
fn efficacy(e: &Value, graph: &mut Value) -> Result<(Vec<Value>, Vec<Value>)> {
    let package = &e["evidencePackage"];
    let outputs = &package["qegOutputs"];
    let run = s(&e["metadata"]["runId"]);
    let mut records = Vec::new();
    let mut proposals = IndexMap::<(&str, &str), (IndexSet<&str>, Vec<&Value>)>::new();
    for d in items(&e["optionalEvidence"]["escapedDefects"]) {
        let id = s(&d["id"]);
        let verdict = d["verdictRef"]
            .as_str()
            .or(outputs["gateVerdict"]["id"].as_str())
            .map(str::to_owned)
            .unwrap_or_else(|| format!("{run}:gate-verdict"));
        let placement = d["placementPlanRef"]
            .as_str()
            .or(outputs["testPlacementPlan"]["id"].as_str())
            .map(str::to_owned)
            .unwrap_or_else(|| format!("{run}:placement-plan"));
        let ids = evidence_ids(package, d);
        let refs = &d["sourceRefs"];
        let mut back = picked(d, &["id", "title", "severity", "discoveredAt"]);
        back["linkedVerdictRef"] = json!(verdict);
        back["linkedPlacementPlanRef"] = json!(placement);
        back["linkedEvidenceRefs"] = json!(ids);
        back["sourceRefs"] = refs.clone();
        let notes = d["analysisNotes"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| {
                format!("Escaped defect {id} was reported after verdict {verdict}.")
            });
        records.push(json!({"verdict_ref":verdict,"escaped_defects":[back],"evidence_used":ids,"policy_hash_at_verdict":e["policy"]["policyHash"],"analysis_notes":notes}));
        let trace = json!({"sourceRefs":refs,"assumptions":[],"confidence":"medium"});
        let mut node = json!({"id":id,"kind":"escaped_defect","title":d["title"],"severity":d["severity"],"discoveredAt":d["discoveredAt"],"linkedVerdictRef":verdict,"linkedPlacementPlanRef":placement,"linkedEvidenceRefs":ids,"traceability":trace,"sourceArtifactIds":items(refs).iter().map(|r|&r["id"]).collect::<Vec<_>>()});
        node["traceability"]["assumptions"] =
            json!(["Escaped defect is optional evidence and does not mutate historical verdicts."]);
        graph["nodes"]
            .as_array_mut()
            .context("graph.nodes is required")?
            .push(node);
        let edges = graph["edges"]
            .as_array_mut()
            .context("graph.edges is required")?;
        for (suffix, to) in [("verdict", &verdict), ("placement", &placement)] {
            edges.push(json!({"id":format!("{id}:contradicts-{suffix}"),"kind":"contradicts","from":id,"to":to,"traceability":trace}))
        }
        for evidence in ids {
            edges.push(json!({"id":format!("{id}:evidenced-by:{}",slug(evidence)),"kind":"evidenced_by","from":id,"to":evidence,"traceability":trace}))
        }
        for (key, scope) in [
            ("affectedPolicyRefs", "policy"),
            ("affectedPlacementRefs", "placement"),
        ] {
            for t in items(&d[key]) {
                let entry = proposals.entry((scope, s(t))).or_default();
                entry.0.insert(id);
                entry.1.extend(items(refs));
            }
        }
    }
    let mut proposals:Vec<_>=proposals.into_iter().map(|((scope,target),(defects,refs))|json!({"id":format!("qeg:recalibration-proposal:{scope}:{}",slug(target)),"scope":scope,"targetRef":target,"reason":format!("Escaped defects indicate degraded {scope} efficacy. Human approval is required before mutation."),"escapedDefectRefs":defects,"status":"proposed","sourceRefs":refs})).collect();
    proposals.sort_by_cached_key(|v| s(&v["id"]).to_ascii_lowercase());
    Ok((records, proposals))
}
pub fn artifacts(e: &Value) -> Result<(Value, Files)> {
    let plan = e
        .get("placementPlan")
        .filter(|v| !v.is_null())
        .cloned()
        .unwrap_or_else(|| json!({"metadata":e["metadata"],"obligations":[],"placements":[]}));
    let mut graph = e["graph"].clone();
    let (efficacy, proposals) = efficacy(e, &mut graph)?;
    let mut files = Files::new();
    for (name, v) in [
        ("qeg.bundle.json", &graph),
        ("test-placement-plan.json", &plan),
        ("gate-verdict.json", &e["gateResult"]),
    ] {
        files.insert(name.into(), document(v)?);
    }
    files.insert("quality-evidence-record.md".into(), markdown(e));
    let exports:Vec<_>=files.iter().map(|(path,bytes)|json!({"kind":if path.ends_with(".md"){"markdown"}else{"json"},"path":path,"contentHash":digest(bytes.as_bytes())})).collect();
    let mut record = json!({"metadata":e["metadata"],"graph":graph,"placementPlan":plan,"gate":e["gateResult"],"exports":exports});
    if let Some(p) = e.get("evidencePackage").filter(|v| !v.is_null()) {
        let approvals: Vec<_> = items(&p["approvalEvidence"])
            .iter()
            .map(|a| {
                picked(
                    a,
                    &[
                        "id",
                        "approver",
                        "approvedAt",
                        "policyId",
                        "policyHash",
                        "evidencePackageHash",
                    ],
                )
            })
            .collect();
        let mut audit = picked(p, &["evidencePackageHash"]);
        audit["approvalEvidenceSummary"] = json!(approvals);
        audit["gatePolicyHash"] = e["policy"]["policyHash"].clone();
        audit["gatePolicyId"] = e["policy"]["policyId"].clone();
        record["auditTrail"] = audit;
    }
    if !efficacy.is_empty() {
        record["gateEfficacyRecords"] = json!(efficacy)
    }
    if !proposals.is_empty() {
        record["recalibrationProposals"] = json!(proposals)
    }
    let bytes = document(&record)?;
    files.insert("quality-evidence-record.json".into(), bytes.clone());
    files.insert("output-record.json".into(), bytes);
    let entries: Vec<_> = files
        .iter()
        .map(|(path, bytes)| json!({"path":path,"contentHash":digest(bytes.as_bytes())}))
        .collect();
    files.insert("output-manifest.json".into(),document(&json!({"manifestVersion":"qeg-output/v1","runId":e["metadata"]["runId"],"files":entries}))?);
    Ok((record, files))
}
pub fn write(e: &Value) -> Result<()> {
    let (_, files) = artifacts(e)?;
    for (name, schema) in [
        ("qeg.bundle.json", "qeg.bundle"),
        ("test-placement-plan.json", "test-placement-plan"),
        ("gate-verdict.json", "gate-verdict"),
        ("quality-evidence-record.json", "quality-evidence-record"),
        ("output-record.json", "quality-evidence-record"),
        ("output-manifest.json", "output-manifest"),
    ] {
        assert_output(
            &serde_json::from_str(&files[name])?,
            &format!("{schema}.schema.json"),
        )?;
    }
    storage::publish(Path::new(s(&e["fixtureDir"])), &files)
}
