use super::*;
use crate::common::{digest, timestamp_nanos};
use std::collections::BTreeMap;
use std::io::Write;

fn first<'a>(v: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().find_map(|k| v.get(*k))
}
fn choose<'a>(
    field: &str,
    raw: Option<&'a Value>,
    context: Option<&'a Value>,
    required: bool,
) -> Result<Option<&'a Value>> {
    if let (Some(a), Some(b)) = (raw, context) {
        ensure!(a == b, "Raw input conflicts with context for {field}");
    }
    let value = raw.or(context);
    ensure!(
        !required || value.is_some(),
        "Normalization requires {field} in raw input or context"
    );
    Ok(value)
}
fn status(v: &Value) -> Result<Value> {
    let status = match v {
        Value::Bool(passed) => {
            if *passed {
                "pass"
            } else {
                "fail"
            }
        }
        Value::String(v) => match v.to_lowercase().as_str() {
            "pass" | "success" | "passed" => "pass",
            "failure" | "failed" | "fail" => "fail",
            "cancelled" | "canceled" | "aborted" => "aborted",
            "error" => "error",
            "timeout" => "timeout",
            "skipped" => "skipped",
            _ => bail!("Raw status is unrecognized"),
        },
        _ => bail!("Raw status must be a recognized string or boolean"),
    };
    Ok(json!(status))
}
fn aliases(raw: &Value, keys: &[&str]) -> Result<Option<Value>> {
    let mut result = None;
    for v in keys.iter().filter_map(|k| raw.get(*k)) {
        let v = status(v)?;
        choose("raw status aliases", result.as_ref(), Some(&v), false)?;
        result = Some(v);
    }
    Ok(result)
}
pub fn status_for_api(method: &str, args: &Value) -> Result<Value> {
    let values = args.as_array().context("Expected argument array")?;
    let raw = values.first();
    match method {
        "normalizeStatus" => Ok(raw.map(status).transpose()?.unwrap_or_default()),
        "statusAliases" => {
            let raw = raw.context("Missing raw object")?;
            let keys = values
                .iter()
                .skip(1)
                .map(|v| v.as_str().context("Expected alias name"))
                .collect::<Result<Vec<_>>>()?;
            Ok(aliases(raw, &keys)?.unwrap_or_default())
        }
        "shellStatus" => Ok(shell_status(raw.context("Missing raw object")?)?.unwrap_or_default()),
        _ => bail!("Unknown status method {method}"),
    }
}

fn shell_status(raw: &Value) -> Result<Option<Value>> {
    let mut result = aliases(raw, &["status"])?;
    if let Some(code) = raw.get("exitCode") {
        let code = code
            .as_f64()
            .filter(|n| n.fract() == 0. && n.abs() <= 9007199254740991.)
            .context("Raw exitCode must be an integer")?;
        ensure!(
            result
                .as_ref()
                .is_none_or(|v| (v == "pass") == (code == 0.)),
            "Raw input conflicts with context for raw status and exitCode"
        );
        result.get_or_insert_with(|| json!(if code == 0. { "pass" } else { "fail" }));
    }
    Ok(result)
}
fn toxic_fault(raw: &Value) -> Result<Option<Value>> {
    let toxic = if raw["toxics"].is_array() {
        raw["toxics"].get(0)
    } else {
        raw.get("toxic")
    };
    let Some(toxic) = toxic.filter(|v| v.is_object()) else {
        return Ok(None);
    };
    let model = raw.get("faultModel").cloned().or_else(|| {
        toxic["type"].as_str().map(|t| {
            json!(match t {
                "timeout" => "dependency_timeout",
                "latency" => "network_latency",
                _ => "custom",
            })
        })
    });
    let ids = raw.get("targetIds").cloned().or_else(|| {
        first(raw, &["proxyName", "proxy"])
            .and_then(Value::as_str)
            .map(|p| json!([p]))
    });
    let duration = first(raw, &["appliedDurationMs", "durationMs"])
        .cloned()
        .or_else(|| {
            let start = timestamp_nanos(&raw["faultStartedAt"])? / 1_000_000;
            let end = timestamp_nanos(&raw["faultEndedAt"])? / 1_000_000;
            i64::try_from(end - start).ok().map(|n| json!(n))
        });
    ensure!(
        model.is_some()
            && raw.get("faultStartedAt").is_some()
            && raw.get("faultEndedAt").is_some()
            && ids.is_some()
            && duration.is_some(),
        "Toxiproxy input requires measured fault timestamps, targets, and duration"
    );
    Ok(Some(
        json!({"type":model,"parameters":toxic,"faultStartedAt":raw["faultStartedAt"],"faultEndedAt":raw["faultEndedAt"],"actualTargetIds":ids,"appliedDurationMs":duration}),
    ))
}
fn validate(v: &Value, schema: &str, label: &str) -> Result<()> {
    let report = crate::runtime::validate_output(v, schema)?;
    ensure!(
        report["valid"] == true,
        "{label} schema invalid: {}",
        items(&report["issues"])
            .iter()
            .map(|i| format!("{} {}", s(&i["path"]), s(&i["keyword"])))
            .collect::<Vec<_>>()
            .join("; ")
    );
    Ok(())
}
fn normalize(adapter: &str, raw: &Value, ctx: &Value, raw_path: &str, hash: &str) -> Result<Value> {
    ensure!(raw.is_object(), "raw input must be a JSON object");
    ensure!(
        raw.get("lifecycle").is_none_or(Value::is_object),
        "Raw lifecycle must be a JSON object"
    );
    let lifecycle = &raw["lifecycle"];
    let ctx_life = &ctx["lifecycle"];
    let (runs, revisions, statuses): (&[&str], &[&str], &[&str]) = match adapter {
        "lakda" => {
            ensure!(
                first(raw, &["contractVersion", "schema", "version"])
                    .is_some_and(|v| v == "HATE/v1"),
                "Lakda normalize accepts only HATE/v1 artifacts"
            );
            (
                &["runId", "run_id"],
                &["commit", "headSha", "head_sha"],
                &["status", "conclusion", "passed"],
            )
        }
        "shell" => {
            ensure!(
                first(raw, &["schema", "contractVersion"])
                    .is_some_and(|v| v == "qeg-resilience-shell-v1"),
                "Shell normalize requires qeg-resilience-shell-v1 input"
            );
            (&["runId"], &["commit", "headSha"], &["status"])
        }
        "ci" => {
            ensure!(
                first(raw, &["schema", "contractVersion"])
                    .is_some_and(|v| v == "qeg-resilience-ci-v1"),
                "CI normalize requires qeg-resilience-ci-v1 input"
            );
            (
                &["providerRunId", "runId"],
                &["headSha", "commit"],
                &["conclusion", "status"],
            )
        }
        "toxiproxy" => (
            &["runId", "experimentId", "name"],
            &["commit", "headSha", "revision"],
            &["status", "passed"],
        ),
        _ => bail!(
            "Adapter {adapter} is unsupported for MVP normalization; provide canonical resilience evidence directly"
        ),
    };
    let raw_status = if adapter == "shell" {
        shell_status(raw)?
    } else {
        aliases(raw, statuses)?
    };
    let raw_life_status = lifecycle.get("status").map(status).transpose()?;
    let raw_status = choose(
        "raw status",
        raw_status.as_ref(),
        raw_life_status.as_ref(),
        false,
    )?;
    let status =
        choose("status", raw_status, ctx_life.get("status"), true)?.context("Missing status")?;
    let raw_node = raw.get("node").filter(|v| v.is_object());
    let node = choose("node", raw_node, ctx.get("node"), true)?.context("Missing node")?;
    let mut evidence = json!({"id":node["id"],"kind":"execution_evidence","title":node["title"],"traceability":node["traceability"],"sourceArtifactIds":node["sourceArtifactIds"],"evidenceType":"resilience","adapter":adapter,"normalizationVersion":"qeg-resilience-evidence-v1","status":status,"passed":status=="pass"});
    let attempts: &[&str] = if adapter == "ci" {
        &["attempt", "runAttempt"]
    } else {
        &["attempt"]
    };
    for (key, rawv) in [
        ("experimentId", first(raw, runs)),
        ("targetRevision", first(raw, revisions)),
        ("attempt", first(raw, attempts)),
        ("adapterVersion", raw.get("adapterVersion")),
        ("observed", raw.get("observed")),
        ("testId", raw.get("testId")),
        ("environment", raw.get("environment")),
        ("environmentId", raw.get("environmentId")),
        (
            "evidenceRefs",
            raw.get("evidenceRefs").filter(|v| v.is_array()),
        ),
        (
            "signalManifest",
            raw.get("signalManifest").filter(|v| v.is_object()),
        ),
    ] {
        evidence[key] = choose(key, rawv, ctx.get(key), true)?
            .cloned()
            .context("Missing required field")?;
    }
    evidence["rawArtifactRef"] = json!({"id":format!("{}:raw",s(&node["id"])),"path":raw_path,"contentHash":hash,"revision":evidence["targetRevision"]});
    for (k, alt) in [("startedAt", "started_at"), ("endedAt", "ended_at")] {
        let raw_val = if adapter == "lakda" {
            first(raw, &[k, alt])
        } else {
            raw.get(k)
        };
        let v = choose(&format!("raw {k}"), raw_val, lifecycle.get(k), false)?;
        evidence[k] = choose(k, v, ctx_life.get(k), true)?
            .cloned()
            .context("Missing timestamp")?;
    }
    let raw_fault = if adapter == "toxiproxy" {
        toxic_fault(raw)?
    } else {
        raw.get("fault").cloned()
    };
    let f = choose(
        "raw fault",
        raw_fault.as_ref(),
        lifecycle.get("fault"),
        false,
    )?;
    if let Some(v) = choose("fault", f, ctx_life.get("fault"), false)? {
        evidence["fault"] = v.clone();
    }
    for k in [
        "steadyStateConfirmed",
        "recovered",
        "recoveryConfirmedAt",
        "recoveryDurationMs",
        "abortRecord",
    ] {
        if let Some(v) = choose(k, lifecycle.get(k), ctx_life.get(k), false)? {
            evidence[k] = v.clone();
        }
    }
    validate(
        &evidence,
        "reliability.schema.json#/$defs/resilienceExecutionEvidenceNode",
        "Normalized evidence",
    )?;
    Ok(evidence)
}
fn contained(base: &Path, rel: &str, label: &str) -> Result<PathBuf> {
    let p = Path::new(rel);
    ensure!(
        !p.is_absolute()
            && !p
                .components()
                .any(|component| matches!(component, Component::Prefix(_) | Component::RootDir)),
        "{label} must be contained within --base-dir"
    );
    let path = clean(&base.join(p));
    ensure!(
        path != base && path.starts_with(base),
        "{label} must be contained within --base-dir"
    );
    Ok(path)
}
fn real(base: &Path, p: &Path, label: &str) -> Result<PathBuf> {
    let resolved = p
        .canonicalize()
        .with_context(|| format!("Cannot resolve {label}"))?;
    ensure!(
        resolved.starts_with(base),
        "{label} resolves outside --base-dir"
    );
    Ok(resolved)
}
pub(super) fn run(args: &[String]) -> Result<i32> {
    let mut options = BTreeMap::new();
    let mut it = args.iter();
    let mut force = false;
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--force" => force = true,
            k @ ("--adapter" | "--context" | "--input" | "--out" | "--base-dir") => {
                options.insert(k, take_option(&mut it, k)?);
            }
            _ => bail!("Unknown normalize argument: {arg}"),
        }
    }
    ensure!(
        ["--adapter", "--context", "--input", "--out"]
            .iter()
            .all(|k| options.contains_key(k)),
        "Usage: qeg evidence normalize --adapter <kind> --input <raw.json> --context <context.json> --out <evidence.json> [--base-dir <dir>] [--force]"
    );
    let base = abs(options.get("--base-dir").copied().unwrap_or("."))?;
    let actual = base.canonicalize().context("Cannot resolve --base-dir")?;
    let input = contained(&base, options["--input"], "--input")?;
    let context = contained(&base, options["--context"], "--context")?;
    let output = contained(&base, options["--out"], "--out")?;
    let input_real = real(&actual, &input, "--input")?;
    let context_real = real(&actual, &context, "--context")?;
    let parent = real(
        &actual,
        output.parent().context("--out requires a file path")?,
        "--out parent",
    )?;
    let out = parent.join(output.file_name().context("--out requires a filename")?);
    ensure!(
        key(&out)? != key(&context_real)? && key(&out)? != key(&input_real)?,
        "--out must not overwrite --input or --context"
    );
    match fs::symlink_metadata(&out) {
        Ok(metadata) => {
            ensure!(
                metadata.is_file(),
                "Output is not a regular file: {}",
                out.display()
            );
            ensure!(
                force,
                "Output already exists: {} (use --force to replace it)",
                out.display()
            );
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.into()),
    }
    let bytes = fs::read(input_real).context("Cannot read raw input")?;
    let raw: Value = serde_json::from_slice(&bytes)
        .map_err(|_| anyhow::anyhow!("Cannot read raw input: invalid JSON"))?;
    let ctx = read_json(context_real)?;
    validate(
        &ctx,
        "resilience-normalize-context.schema.json",
        "Normalization context",
    )?;
    let evidence = normalize(
        options["--adapter"],
        &raw,
        &ctx,
        &portable(input.strip_prefix(&base)?),
        &digest(&bytes),
    )?;
    let content = document(&evidence)?;
    let mut tmp = tempfile::NamedTempFile::new_in(&parent)?;
    tmp.write_all(content.as_bytes())?;
    tmp.as_file().sync_all()?;
    if force {
        tmp.persist(&out)?
    } else {
        tmp.persist_noclobber(&out)?
    };
    print!("{content}");
    Ok(0)
}
