use super::adapter::*;
use crate::common::{items, s};
use anyhow::{Result, bail, ensure};
use serde_json::{Value, json};

pub(super) fn scoped_id(project: &str, feature: &str, kind: &str, local: &str) -> String {
    if local
        .split_once(':')
        .is_some_and(|(p, _)| matches!(p, "rand" | "ctg" | "hate" | "qeg" | "mbb"))
    {
        return local.into();
    }
    stable_id("mbb", kind, &json!([project, feature, local]).to_string())
}
fn id(c: &Context, kind: &str, local: &str) -> String {
    scoped_id(
        s(&c.descriptor["executionContext"]["projectId"]),
        s(&c.raw["feature_id"]),
        kind,
        local,
    )
}
fn node(c: &Context, kind: &str, local: &str, title: &str, raw: &Value, fields: Value) -> Value {
    let mut n = base(c.descriptor, kind, local, title, raw);
    n["id"] = json!(id(c, kind, local));
    merge(n, fields)
}
fn identity(c: &Context, case_id: &str) -> Value {
    json!({"producer":"manual-bb-test-harness","projectId":c.descriptor["executionContext"]["projectId"],"featureId":c.raw["feature_id"],"caseId":case_id})
}
fn relation(out: &mut Normalized, c: &Context, from: &str, to: &str, kind: &str) {
    out.edges.push(json!({"id":stable_id("mbb","edge",&json!([from,kind,to]).to_string()),"from":from,"to":to,"kind":kind,"traceability":trace(c.descriptor,&format!("{from}/{to}"),&Value::Null)}));
}
fn feature(c: &Context, out: &mut Normalized) -> Result<()> {
    let raw = c.raw;
    required(
        raw,
        &["feature_id", "title", "acceptance_criteria", "source_refs"],
    )?;
    let local = s(&raw["feature_id"]);
    let feature_id = id(c, "requirement", local);
    let mut acceptance = Vec::new();
    for (index, item) in items(&raw["acceptance_criteria"]).iter().enumerate() {
        let title = if item.is_string() {
            text(item, "acceptance criterion text")?
        } else {
            text(
                first(item, &["text", "description", "title"]),
                "acceptance criterion text",
            )?
        };
        let default = format!("AC-{}", index + 1);
        let local_ac = format!("{local}/{}", item["id"].as_str().unwrap_or(&default));
        let ac = node(
            c,
            "acceptance_criteria",
            &local_ac,
            title,
            raw,
            json!({"requirementIds":[feature_id],"oracleRefs":[evidence_ref(c.descriptor,&format!("/acceptance_criteria/{index}"),"spec")]}),
        );
        acceptance.push(ac["id"].clone());
        relation(out, c, &feature_id, s(&ac["id"]), "satisfies");
        out.nodes.push(ac);
    }
    out.nodes.push(node(
        c,
        "requirement",
        local,
        text(&raw["title"], "feature title")?,
        raw,
        json!({"acceptanceCriteriaIds":acceptance}),
    ));
    for path in strings(&raw["changed_areas"]) {
        if let Some(changed) = c.changes.get(&norm_path(&path)) {
            relation(out, c, &feature_id, changed, "touches");
        }
    }
    Ok(())
}
fn scale(v: &Value, label: &str) -> Result<f64> {
    let x = v
        .as_f64()
        .filter(|x| (1.0..=5.0).contains(x))
        .ok_or_else(|| anyhow::anyhow!("{label} must be in 1..5"))?;
    Ok(x / 5.0)
}
fn risks(c: &Context, out: &mut Normalized) -> Result<()> {
    for item in rows(&c.raw["risks"], "risks")? {
        required(
            item,
            &["id", "scenario", "impact", "likelihood", "priority"],
        )?;
        let rank = s(&item["priority"]);
        let severity = match rank {
            "P0" => "critical",
            "P1" => "high",
            "P2" => "medium",
            "P3" => "low",
            p => bail!("Invalid manual priority {p}"),
        };
        let risk = node(
            c,
            "risk",
            text(&item["id"], "risk id")?,
            text(&item["scenario"], "risk scenario")?,
            item,
            json!({"priority":rank,"severity":severity,"likelihood":scale(&item["likelihood"],"likelihood")?,"businessImpact":scale(&item["impact"],"impact")?,"complianceCriticality":0,"evidenceGap":1,"novelty":0.5}),
        );
        relation(
            out,
            c,
            &id(c, "requirement", s(&c.raw["feature_id"])),
            s(&risk["id"]),
            "risks",
        );
        for reference in strings(&item["trace_to"]) {
            if ["TC", "CHARTER", "mbb:test"]
                .iter()
                .any(|p| reference.starts_with(p))
            {
                relation(
                    out,
                    c,
                    s(&risk["id"]),
                    &id(c, "test", &reference),
                    "requires_test",
                );
            }
        }
        out.nodes.push(risk);
    }
    Ok(())
}
fn risk_ref(reference: &str) -> bool {
    ["RISK", "ctg:", "rand:risk", "mbb:risk"]
        .iter()
        .any(|prefix| reference.starts_with(prefix))
        || reference
            .strip_prefix("R-")
            .is_some_and(|suffix| suffix.as_bytes().first().is_some_and(u8::is_ascii_digit))
}
fn cases(c: &Context, out: &mut Normalized) -> Result<()> {
    required(c.raw, &["manual_cases"])?;
    let requirement = id(c, "requirement", s(&c.raw["feature_id"]));
    for (kind, exploratory) in [("manual_cases", false), ("exploratory_charters", true)] {
        for item in items(&c.raw[kind]) {
            required(
                item,
                if exploratory {
                    &["id", "title", "scope", "questions", "trace_to"][..]
                } else {
                    &["tc_id", "title", "expected_results", "oracle", "trace_to"]
                },
            )?;
            let local = text(&item[if exploratory { "id" } else { "tc_id" }], "case id")?;
            let oracle = &item["oracle"];
            let oracle_type = match s(&oracle["type"]) {
                v @ ("specified" | "derived" | "implicit" | "human") => v,
                _ => "missing",
            };
            let refs: Vec<_> = strings(&oracle["refs"])
                .iter()
                .map(|x| evidence_ref(c.descriptor, &format!("{local}/oracle/{x}"), "spec"))
                .collect();
            let expected = strings(&item["expected_results"]);
            let risks: Vec<_> = strings(&item["trace_to"])
                .iter()
                .filter(|x| risk_ref(x))
                .map(|x| id(c, "risk", x))
                .collect();
            let test = node(
                c,
                "test",
                local,
                text(first(item, &["title", "mission"]), "case title")?,
                item,
                json!({
                    "executionIdentity":identity(c,local),"layer":if exploratory{"manual-exploratory"}else{"manual-scripted"},"existing":true,"testExecutionMode":"real","oracleType":oracle_type,
                    "oracleRefs":refs,"expectedResults":expected,"coverageDimensions":strings(&item["techniques"]),"coveredRiskIds":risks,"coveredRequirementIds":[requirement]
                }),
            );
            relation(out, c, &requirement, s(&test["id"]), "requires_test");
            for risk in risks {
                relation(out, c, &risk, s(&test["id"]), "requires_test");
            }
            if !exploratory && (expected.is_empty() || refs.is_empty()) {
                out.claims.push(json!({"id":id(c,"oracle-gap",local),"claim":format!("Scripted case {local} has no expected result or oracle"),"nodeIds":[test["id"]],"gateRelevant":true}));
            }
            out.nodes.push(test);
        }
    }
    Ok(())
}
fn execution(c: &Context, out: &mut Normalized) -> Result<()> {
    let raw = c.raw;
    let d = c.descriptor;
    let ingest = &d["executionContext"];
    required(raw, &["run_id", "build_id", "timestamp", "result"])?;
    ensure!(
        s(&raw["tc_id"]).is_empty() != s(&raw["charter_id"]).is_empty(),
        "Execution requires exactly one of tc_id or charter_id"
    );
    let case = text(first(raw, &["tc_id", "charter_id"]), "executed case id")?;
    let run = text(&raw["run_id"], "run_id")?;
    let timestamp = text(&raw["timestamp"], "execution timestamp")?;
    ensure!(
        crate::common::timestamp_nanos(&raw["timestamp"]).is_some(),
        "Execution timestamp is invalid"
    );
    let result = s(&raw["result"]);
    ensure!(
        matches!(result, "pass" | "fail" | "skip" | "blocked" | "unknown"),
        "Execution result is invalid"
    );
    ensure!(
        raw.get("env").is_none() || raw["env"] == ingest["environmentId"],
        "Execution environment disagrees with descriptor"
    );
    ensure!(
        !s(&d["contentHash"]).is_empty() && !s(&d["revision"]).is_empty(),
        "Execution raw requires hash and revision"
    );
    let test_id = id(c, "test", case);
    let mut e = node(
        c,
        "execution_evidence",
        &format!("{run}/{case}"),
        &format!("{case}: {result}"),
        raw,
        json!({
            "execution":{"executionVersion":"qeg-execution/v1","testId":test_id,"identity":identity(c,case),"producerVersion":ingest["producerVersion"],"runId":run,
            "target":{"projectId":ingest["projectId"],"environmentId":ingest["environmentId"],"buildId":text(&raw["build_id"],"build_id")?,"revision":d["revision"]},
            "completedAt":timestamp,"status":if result=="skip"{"skipped"}else{result},"executionMode":"real",
            "rawArtifactRef":{"id":d["id"],"path":d["path"],"contentHash":d["contentHash"],"revision":d["revision"]}}
        }),
    );
    if matches!(result, "pass" | "fail") {
        e["passed"] = json!(result == "pass");
    }
    e["evidenceRefs"] = json!([merge(
        evidence_ref(d, "/", "test_result"),
        json!({"capturedAt":timestamp})
    )]);
    relation(out, c, &test_id, s(&e["id"]), "evidenced_by");
    out.nodes.push(e);
    Ok(())
}
pub(super) fn normalize(c: &Context) -> Result<Normalized> {
    let d = c.descriptor;
    let raw = c.raw;
    ensure!(
        d["contractVersion"] == "manual-bb/v1",
        "manual-bb requires manual-bb/v1 manifest contract"
    );
    ensure!(
        d["executionContext"].is_object(),
        "manual-bb requires explicit executionContext"
    );
    let ingest = &d["executionContext"];
    for key in ["projectId", "environmentId", "producerVersion"] {
        text(&ingest[key], key)?;
    }
    text(&raw["feature_id"], "feature_id")?;
    let mut out = Normalized::default();
    match s(&d["kind"]) {
        "feature_spec" => feature(c, &mut out)?,
        "risk_register" => risks(c, &mut out)?,
        "manual_case_set" => cases(c, &mut out)?,
        "execution_evidence" => execution(c, &mut out)?,
        "gate_decision" => {
            required(
                raw,
                &[
                    "build_id",
                    "status",
                    "profile",
                    "reasons",
                    "evidence_summary",
                ],
            )?;
            let target = &c.execution_policy["target"];
            if c.execution_policy.is_null()
                || raw["build_id"] != target["buildId"]
                || ingest["projectId"] != target["projectId"]
                || ingest["environmentId"] != target["environmentId"]
            {
                out.failures.push(json!({"path":d["path"],"reason":"EAC-01 gate_decision target differs from executionPolicy","code":"DQ-12","sourceRefs":trace(d,"/build_id",&Value::Null)["sourceRefs"]}));
            }
            out.nodes.push(decision(
                c,
                &format!("{}/{}/gate", s(&ingest["projectId"]), s(&raw["feature_id"])),
                &raw["status"],
                raw,
            )?);
        }
        v => bail!("Unsupported manual-bb artifact {v}"),
    }
    Ok(out)
}
