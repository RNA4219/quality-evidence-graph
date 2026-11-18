use super::adapter::*;
use crate::common::s;
use anyhow::{Result, ensure};
use serde_json::{Value, json};

fn named(value: &Value, label: &str, key: &str) -> Result<Value> {
    if value.is_string() {
        return Ok(json!({(key):value}));
    }
    ensure!(value.is_object(), "{label} must be an object");
    Ok(value.clone())
}

pub(super) fn normalize(c: &Context) -> Result<Normalized> {
    let descriptor = c.descriptor;
    let raw = c.raw;
    ensure!(
        descriptor["contractVersion"] == "rand-kano/1.0" && raw["schema_version"] == "1.0",
        "RanD requires rand-kano/1.0 and schema_version=1.0"
    );
    let packet = descriptor["kind"] == "requirements_packet";
    ensure!(
        packet || descriptor["kind"] == "requirements_audit_packet",
        "Unsupported RanD artifact {}",
        s(&descriptor["kind"])
    );
    required(
        raw,
        &[
            "schema_version",
            "requirements",
            "assumptions",
            if packet { "packet_id" } else { "document_id" },
        ],
    )?;
    required(
        raw,
        if packet {
            &[
                "derived_from",
                "qeg_policy_hash_ref",
                "product_context",
                "release_readiness_prelude",
            ][..]
        } else {
            &["gate_summary", "source_refs"]
        },
    )?;
    let mut result = Normalized::default();
    for row in rows(&raw["requirements"], "requirements")? {
        let local = text(&row["requirement_id"], "requirement_id")?;
        let title = text(
            first(row, &["title", "statement", "original_text"]),
            "requirement text",
        )?;
        required(
            row,
            if packet {
                &["confidence", "acceptance_criteria", "risks"][..]
            } else {
                &[
                    "confidence",
                    "gate_verdict",
                    "testability",
                    "implementation_alignment",
                ]
            },
        )?;
        let rank = match s(&row["priority"]) {
            r @ ("P0" | "P1" | "P2" | "P3") => r,
            _ => "P2",
        };
        let mut requirement = merge(
            base(descriptor, "requirement", local, title, row),
            json!({"priority":rank,"acceptanceCriteriaIds":[]}),
        );
        let requirement_id = s(&requirement["id"]).to_owned();
        if packet {
            let acs = row["acceptance_criteria"]
                .as_array()
                .ok_or_else(|| anyhow::anyhow!("acceptance_criteria must be an array"))?;
            for value in acs {
                let item = named(value, "acceptance criterion", "text")?;
                let label = text(
                    first(&item, &["text", "description", "criterion", "title"]),
                    "acceptance criterion text",
                )?;
                let id = item["id"].as_str().unwrap_or(label);
                let node = merge(
                    base(
                        descriptor,
                        "acceptance_criteria",
                        &format!("{local}/{id}"),
                        label,
                        row,
                    ),
                    json!({
                        "requirementIds":[requirement_id],"oracleRefs":[evidence_ref(descriptor,&format!("{local}/acceptance_criteria/{id}"),"spec")]
                    }),
                );
                requirement["acceptanceCriteriaIds"]
                    .as_array_mut()
                    .unwrap()
                    .push(node["id"].clone());
                result.edges.push(json!({"id":stable_id("rand","edge",&format!("{requirement_id}/satisfies/{}",s(&node["id"]))),"kind":"satisfies","from":requirement_id,"to":node["id"],"traceability":node["traceability"]}));
                result.nodes.push(node);
            }
        }
        requirement["traceability"]["assumptions"]
            .as_array_mut()
            .unwrap()
            .extend(strings(&raw["assumptions"]).into_iter().map(Value::String));
        result.nodes.push(requirement);
        if packet {
            let risks = row["risks"]
                .as_array()
                .ok_or_else(|| anyhow::anyhow!("risks must be an array"))?;
            for value in risks {
                let item = named(value, "risk", "title")?;
                let label = text(first(&item, &["title", "description", "risk"]), "risk text")?;
                let id = item["id"].as_str().unwrap_or(label);
                let node = merge(
                    base(
                        descriptor,
                        "risk",
                        &format!("{local}/risk/{id}"),
                        label,
                        row,
                    ),
                    json!({
                        "priority":rank,"severity":"medium","likelihood":0.5,"businessImpact":0.5,"complianceCriticality":0,"evidenceGap":1,"novelty":0.5
                    }),
                );
                result.edges.push(json!({"id":stable_id("rand","edge",&format!("{requirement_id}/risks/{}",s(&node["id"]))),"kind":"risks","from":requirement_id,"to":node["id"],"traceability":node["traceability"]}));
                result.nodes.push(node);
            }
        } else {
            result.nodes.push(decision(
                c,
                &format!("audit/{local}"),
                &row["gate_verdict"],
                row,
            )?);
            if row["testability"] == "blocked" {
                result.claims.push(json!({"id":stable_id("rand","oracle-gap",local),"claim":format!("{title}: audit testability is blocked"),"nodeIds":[requirement_id],"gateRelevant":true}));
            }
        }
    }
    if result.nodes.is_empty() {
        result.failures.push(json!({"path":descriptor["path"],"reason":"RanD requirements are empty","sourceRefs":trace(descriptor,"/requirements",&Value::Null)["sourceRefs"]}));
    }
    Ok(result)
}
