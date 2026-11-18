use crate::{
    common::{digest, document, items, s},
    gate::evaluate_gate,
    runtime::{prepare_ingest, validate_gate_input, validate_output, verify_evidence},
    storage::{self, Files},
};
use anyhow::{Context, Result, ensure};
use serde_json::{Value, json};
use std::{collections::BTreeSet, path::Path};

struct Plan {
    report: Value,
    original: String,
    candidate: String,
}
fn issues(list: &mut Vec<String>, report: &Value) {
    for i in items(&report["issues"]) {
        list.push(format!("{} {}", s(&i["path"]), s(&i["message"])))
    }
}
fn plan(root: &Path, config: Option<&Value>, original: Option<String>) -> Result<Plan> {
    let original = match original {
        Some(v) => v,
        None => storage::read_input(root)?,
    };
    let input: Value = serde_json::from_str(&original)?;
    let hash = digest(original.as_bytes());
    let mut missing = Vec::new();
    let mut notes = vec![
        "Dry-run never writes. Graph, execution history, waivers, approval evidence and retention records are preserved.",
        "A policy change can require fresh approval; migration does not grant release approval or fabricate execution evidence.",
    ];
    let mut report = json!({"migrationVersion":"qeg-consumer-migration/v1","status":"needs_configuration","inputHash":hash,"missingInputs":[],"changes":[],"notes":notes});
    let Some(config) = config else {
        missing.push("Explicit configuration: migrationVersion, expectedInputHash, complete policy including inputContract".into());
        if input["policy"]["inputContract"].is_null() {
            missing.push("policy.inputContract: mode, requiredArtifacts, evaluationScope, requireExecutedTests, sourceRefs".into())
        }
        if input["policy"]["executionPolicy"].is_null() {
            missing.push("policy.executionPolicy: target (project/build/revision/environment), maxEvidenceAgeHours, buildBindingRef, sourceRefs when execution is required".into())
        }
        report["missingInputs"] = json!(missing);
        return Ok(Plan {
            report,
            original,
            candidate: String::new(),
        });
    };
    let validation = validate_output(config, "consumer-migration.schema.json")?;
    issues(&mut missing, &validation);
    let p = &config["policy"];
    let old = &input["policy"];
    if p["inputContract"].is_null() {
        missing.push("Explicit policy.inputContract is required".into())
    }
    if p["inputContract"]["requireExecutedTests"] == true && p["executionPolicy"].is_null() {
        missing.push("Explicit policy.executionPolicy is required for executed tests".into())
    }
    if p["profile"] != old["profile"] {
        missing.push("Migration cannot change the existing profile".into())
    }
    for k in [
        "dqScope",
        "exitCodePolicy",
        "reliabilityPolicy",
        "placementRetirementPolicy",
    ] {
        if old.get(k) != p.get(k) {
            missing.push(format!("Migration must preserve policy.{k}"))
        }
    }
    let keys: BTreeSet<_> = [old, p]
        .into_iter()
        .filter_map(Value::as_object)
        .flat_map(|m| m.keys())
        .collect();
    let mut changes: Vec<_> = keys
        .into_iter()
        .filter(|k| old.get(k.as_str()) != p.get(k.as_str()))
        .map(|k| json!({"path":format!("/policy/{k}"),"before":old[k],"after":p[k]}))
        .collect();
    let mut next = input.clone();
    ensure!(next.is_object(), "Invalid migration input");
    next["policy"] = p.clone();
    for path in ["/metadata", "/graph/metadata", "/placementPlan/metadata"] {
        if let Some(metadata) = next.pointer_mut(path).and_then(Value::as_object_mut) {
            for k in ["policyId", "policyHash"] {
                if let Some(v) = p.get(k) {
                    metadata.insert(k.into(), v.clone());
                } else {
                    metadata.remove(k);
                }
            }
            if input.pointer(path) != next.pointer(path) {
                changes.push(
                    json!({"path":path,"before":input.pointer(path),"after":next.pointer(path)}),
                )
            }
        }
    }
    let schema = validate_gate_input(&next)?;
    issues(&mut missing, &schema);
    let prepared = if let Some(input) = schema.get("input") {
        match prepare_ingest(input.clone(), true) {
            Ok(v) => Some(v),
            Err(e) => {
                missing.push(e.to_string());
                None
            }
        }
    } else {
        None
    };
    if !changes.is_empty() {
        if config["expectedInputHash"] != hash {
            missing.push("expectedInputHash mismatch: consumer changed since review".into())
        }
        if p["policyHash"] == old["policyHash"] {
            missing.push("Changed policy requires an explicit new policyHash; existing approvals remain attached to their original policy".into())
        }
    }
    let candidate = if changes.is_empty() {
        original.clone()
    } else {
        document(&next)?
    };
    if missing.is_empty()
        && let Some(mut prepared) = prepared
    {
        let verification = verify_evidence(&prepared, root)?;
        let preflight:Vec<_>=items(&verification["items"]).iter().filter(|i|i["severity"]=="fail").map(|i|json!({"code":"DQ-06","nodeIds":[],"message":i["message"],"sourceRefs":[{"id":i["artifactId"],"path":i["path"].as_str().unwrap_or("gate-input.json")}]})).collect();
        prepared["evidenceVerification"] = verification;
        prepared["preflightDisqualifications"] = json!(preflight);
        if prepared["waivers"].is_null() {
            prepared["waivers"] = json!([])
        }
        let result = evaluate_gate(&prepared)?;
        report["gate"] = json!({"verdict":result["verdict"],"disqualifications":items(&result["disqualifications"]).iter().map(|i|&i["code"]).collect::<Vec<_>>()});
        if p["inputContract"]["requireExecutedTests"] != true {
            notes.push("Planning-only scope: executed-test acceptance has not been granted.")
        }
    }
    report["status"] = json!(if !missing.is_empty() {
        "blocked"
    } else if changes.is_empty() {
        "unchanged"
    } else {
        "ready"
    });
    report["missingInputs"] = json!(missing);
    report["outputHash"] = json!(digest(candidate.as_bytes()));
    report["changes"] = json!(changes);
    report["notes"] = json!(notes);
    Ok(Plan {
        original,
        candidate,
        report,
    })
}
fn ready(plan: &Plan) -> Result<()> {
    ensure!(
        plan.report["status"] == "ready",
        "Migration blocked: {}",
        items(&plan.report["missingInputs"])
            .iter()
            .map(s)
            .collect::<Vec<_>>()
            .join("; ")
    );
    Ok(())
}
pub fn migrate(root: &Path, config: Option<&Value>, apply: bool) -> Result<Value> {
    storage::with_lease(root, |root| {
        if !apply {
            return Ok(plan(root, config, None)?.report);
        }
        let config = config.context("Migration requires explicit configuration")?;
        if let Some(p) = storage::pending(root)?
            && !p.committed
        {
            let original = p
                .before
                .get("gate-input.json")
                .and_then(Option::as_ref)
                .filter(|_| p.before.contains_key("migration-report.json"))
                .context("Another publication was interrupted; run outputs recover")?;
            ready(&plan(root, Some(config), Some(original.clone()))?)?;
            storage::recover_pending(root)?;
        }
        let mut result = plan(root, Some(config), None)?;
        if result.report["status"] == "unchanged" {
            let Some(receipt) = storage::optional(&root.join("migration-report.json"))? else {
                return Ok(result.report);
            };
            let previous: Value = serde_json::from_str(&receipt)?;
            if previous["inputHash"] != config["expectedInputHash"]
                || previous["outputHash"] != result.report["inputHash"]
                || storage::committed_file(root, "migration-report.json", &receipt)?
            {
                return Ok(result.report);
            }
            let original = storage::optional(&root.join("migration-original.json"))?
                .context("Interrupted migration backup is missing")?;
            ensure!(
                config["expectedInputHash"] == digest(original.as_bytes()),
                "Interrupted migration backup hash mismatch"
            );
            result = plan(root, Some(config), Some(original))?;
        }
        ready(&result)?;
        result.report["status"] = json!("applied");
        let mut files = Files::new();
        files.insert("migration-original.json".into(), result.original);
        files.insert("migration-report.json".into(), document(&result.report)?);
        files.insert("gate-input.json".into(), result.candidate);
        storage::publish(root, &files)?;
        Ok(result.report)
    })
}
