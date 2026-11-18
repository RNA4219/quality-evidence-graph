use crate::common::{digest, items, s};
use anyhow::{Context, Result, ensure};
use jsonschema::{Registry, Validator};
use serde_json::{Value, json};
use std::{
    collections::HashMap,
    fs,
    path::{Component, Path, PathBuf},
    sync::OnceLock,
};
use yaml_rust2::scanner::{Scanner, TokenType};

pub fn parse_producer_artifact(descriptor: &Value, content: &str) -> Result<Value> {
    let path = s(&descriptor["path"]).to_ascii_lowercase();
    if !path.ends_with(".yaml") && !path.ends_with(".yml") {
        return Ok(serde_json::from_str(content)?);
    }
    ensure!(
        descriptor["adapter"] == "code-to-gate" && descriptor["kind"] == "risk_register",
        "YAML is supported only for code-to-gate risk_register"
    );
    let mut scanner = Scanner::new(content.chars());
    for token in scanner.by_ref() {
        ensure!(
            !matches!(token.1, TokenType::Alias(_)),
            "YAML aliases are not permitted"
        );
    }
    if let Some(e) = scanner.get_error() {
        anyhow::bail!("{e}");
    }
    // Mapping deserialization checks duplicate keys before conversion to a JSON object.
    let yaml: serde_yaml::Value = serde_yaml::from_str(content)?;
    Ok(serde_json::to_value(yaml)?)
}

fn validators() -> Result<&'static HashMap<String, Validator>> {
    static SCHEMAS: OnceLock<Value> = OnceLock::new();
    static VALIDATORS: OnceLock<Result<HashMap<String, Validator>, String>> = OnceLock::new();
    let schemas = SCHEMAS.get_or_init(|| {
        serde_json::from_str(include_str!("../../src/adapters/producer-schemas.json"))
            .expect("bundled producer schemas")
    });
    let result = VALIDATORS.get_or_init(|| {
        (|| -> Result<HashMap<String, Validator>> {
            let mut validators = HashMap::new();
            for (producer, group) in schemas.as_object().context("Invalid producer registry")? {
                let entries = group.as_object().context("Invalid schema group")?;
                let mut registry = Registry::new();
                for schema in entries.values() {
                    registry = registry.add(s(&schema["$id"]), schema)?;
                }
                let registry = registry.prepare()?;
                for (name, schema) in entries {
                    let validator = jsonschema::options()
                        .with_registry(&registry)
                        .should_validate_formats(false)
                        .build(schema)?;
                    validators.insert(format!("{producer}/{name}"), validator);
                }
            }
            Ok(validators)
        })()
        .map_err(|e| e.to_string())
    });
    result.as_ref().map_err(|e| anyhow::anyhow!("{e}"))
}
pub fn validate_producer_payload(descriptor: &Value, raw: &Value) -> Result<()> {
    let producer = s(&descriptor["adapter"]);
    let kind = s(&descriptor["kind"]);
    if !matches!(producer, "code-to-gate" | "manual-bb-test-harness") {
        return Ok(());
    }
    let name = if producer == "code-to-gate" {
        kind.replace('_', "-")
    } else {
        kind.to_owned()
    };
    let file = format!("{name}.schema.json");
    let key = format!("{producer}/{file}");
    let validator = validators()?
        .get(&key)
        .with_context(|| format!("Unsupported producer schema {key}"))?;
    if !validator.is_valid(raw) {
        let issues = validator
            .iter_errors(raw)
            .take(6)
            .map(|e| format!("{} {e}", e.instance_path()))
            .collect::<Vec<_>>();
        anyhow::bail!("Producer schema {file}: {}", issues.join("; "));
    }
    Ok(())
}

fn relative_path(raw: &str) -> Option<PathBuf> {
    let bytes = raw.as_bytes();
    if raw.starts_with(['/', '\\'])
        || (bytes.len() > 1 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':')
    {
        return None;
    }
    let mut result = PathBuf::new();
    for part in Path::new(raw).components() {
        match part {
            Component::Normal(v) => result.push(v),
            Component::CurDir => {}
            Component::ParentDir => {
                if !result.pop() {
                    return None;
                }
            }
            _ => return None,
        }
    }
    (!result.as_os_str().is_empty()).then_some(result)
}

fn load(base: &Path, descriptor: &Value, head: &Value) -> Result<Value> {
    let raw = s(&descriptor["path"]);
    let failure = |code: &str, message: String| json!({"ref":descriptor,"failure":{"code":code,"message":message}});
    let Some(rel) = relative_path(raw) else {
        return Ok(failure(
            "DQ-06",
            format!("Artifact must be inside the ingest target: {raw}"),
        ));
    };
    let target = base.join(rel);
    let missing = || failure("DQ-06", format!("Artifact missing: {raw}"));
    let path = match fs::canonicalize(&target) {
        Ok(path) => path,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(missing()),
        Err(e) => return Err(e).with_context(|| format!("Read artifact {}", target.display())),
    };
    if path == base || !path.starts_with(base) {
        return Ok(failure(
            "DQ-06",
            format!("Artifact symlink escapes target: {raw}"),
        ));
    }
    if !fs::metadata(&path)?.is_file() {
        return Ok(failure(
            "DQ-06",
            format!("Artifact is not a regular file: {raw}"),
        ));
    }
    let bytes = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(missing()),
        Err(e) => return Err(e.into()),
    };
    if descriptor["contentHash"] != digest(&bytes) {
        return Ok(failure(
            "DQ-06",
            format!("Artifact contentHash missing or mismatched: {raw}"),
        ));
    }
    if s(&descriptor["revision"]).is_empty() || &descriptor["revision"] != head {
        return Ok(failure(
            "DQ-12",
            format!("Artifact revision missing or mismatched: {raw}"),
        ));
    }
    match parse_producer_artifact(descriptor, &String::from_utf8_lossy(&bytes)) {
        Ok(payload) => Ok(json!({"ref":descriptor,"payload":payload})),
        Err(e) => Ok(failure("DQ-01", format!("Parse artifact {raw}: {e}"))),
    }
}
pub fn load_raw_artifacts(directory: &Path) -> Result<(Value, Value)> {
    let base = fs::canonicalize(directory)?;
    let path = base.join("ingest-manifest.json");
    let manifest: Value = serde_json::from_slice(
        &fs::read(&path).with_context(|| format!("Read ingest manifest {}", path.display()))?,
    )
    .with_context(|| format!("Parse ingest manifest {}", path.display()))?;
    let validation = crate::runtime::validate_output(&manifest, "ingest-manifest.schema.json")?;
    ensure!(
        validation["valid"] == true,
        "Invalid ingest manifest {}: {}",
        path.display(),
        validation["issues"]
    );
    let loaded = items(&manifest["artifacts"])
        .iter()
        .map(|d| load(&base, d, &manifest["metadata"]["headRef"]))
        .collect::<Result<Vec<_>>>()?;
    Ok((manifest, Value::Array(loaded)))
}
