use crate::common::{encode, items, s};
use anyhow::{Result, bail, ensure};
use serde_json::{Value, json};
use std::collections::HashMap;

#[derive(Default)]
pub(super) struct Normalized {
    pub nodes: Vec<Value>,
    pub edges: Vec<Value>,
    pub failures: Vec<Value>,
    pub claims: Vec<Value>,
}

pub(super) struct Context<'a> {
    pub descriptor: &'a Value,
    pub raw: &'a Value,
    pub profile: &'a Value,
    pub changes: &'a HashMap<String, String>,
    pub execution_policy: &'a Value,
}

pub(super) fn text<'a>(v: &'a Value, label: &str) -> Result<&'a str> {
    let result = s(v);
    ensure!(
        !result.trim().is_empty(),
        "{label} must be a non-empty string"
    );
    Ok(result)
}

pub(super) fn rows<'a>(v: &'a Value, label: &str) -> Result<&'a [Value]> {
    let arr = v
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("{label} must be an array"))?;
    for (i, entry) in arr.iter().enumerate() {
        ensure!(entry.is_object(), "{label}[{i}] must be an object");
    }
    Ok(arr)
}

pub(super) fn required(raw: &Value, fields: &[&str]) -> Result<()> {
    for key in fields {
        ensure!(!raw[key].is_null(), "Required field {key} is missing");
    }
    Ok(())
}

pub(super) fn strings(v: &Value) -> Vec<String> {
    items(v)
        .iter()
        .filter_map(|x| x.as_str().map(str::to_owned))
        .collect()
}

pub(super) fn merge(mut node: Value, extra: Value) -> Value {
    node.as_object_mut()
        .unwrap()
        .extend(extra.as_object().unwrap().clone());
    node
}

pub(super) fn first<'a>(v: &'a Value, keys: &[&str]) -> &'a Value {
    keys.iter()
        .filter_map(|key| v.get(key))
        .find(|x| !x.is_null())
        .unwrap_or(&Value::Null)
}

pub(super) fn norm_path(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    normalized
        .strip_prefix("./")
        .unwrap_or(&normalized)
        .to_owned()
}

pub(super) fn stable_id(producer: &str, kind: &str, local: &str) -> String {
    if let Some((prefix, rest)) = local.split_once(':')
        && matches!(prefix, "rand" | "ctg" | "mbb" | "hate" | "qeg")
        && !rest.is_empty()
    {
        return if local.chars().any(char::is_whitespace) {
            format!("{prefix}:{}", encode(rest))
        } else {
            local.to_owned()
        };
    }
    format!("{producer}:{kind}:{}", encode(&local.replace('\\', "/")))
}

fn prefix(descriptor: &Value) -> &'static str {
    match s(&descriptor["adapter"]) {
        "RanD" => "rand",
        "code-to-gate" => "ctg",
        _ => "mbb",
    }
}

pub(super) fn source(descriptor: &Value, pointer: &str, label: Option<&str>) -> Value {
    let id = stable_id(
        prefix(descriptor),
        "source",
        &format!("{}/{pointer}", s(&descriptor["path"])),
    );
    let mut source = json!({"id":id,"path":descriptor["path"]});
    if !s(&descriptor["revision"]).is_empty() {
        source["revision"] = descriptor["revision"].clone();
    }
    let label = label
        .filter(|v| !v.is_empty())
        .map(|v| format!("{pointer}: {v}"))
        .unwrap_or_else(|| pointer.into());
    source["label"] = json!(label);
    source
}

pub(super) fn trace(descriptor: &Value, pointer: &str, raw: &Value) -> Value {
    let evidence = items(&raw["evidence"])
        .iter()
        .chain(items(&raw["source_refs"]))
        .chain(
            items(&raw["evidence_refs"])
                .iter()
                .filter(|v| v.is_string()),
        )
        .chain(
            items(&raw["source_ref"]["refs"])
                .iter()
                .filter(|v| v.is_string()),
        );
    let mut refs = vec![source(descriptor, pointer, None)];
    for (index, entry) in evidence.enumerate() {
        let mut r = source(
            descriptor,
            &format!("{pointer}/source/{index}"),
            entry.as_str().or(entry["id"].as_str()),
        );
        let path = first(entry, &["path", "source_ref", "url"]);
        if let Some(p) = path.as_str().or_else(|| {
            entry.as_str().filter(|p| {
                p.contains(['/', '\\', '.']) || p.starts_with("https:") || p.starts_with("http:")
            })
        }) {
            r["path"] = json!(p);
        }
        for key in ["startLine", "endLine"] {
            if entry[key].is_number() {
                r[key] = entry[key].clone();
            }
        }
        refs.push(r);
    }
    let confidence = match raw["confidence"].as_str() {
        Some(v @ ("low" | "medium" | "high")) => v,
        _ => match raw["confidence"].as_f64() {
            Some(n) if (0.8..=1.).contains(&n) => "high",
            Some(n) if (0.0..0.5).contains(&n) => "low",
            _ => "medium",
        },
    };
    let mut assumptions = strings(&raw["assumptions"]);
    if raw.get("confidence").is_none() {
        assumptions.push("producer契約にconfidenceがないためmediumとして扱う".into());
    }
    json!({"sourceRefs":refs,"confidence":confidence,"assumptions":assumptions})
}

pub(super) fn base(descriptor: &Value, kind: &str, local: &str, title: &str, raw: &Value) -> Value {
    json!({"id":stable_id(prefix(descriptor),kind,local),"kind":kind,"title":title,"traceability":trace(descriptor,local,raw),"sourceArtifactIds":[descriptor["id"]]})
}

pub(super) fn evidence_ref(descriptor: &Value, local: &str, kind: &str) -> Value {
    let mut result = source(descriptor, local, None);
    result["evidenceKind"] = json!(kind);
    if let Some(v) = descriptor.get("contentHash") {
        result["contentHash"] = v.clone();
    }
    result
}

pub(super) fn decision(c: &Context, local: &str, status: &Value, raw: &Value) -> Result<Value> {
    let verdict = match s(status) {
        "go" | "pass" | "passed" => "go",
        "conditional_go" | "passed_with_risk" | "needs_review" => "conditional_go",
        "no_go" | "fail" | "failed" | "blocked" => "no_go",
        "blocked_input" | "disqualified" => "disqualified",
        x => bail!("Unknown upstream decision: {x}"),
    };
    Ok(merge(
        base(
            c.descriptor,
            "gate_verdict",
            local,
            &format!("{}: {}", s(&c.descriptor["adapter"]), s(status)),
            raw,
        ),
        json!({
            "profile":c.profile,"verdict":verdict,"disqualifications":[],"blockers":[],"residualRisks":[]
        }),
    ))
}

pub(super) fn assert_no_direct_policy(v: &Value) -> Result<()> {
    if let Some(map) = v.as_object() {
        for (key, child) in map {
            ensure!(
                key != "gate_policy" && key != "gatePolicy",
                "External Gate policy must be an explicit proposal"
            );
            if !key.to_lowercase().contains("proposal") {
                assert_no_direct_policy(child)?;
            }
        }
    } else if let Some(arr) = v.as_array() {
        for child in arr {
            assert_no_direct_policy(child)?;
        }
    }
    Ok(())
}
