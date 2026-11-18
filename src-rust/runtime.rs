use crate::{
    common::{items, s, timestamp_str},
    evidence, gate, storage,
};
use anyhow::{Context, Result, anyhow, ensure};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, HashMap},
    path::Path,
    sync::{Arc, LazyLock, Mutex},
};

type Schemas = BTreeMap<String, Value>;
pub fn schemas() -> Result<&'static Schemas> {
    static SCHEMAS: LazyLock<Result<Schemas, String>> = LazyLock::new(|| {
        crate::assets::ASSETS
            .iter()
            .filter(|(k, _)| k.starts_with("schemas/") && k.ends_with(".schema.json"))
            .map(|(k, bytes)| {
                Ok((
                    k[8..].to_owned(),
                    serde_json::from_slice(bytes).map_err(|e| e.to_string())?,
                ))
            })
            .collect()
    });
    SCHEMAS.as_ref().map_err(|e| anyhow!("{e}"))
}

fn validator(name: &str) -> Result<Arc<jsonschema::Validator>> {
    static CACHE: LazyLock<Mutex<HashMap<String, Arc<jsonschema::Validator>>>> =
        LazyLock::new(Default::default);
    let mut cache = CACHE
        .lock()
        .map_err(|_| anyhow!("Schema cache unavailable"))?;
    if let Some(v) = cache.get(name) {
        return Ok(v.clone());
    }
    let (file, fragment) = name.split_once('#').unwrap_or((name, ""));
    let all = schemas()?;
    let root = all
        .get(file)
        .with_context(|| format!("Output schema unavailable: {name}"))?;
    let mut registry = jsonschema::Registry::new();
    for schema in all.values() {
        registry = registry.add(s(&schema["$id"]), schema)?;
    }
    let registry = registry.prepare()?;
    let reference = json!({"$ref":format!("{}#{fragment}",s(&root["$id"]))});
    let compiled = jsonschema::options()
        .with_draft(jsonschema::Draft::Draft202012)
        .with_registry(&registry)
        .should_validate_formats(true)
        .with_format("date-time", |v: &str| timestamp_str(v).is_some())
        .build(&reference)
        .map_err(|e| anyhow!("Schema {name}: {e}"))?;
    let compiled = Arc::new(compiled);
    cache.insert(name.to_owned(), compiled.clone());
    Ok(compiled)
}
fn issue(path: &str, keyword: &str, message: &str) -> Value {
    let scope = match path.split('/').nth(1).unwrap_or("") {
        key @ ("metadata" | "graph" | "policy" | "evidencePackage" | "placementPlan"
        | "optionalEvidence") => key,
        "waivers" => "waiver",
        _ => "envelope",
    };
    json!({"path":if path.is_empty(){"/"}else{path},"keyword":keyword,"message":message,"scope":scope})
}
pub fn validate_output(value: &Value, schema: &str) -> Result<Value> {
    let validator = validator(schema)?;
    let errors = validator
        .iter_errors(value)
        .map(|e| {
            use jsonschema::error::ValidationErrorKind::*;
            let message = match e.kind() {
                AdditionalProperties { .. } => "must NOT have additional properties".into(),
                UnevaluatedProperties { .. } => "must NOT have unevaluated properties".into(),
                Required { property } => format!("must have required property '{}'", s(property)),
                Constant { .. } => "must be equal to constant".into(),
                Enum { .. } => "must be equal to one of the allowed values".into(),
                Format { format } => format!("must match format \"{format}\""),
                Pattern { pattern } => format!("must match pattern \"{pattern}\""),
                MinItems { limit } => format!("must NOT have fewer than {limit} items"),
                MaxItems { limit } => format!("must NOT have more than {limit} items"),
                MinLength { limit } => format!("must NOT have fewer than {limit} characters"),
                MaxLength { limit } => format!("must NOT have more than {limit} characters"),
                Minimum { limit } => format!("must be >= {limit}"),
                Maximum { limit } => format!("must be <= {limit}"),
                ExclusiveMinimum { limit } => format!("must be > {limit}"),
                ExclusiveMaximum { limit } => format!("must be < {limit}"),
                AnyOf { .. } => "must match a schema in anyOf".into(),
                OneOfNotValid { .. } | OneOfMultipleValid { .. } => {
                    "must match exactly one schema in oneOf".into()
                }
                Not { .. } => "must NOT be valid".into(),
                _ => format!("must satisfy {}", e.kind().keyword()),
            };
            issue(e.instance_path().as_str(), e.kind().keyword(), &message)
        })
        .collect::<Vec<_>>();
    Ok(json!({"valid":errors.is_empty(),"schema":schema,"issues":errors}))
}
pub fn assert_output(value: &Value, schema: &str) -> Result<()> {
    let report = validate_output(value, schema)?;
    ensure!(
        report["valid"] == true,
        "Own-output validation failed ({schema}): {}",
        messages(&report["issues"])
    );
    Ok(())
}
pub fn messages(issues: &Value) -> String {
    items(issues)
        .iter()
        .map(|i| format!("{} {}", s(&i["path"]), s(&i["message"])))
        .collect::<Vec<_>>()
        .join("; ")
}
pub fn validate_gate_input(raw: &Value) -> Result<Value> {
    let structural = validate_output(raw, "gate-input.schema.json")?;
    let semantic = gate::reliability_semantics(raw)
        .into_iter()
        .map(|v| issue(s(&v["path"]), s(&v["ruleId"]), s(&v["message"])));
    let (warnings, issues): (Vec<_>, Vec<_>) = items(&structural["issues"])
        .iter()
        .cloned()
        .chain(semantic)
        .partition(|v| v["scope"] == "optionalEvidence");
    let mut report = json!({"reportVersion":"qeg-gate-input-validation-v2","valid":issues.is_empty(),"issues":issues,"warnings":warnings});
    if issues.is_empty() {
        let mut sanitized = raw.clone();
        if !warnings.is_empty()
            && let Some(o) = sanitized.as_object_mut()
        {
            o.remove("optionalEvidence");
        }
        report["input"] = sanitized;
    }
    Ok(report)
}

fn validate_id(id: &str, path: &str, warnings: &mut Vec<String>) -> Result<()> {
    if let Some((producer, local)) = id.split_once(':') {
        ensure!(
            matches!(producer, "rand" | "ctg" | "mbb" | "hate" | "qeg"),
            "Unknown ID producer prefix \"{producer}\" at {path}; reserved prefixes are rand, ctg, mbb, hate, qeg"
        );
        ensure!(
            !local.is_empty(),
            "Namespaced ID at {path} must use <producer>:<local-id> with a non-empty local-id"
        );
    } else {
        warnings.push(format!("Deprecated prefixless ID at {path}: \"{id}\""))
    }
    Ok(())
}
fn inspect(
    value: &Value,
    path: &str,
    proposal: bool,
    failures: &mut Vec<Value>,
    warnings: &mut Vec<String>,
) -> Result<()> {
    if let Some(arr) = value.as_array() {
        for (i, v) in arr.iter().enumerate() {
            inspect(v, &format!("{path}.{i}"), proposal, failures, warnings)?;
        }
    } else if let Some(obj) = value.as_object() {
        for (key, child) in obj {
            let location = format!("{path}.{key}");
            match key.as_str() {
                "id"|"runId"|"nodeId"|"obligationId"|"acceptanceId"|"taskId"|"policyId"|"policy_ref"|"executedCaseId"|"subject_id" => if let Some(v)=child.as_str(){validate_id(v,&location,warnings)?},
                "nodeIds"|"riskIds"|"requirementIds"|"acceptanceCriteriaIds"|"failureModeIds"|"changedCodeIds"|"sourceArtifactIds"|"selectedTestIds"|"replacement_ids"|"linkedRiskIds"|"traceTo"|"previous_subject_ids"|"current_subject_ids" => for (i,v) in items(child).iter().enumerate(){if let Some(id)=v.as_str(){validate_id(id,&format!("{location}[{i}]"),warnings)?;}},
                "gatePolicy"|"gate_policy" if !proposal && !(key=="gatePolicy" && path=="gate-input.json.evidencePackage")=>failures.push(json!({"path":location,"reason":"External artifact carried gate_policy directly; QEG is the sole Gate policy source of truth and external policy must be explicit proposal-only","sourceRefs":[{"id":"qeg:source-ingest-contract","path":"docs/spec/node-identity-contract.md","label":location}]})), _=>{}
            }
            inspect(
                child,
                &location,
                proposal
                    || matches!(
                        key.as_str(),
                        "gate_policy_proposal"
                            | "gatePolicyProposal"
                            | "policy_proposal"
                            | "policyProposal"
                            | "policyProposals"
                    ),
                failures,
                warnings,
            )?;
        }
    }
    Ok(())
}
pub fn prepare_ingest(mut input: Value, quiet: bool) -> Result<Value> {
    let mut failures = Vec::new();
    let mut warnings = Vec::new();
    inspect(
        &input,
        "gate-input.json",
        false,
        &mut failures,
        &mut warnings,
    )?;
    if !quiet {
        for w in warnings.iter().take(5) {
            eprintln!("Warning: {w}")
        }
        if warnings.len() > 5 {
            eprintln!(
                "Warning: {} additional prefixless IDs accepted during deprecation period",
                warnings.len() - 5
            )
        }
    }
    if !failures.is_empty() {
        input["graph"]["completeness"]["parserFailures"]
            .as_array_mut()
            .context("Invalid completeness.parserFailures")?
            .extend(failures)
    }
    Ok(input)
}
pub fn verify_evidence(input: &Value, directory: &Path) -> Result<Value> {
    evidence::verify(input, directory, None)
}
pub fn verify_evidence_with_options(
    input: &Value,
    directory: &Path,
    strict: Option<bool>,
) -> Result<Value> {
    evidence::verify(input, directory, strict)
}

fn read_raw(root: &Path) -> Result<Value> {
    let raw: Value = serde_json::from_str(
        &storage::read_input(root).context("gate-input.json not found or invalid")?,
    )
    .context("gate-input.json not found or invalid")?;
    ensure!(
        ["metadata", "graph", "policy"]
            .iter()
            .all(|k| raw[k].is_object()),
        "gate-input.json envelope is invalid\nInput file: {}",
        root.join("gate-input.json").display()
    );
    Ok(raw)
}
fn prepared(schema: &Value, quiet: bool) -> Result<Value> {
    ensure!(
        schema["valid"] == true,
        "gate-input.json failed runtime schema validation: {}",
        messages(&schema["issues"])
    );
    if !quiet {
        for w in items(&schema["warnings"]) {
            eprintln!(
                "Warning: optional artifact {} {}",
                s(&w["path"]),
                s(&w["message"])
            )
        }
    }
    prepare_ingest(schema["input"].clone(), quiet)
}
pub fn read_fixture_input(root: &Path, quiet: bool) -> Result<Value> {
    storage::with_lease(root, |root| {
        prepared(&validate_gate_input(&read_raw(root)?)?, quiet)
    })
}
pub fn evaluate(directory: &Path, quiet: bool) -> Result<Value> {
    storage::with_lease(directory, |root| {
        let raw = read_raw(root)?;
        let schema = validate_gate_input(&raw)?;
        if schema["valid"] != true {
            return Ok(schema_invalid(&raw, root, schema));
        }
        let mut input = prepared(&schema, quiet)?;
        if input["waivers"].is_null() {
            input["waivers"] = json!([]);
        }
        let verification = verify_evidence(&input, root)?;
        let failures: Vec<_> = items(&verification["items"])
            .iter()
            .filter(|i| i["severity"] == "fail" && i["code"] != "REVISION_MISMATCH")
            .collect();
        let mut dqs = Vec::new();
        if !failures.is_empty() {
            let ids = failures
                .iter()
                .map(|i| s(&i["artifactId"]))
                .collect::<indexmap::IndexSet<_>>();
            let message = failures
                .iter()
                .map(|i| format!("{}: {}", s(&i["artifactId"]), s(&i["message"])))
                .collect::<Vec<_>>()
                .join("; ");
            dqs.push(json!({"code":"DQ-06","message":message,"nodeIds":ids,"sourceRefs":[{"id":"qeg:evidence-verification","path":"src/validation/evidence.ts"}]}));
        }
        if !quiet {
            eprintln!("Using gate-input.json (runtime schema and evidence preflight complete)")
        }
        input["evidenceVerification"] = verification;
        input["preflightDisqualifications"] = json!(dqs);
        input["gateResult"] = gate::evaluate_gate(&input)?;
        input
            .as_object_mut()
            .unwrap()
            .remove("preflightDisqualifications");
        input["fixtureDir"] = json!(root);
        input["schemaValidation"] = schema;
        Ok(input)
    })
}
fn schema_invalid(raw: &Value, root: &Path, schema: Value) -> Value {
    let fallback = |v: &Value, k: &str, default: &str| v[k].as_str().unwrap_or(default).to_string();
    let m = &raw["metadata"];
    let p = &raw["policy"];
    let profile = match s(&m["profile"]) {
        p @ ("lean" | "standard" | "strict" | "ipo_controlled") => p,
        _ => "strict",
    };
    let epoch = "1970-01-01T00:00:00.000Z";
    let metadata = json!({"qegVersion":"0.2","runId":fallback(m,"runId","qeg:invalid-input"),"createdAt":fallback(m,"createdAt",epoch),"profile":profile,"inputArtifacts":[]});
    let source = json!([{"id":"qeg:schema-validation","path":"schemas/gate-input.schema.json"}]);
    let policy = json!({"policyId":fallback(p,"policyId","qeg:invalid-policy"),"policyHash":fallback(p,"policyHash","sha256:invalid"),"profile":profile,"effectiveDate":fallback(p,"effectiveDate",epoch),"approver":fallback(p,"approver","qeg-runtime-validator"),"sourceRefs":source,"dqScope":(1..=21).map(|n|format!("DQ-{n:02}")).collect::<Vec<_>>(),"exitCodePolicy":{"go":0,"conditional_go":2,"no_go":2,"disqualified":2}});
    let graph = json!({"metadata":metadata,"nodes":[],"edges":[],"completeness":{"score":1,"partial":false,"parserFailures":[],"unsupportedClaims":[]}});
    let preview = messages(&json!(
        items(&schema["issues"]).iter().take(5).collect::<Vec<_>>()
    ));
    let message = format!("Gate input schema invalid: {preview}");
    json!({"fixtureDir":root,"metadata":metadata,"policy":policy,"waivers":[],"graph":graph,"schemaValidation":schema,"gateResult":{
       "metadata":metadata,"verdict":"disqualified","reasons":[message],"disqualifications":[{"code":"DQ-01","message":message,"nodeIds":[],"sourceRefs":source}],
       "blockers":[],"residualRisks":[],"requiredHumanReview":[],"testEvidenceAccounting":gate::test_evidence_accounting(&graph,None),"reliability":{"enabled":false}
    }})
}
