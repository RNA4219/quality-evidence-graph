use super::adapter::*;
use crate::common::{items, s};
use anyhow::{Result, bail, ensure};
use serde_json::{Value, json};

fn layer(raw: &Value) -> Option<&'static str> {
    match s(raw) {
        "unit" => Some("unit"),
        "integration" | "component" | "contract" | "api" => Some("integration"),
        "system" | "security" | "performance" => Some("system"),
        "e2e" => Some("e2e"),
        "manual" => Some("manual-scripted"),
        "exploratory" => Some("manual-exploratory"),
        _ => None,
    }
}
fn severity(v: &Value) -> Result<&str> {
    match s(v) {
        x @ ("critical" | "high" | "medium" | "low" | "info") => Ok(x),
        x => bail!("Unknown severity {x}"),
    }
}
fn changed(c: &Context, raw: &Value) -> Vec<String> {
    let mut ids = Vec::new();
    for evidence in items(&raw["evidence"]) {
        if let Some(id) = c.changes.get(&norm_path(s(&evidence["path"])))
            && !ids.contains(id)
        {
            ids.push(id.clone());
        }
    }
    ids
}
fn edge(out: &mut Normalized, c: &Context, from: &str, to: &str, kind: &str) {
    out.edges.push(json!({"id":stable_id("ctg","edge",&format!("{from}/{kind}/{to}")),"from":from,"to":to,"kind":kind,
        "traceability":trace(c.descriptor,&format!("{from}/{to}"),&Value::Null)}));
}
fn diff(c: &Context, out: &mut Normalized) -> Result<()> {
    for file in rows(&c.raw["changed_files"], "changed_files")? {
        let path = norm_path(text(&file["path"], "changed file path")?);
        let hunks=items(&file["hunks"]).iter().enumerate().map(|(index,h)|{
            let mut hunk=json!({"id":stable_id("ctg","hunk",&format!("{path}/{index}")),"path":path,"startLine":h["startLine"],"endLine":h["endLine"]});
            if let Some(rev)=c.descriptor.get("revision"){hunk["revision"]=rev.clone();} hunk
        }).collect::<Vec<_>>();
        out.nodes.push(merge(base(c.descriptor,"changed_code",&path,&path,file),json!({"path":path,"symbols":strings(&file["symbols"]),"blastRadius":strings(&c.raw["blast_radius"]["affectedFiles"]).len(),"hunks":hunks})));
    }
    Ok(())
}
fn findings(c: &Context, out: &mut Normalized) -> Result<()> {
    for item in rows(&c.raw["findings"], "findings")? {
        required(
            item,
            &[
                "id",
                "title",
                "ruleId",
                "severity",
                "confidence",
                "evidence",
            ],
        )?;
        let ids = changed(c, item);
        let node = merge(
            base(
                c.descriptor,
                "finding",
                text(&item["id"], "finding id")?,
                text(&item["title"], "finding title")?,
                item,
            ),
            json!({
                "ruleId":text(&item["ruleId"],"ruleId")?,"severity":severity(&item["severity"])?,"changedCodeIds":ids
            }),
        );
        for id in ids {
            edge(out, c, s(&node["id"]), &id, "touches");
        }
        out.nodes.push(node);
    }
    for claim in rows(&c.raw["unsupported_claims"], "unsupported_claims")? {
        out.claims.push(json!({"id":stable_id("ctg","claim",text(&claim["id"],"claim id")?),"claim":text(&claim["claim"],"claim")?,"nodeIds":[],"gateRelevant":true}));
    }
    Ok(())
}
fn risks(c: &Context, out: &mut Normalized) -> Result<()> {
    for item in rows(&c.raw["risks"], "risks")? {
        required(
            item,
            &[
                "id",
                "title",
                "severity",
                "likelihood",
                "evidence",
                "sourceFindingIds",
            ],
        )?;
        let level = severity(&item["severity"])?;
        let (rank, impact) = match level {
            "critical" => ("P0", 1.0),
            "high" => ("P1", 0.8),
            "medium" => ("P2", 0.5),
            _ => ("P3", 0.5),
        };
        let likelihood = item["likelihood"]
            .as_f64()
            .unwrap_or(match s(&item["likelihood"]) {
                "high" => 0.8,
                "low" => 0.2,
                _ => 0.5,
            });
        let node = merge(
            base(
                c.descriptor,
                "risk",
                text(&item["id"], "risk id")?,
                text(&item["title"], "risk title")?,
                item,
            ),
            json!({
                "priority":rank,"severity":level,"likelihood":likelihood,"businessImpact":impact,"complianceCriticality":0,"evidenceGap":1,"novelty":0.5
            }),
        );
        for finding in strings(&item["sourceFindingIds"]) {
            edge(
                out,
                c,
                s(&node["id"]),
                &stable_id("ctg", "finding", &finding),
                "derives_from",
            );
        }
        for change in changed(c, item) {
            edge(out, c, s(&node["id"]), &change, "touches");
        }
        out.nodes.push(node);
    }
    Ok(())
}
fn seeds(c: &Context, out: &mut Normalized) -> Result<()> {
    for item in rows(&c.raw["seeds"], "seeds")? {
        required(
            item,
            &[
                "id",
                "title",
                "sourceRiskIds",
                "sourceFindingIds",
                "suggestedLevel",
                "evidence",
            ],
        )?;
        let layer = layer(&item["suggestedLevel"]).ok_or_else(|| {
            anyhow::anyhow!("Unknown suggestedLevel: {}", s(&item["suggestedLevel"]))
        })?;
        let risks = strings(&item["sourceRiskIds"])
            .iter()
            .map(|id| stable_id("ctg", "risk", id))
            .collect::<Vec<_>>();
        let node = merge(
            base(
                c.descriptor,
                "test",
                text(&item["id"], "seed id")?,
                text(&item["title"], "seed title")?,
                item,
            ),
            json!({
                "layer":layer,"existing":false,"testExecutionMode":"real","oracleType":"missing","expectedResults":[],"oracleRefs":[],"coveredRiskIds":risks,"coveredChangedCodeIds":changed(c,item)
            }),
        );
        for risk in risks {
            edge(out, c, &risk, s(&node["id"]), "requires_test");
        }
        for finding in strings(&item["sourceFindingIds"]) {
            edge(
                out,
                c,
                s(&node["id"]),
                &stable_id("ctg", "finding", &finding),
                "derives_from",
            );
        }
        out.nodes.push(node);
    }
    Ok(())
}
fn repo(c: &Context, out: &mut Normalized) -> Result<()> {
    let files = rows(&c.raw["files"], "files")?;
    for item in rows(&c.raw["tests"], "tests")? {
        let id = text(&item["id"], "existing test id")?;
        let file = files.iter().find(|f| f["id"] == item["fileId"]);
        let title = first(item, &["name", "title", "path"])
            .as_str()
            .or_else(|| file?.get("path")?.as_str())
            .unwrap_or(id);
        let layer = layer(first(item, &["level", "layer", "kind"])).unwrap_or("unit");
        let mut node = merge(
            base(c.descriptor, "test", id, title, item),
            json!({"layer":layer,"existing":true,"testExecutionMode":"real","oracleType":"missing","coveredRiskIds":[],"coveredChangedCodeIds":[]}),
        );
        if item["command"].is_string() {
            node["command"] = item["command"].clone();
        }
        out.nodes.push(node);
    }
    for diagnostic in rows(&c.raw["diagnostics"], "diagnostics")? {
        if diagnostic["severity"] == "error" {
            out.failures.push(json!({"path":c.descriptor["path"],"reason":diagnostic["message"],"sourceRefs":trace(c.descriptor,"/diagnostics",&Value::Null)["sourceRefs"]}));
        }
    }
    Ok(())
}
pub(super) fn normalize(c: &Context) -> Result<Normalized> {
    let kind = s(&c.descriptor["kind"]);
    let name = kind.replace('_', "-");
    ensure!(
        c.descriptor["contractVersion"] == "ctg-artifacts/v1"
            && c.raw["artifact"] == name
            && c.raw["schema"] == format!("{name}@v1"),
        "Expected {name}@v1 producer contract"
    );
    let mut out = Normalized::default();
    let fields: &[&str] = match kind {
        "normalized_repo_graph" => &[
            "files",
            "modules",
            "symbols",
            "relations",
            "tests",
            "configs",
            "entrypoints",
            "diagnostics",
            "stats",
        ],
        "diff_analysis" => &["changed_files", "blast_radius", "diff_findings"],
        "findings" => &["completeness", "findings", "unsupported_claims"],
        "risk_register" => &["completeness", "risks"],
        "test_seeds" => &["completeness", "seeds"],
        "release_readiness" => &[
            "status",
            "completeness",
            "summary",
            "counts",
            "failedConditions",
            "recommendedActions",
            "artifactRefs",
        ],
        "audit" => &["inputs", "policy", "exit"],
        _ => bail!("Unsupported CTG artifact {kind}"),
    };
    required(c.raw, fields)?;
    match kind {
        "diff_analysis" => diff(c, &mut out)?,
        "findings" => findings(c, &mut out)?,
        "risk_register" => risks(c, &mut out)?,
        "test_seeds" => seeds(c, &mut out)?,
        "normalized_repo_graph" => repo(c, &mut out)?,
        "release_readiness" => {
            out.nodes
                .push(decision(c, "release-readiness", &c.raw["status"], c.raw)?)
        }
        "audit" => {
            rows(&c.raw["inputs"], "audit.inputs")?;
            ensure!(
                c.raw["policy"].is_object() && c.raw["exit"].is_object(),
                "Invalid audit policy or exit"
            );
        }
        _ => bail!("Unsupported CTG artifact {kind}"),
    }
    if c.raw["completeness"] == "partial"
        || kind == "normalized_repo_graph" && c.raw["stats"]["partial"] == true
    {
        out.failures.push(json!({"path":c.descriptor["path"],"reason":"CTG completeness is partial","sourceRefs":trace(c.descriptor,"/completeness",&Value::Null)["sourceRefs"]}));
    }
    Ok(out)
}
