use crate::{
    common::{digest, items, s},
    gate::{execution_fingerprint, valid_execution, valid_execution_policy},
    graph::validate_producer_payload,
};
use anyhow::Result;
use indexmap::IndexMap;
use serde_json::{Value, json};
use std::{
    fs,
    io::ErrorKind,
    path::{Component, Path, PathBuf},
};

#[derive(Clone, Copy)]
enum Payload<'a> {
    Binding(&'a Value),
    Decision(&'a Value),
    Execution(&'a Value),
}
struct Candidate<'a> {
    artifact: &'a Value,
    required: bool,
    enforce: bool,
    contained: bool,
    historical: Option<bool>,
    payload_key: &'a str,
    payload: Option<Payload<'a>>,
}
impl<'a> Candidate<'a> {
    fn new(artifact: &'a Value, required: bool) -> Self {
        Self {
            artifact,
            required,
            enforce: false,
            contained: false,
            historical: None,
            payload_key: "",
            payload: None,
        }
    }
}
fn candidates(input: &Value) -> Vec<Candidate<'_>> {
    let mut all = Vec::new();
    for artifact in items(&input["metadata"]["inputArtifacts"])
        .iter()
        .chain(items(&input["evidencePackage"]["inputArtifactHashes"]))
    {
        let declared = items(&input["policy"]["inputContract"]["requiredArtifacts"])
            .iter()
            .any(|r| r["adapter"] == artifact["adapter"] && r["kind"] == artifact["kind"]);
        let optional = matches!(
            s(&artifact["adapter"]),
            "junit" | "coverage" | "sarif" | "git-diff"
        );
        all.push(Candidate {
            enforce: declared,
            ..Candidate::new(artifact, declared || !optional)
        });
    }
    if let Some(outputs) = input["evidencePackage"]["qegOutputs"].as_object() {
        for (k, a) in outputs {
            if !a.is_null() {
                all.push(Candidate::new(a, k != "markdownSummary"))
            }
        }
    }
    let nodes = items(&input["graph"]["nodes"]);
    for n in nodes
        .iter()
        .filter(|n| n["kind"] == "execution_evidence" && n["evidenceType"] == "resilience")
    {
        for a in std::iter::once(&n["rawArtifactRef"]).chain(items(&n["evidenceRefs"])) {
            all.push(Candidate {
                contained: true,
                ..Candidate::new(a, true)
            })
        }
    }
    let p = &input["policy"]["executionPolicy"];
    if valid_execution_policy(p) {
        all.push(Candidate {
            contained: true,
            enforce: true,
            payload_key: "build-binding",
            payload: Some(Payload::Binding(&p["target"])),
            ..Candidate::new(&p["buildBindingRef"], true)
        });
        for a in items(&input["metadata"]["inputArtifacts"])
            .iter()
            .filter(|a| a["adapter"] == "manual-bb-test-harness" && a["kind"] == "gate_decision")
        {
            all.push(Candidate {
                contained: true,
                enforce: true,
                payload_key: "manual-build-decision",
                payload: Some(Payload::Decision(&p["target"])),
                ..Candidate::new(a, true)
            });
        }
    }
    let mut evidence: Vec<_> = nodes
        .iter()
        .filter(|n| n["kind"] == "execution_evidence" && n["evidenceType"] != "resilience")
        .collect();
    evidence.sort_by(|a, b| s(&a["id"]).encode_utf16().cmp(s(&b["id"]).encode_utf16()));
    for n in evidence {
        let d = &n["execution"];
        if !valid_execution(d) {
            continue;
        }
        let historical = Some(d.get("historySourceRefs").is_some());
        all.push(Candidate {
            contained: true,
            enforce: true,
            historical,
            payload_key: s(&n["id"]),
            payload: Some(Payload::Execution(d)),
            ..Candidate::new(&d["rawArtifactRef"], true)
        });
        for a in items(&n["evidenceRefs"]) {
            all.push(Candidate {
                contained: true,
                enforce: true,
                historical,
                ..Candidate::new(a, true)
            })
        }
    }
    let mut unique = IndexMap::new();
    for c in all {
        let a = c.artifact;
        let key = (
            s(&a["id"]),
            s(&a["path"]),
            s(&a["contentHash"]),
            s(&a["revision"]),
            c.contained,
            c.historical,
            c.payload_key,
        );
        unique
            .entry(key)
            .and_modify(|old: &mut Candidate| {
                old.required |= c.required;
                old.enforce |= c.enforce;
            })
            .or_insert(c);
    }
    unique.into_values().collect()
}
fn payload_matches(contract: Payload, raw: &Value, artifact: &Value) -> bool {
    match contract {
        Payload::Binding(target) => {
            *raw == json!({"bindingVersion":"qeg-build/v1","target":target})
        }
        Payload::Decision(target) => {
            let mut a = artifact.clone();
            a["contractVersion"] = json!("manual-bb/v1");
            validate_producer_payload(&a, raw).is_ok() && raw["build_id"] == target["buildId"]
        }
        Payload::Execution(d) if d["identity"]["producer"] == "manual-bb-test-harness" => {
            let a = json!({"adapter":"manual-bb-test-harness","kind":"execution_evidence","contractVersion":"manual-bb/v1"});
            let case = raw.get("tc_id").or_else(|| raw.get("charter_id"));
            let status = if raw["result"] == "skip" {
                "skipped"
            } else {
                s(&raw["result"])
            };
            validate_producer_payload(&a, raw).is_ok()
                && raw["feature_id"] == d["identity"]["featureId"]
                && case == Some(&d["identity"]["caseId"])
                && (s(&raw["tc_id"]).is_empty() != s(&raw["charter_id"]).is_empty())
                && raw["build_id"] == d["target"]["buildId"]
                && raw["run_id"] == d["runId"]
                && raw["timestamp"] == d["completedAt"]
                && d["status"] == status
                && raw
                    .get("env")
                    .is_none_or(|e| *e == d["target"]["environmentId"])
        }
        Payload::Execution(d) => {
            let mut meaning = d.clone();
            if let Some(o) = meaning.as_object_mut() {
                o.remove("rawArtifactRef");
                o.remove("historySourceRefs");
            }
            meaning == *raw
        }
    }
}
fn contained_relative(p: &Path) -> Option<PathBuf> {
    let mut relative = PathBuf::new();
    for part in p.components() {
        match part {
            Component::Normal(v) => relative.push(v),
            Component::CurDir => (),
            Component::ParentDir if relative.pop() => (),
            _ => return None,
        }
    }
    (!relative.as_os_str().is_empty()).then_some(relative)
}
pub fn verify(input: &Value, base: &Path, strict: Option<bool>) -> Result<Value> {
    let strict = strict.unwrap_or(matches!(
        s(&input["metadata"]["profile"]),
        "strict" | "ipo_controlled"
    ));
    let base = std::path::absolute(base)?;
    let real_base = fs::canonicalize(&base);
    let mut results = Vec::new();
    for c in candidates(input) {
        let a = c.artifact;
        let name = s(&a["path"]);
        let severity = if c.required && (strict || c.enforce || c.contained) {
            "fail"
        } else {
            "warn"
        };
        let mut add = |severity: &str, code: &str, message: &str| {
            let mut result = json!({"artifactId":a["id"]});
            if !name.is_empty() {
                result["path"] = json!(name)
            }
            result["severity"] = json!(severity);
            result["code"] = json!(code);
            result["message"] = json!(message);
            results.push(result)
        };
        if name.is_empty() {
            add(severity, "PATH_MISSING", "artifact path is missing");
            continue;
        }
        let path = Path::new(name);
        if c.contained && path.is_absolute() {
            add(
                "fail",
                "PATH_OUTSIDE_BASE",
                "resilience artifact path must be relative to the Gate target directory",
            );
            continue;
        }
        if c.contained && contained_relative(path).is_none() {
            add(
                "fail",
                "PATH_OUTSIDE_BASE",
                "resilience artifact path escapes the Gate target directory",
            );
            continue;
        }
        let path: PathBuf = base.join(path).components().collect();
        match crate::probe::event("before-stat", &path).and_then(|_| fs::metadata(&path)) {
            Ok(stat) if stat.is_file() => (),
            Ok(_) => {
                add(
                    severity,
                    "IO_ERROR",
                    &format!(
                        "Cannot read {}: artifact is not a regular file",
                        path.display()
                    ),
                );
                continue;
            }
            Err(e) if e.kind() == ErrorKind::NotFound => {
                add(
                    severity,
                    "FILE_MISSING",
                    &format!("artifact file does not exist: {name}"),
                );
                continue;
            }
            Err(e) => {
                add(
                    severity,
                    "IO_ERROR",
                    &format!("Cannot stat {}: {e}", path.display()),
                );
                continue;
            }
        }
        if c.contained {
            match (&real_base, fs::canonicalize(&path)) {
                (Ok(base), Ok(actual)) if actual.starts_with(base) && actual != *base => (),
                (Ok(_), Ok(_)) => {
                    add(
                        "fail",
                        "PATH_OUTSIDE_BASE",
                        "resilience artifact symlink escapes the Gate target directory",
                    );
                    continue;
                }
                _ => {
                    add(
                        severity,
                        "IO_ERROR",
                        &format!("Cannot realpath {}", path.display()),
                    );
                    continue;
                }
            }
        }
        if s(&a["contentHash"]).is_empty() {
            add(severity, "HASH_MISSING", "artifact contentHash is missing")
        } else {
            let bytes =
                match crate::probe::event("before-read", &path).and_then(|_| fs::read(&path)) {
                    Ok(bytes) => bytes,
                    Err(e) => {
                        add(
                            severity,
                            "IO_ERROR",
                            &format!("Cannot read {}: {e}", path.display()),
                        );
                        continue;
                    }
                };
            if let Some(contract) = c.payload
                && !serde_json::from_slice(&bytes)
                    .is_ok_and(|raw| payload_matches(contract, &raw, a))
            {
                add(
                    "fail",
                    "PAYLOAD_MISMATCH",
                    "EAC-01/05 raw payload disagrees with normalized execution or build binding",
                );
            }
            let actual = digest(&bytes);
            if actual == s(&a["contentHash"]) {
                add("pass", "VERIFIED", "artifact path and hash verified")
            } else {
                add(
                    severity,
                    "HASH_MISMATCH",
                    &format!(
                        "artifact hash mismatch: expected {}, got {actual}",
                        s(&a["contentHash"])
                    ),
                )
            }
        }
        let head = s(&input["metadata"]["headRef"]);
        let revision = s(&a["revision"]);
        if c.historical != Some(true)
            && !head.is_empty()
            && !revision.is_empty()
            && revision != head
        {
            add(
                severity,
                "REVISION_MISMATCH",
                &format!("artifact revision {revision} does not match {head}"),
            )
        }
    }
    let status = if results.iter().any(|v| v["severity"] == "fail") {
        "fail"
    } else if results.iter().any(|v| v["severity"] == "warn") {
        "warn"
    } else {
        "pass"
    };
    Ok(
        json!({"reportVersion":"qeg-evidence-verification-v2","status":status,"items":results,"executionFingerprint":execution_fingerprint(input)}),
    )
}
