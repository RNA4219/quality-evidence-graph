use super::*;
use crate::{runtime, storage};
use std::collections::BTreeSet;

fn result(version: &str, rows: Vec<Value>, field: &str) -> Value {
    json!({"reportVersion":version,"generatedAt":now(),"status":worst(&rows,field),"items":rows})
}
fn schema_item(name: &str, out: Result<(String, Vec<String>)>) -> Value {
    match out {
        Ok((message, errors)) => {
            json!({"name":name,"status":if errors.is_empty(){"pass"}else{"fail"},"message":message,"errors":errors})
        }
        Err(e) => json!({"name":name,"status":"fail","message":format!("{e:#}"),"errors":[]}),
    }
}
pub fn verify_output_manifest(root: &Path) -> Result<Value> {
    crate::storage::with_lease(root, |p| Ok(json!(integrity(p)?)))
}

fn integrity(p: &Path) -> Result<Option<Vec<String>>> {
    let mut published = None;
    let manifest = if exists(&p.join(".qeg-current.json"))? {
        let snap = storage::read_outputs(p)?;
        let Some(content) = snap["files"]["output-manifest.json"].as_str() else {
            return Ok(Some(vec![
                "Current generation is an intermediate result, not a completed record".into(),
            ]));
        };
        let m = serde_json::from_str(content)?;
        published = Some(snap);
        m
    } else {
        if exists(&p.join(".qeg-generations"))? {
            return Ok(Some(vec!["Output publication was interrupted or its pointer is missing; no completed generation".into()]));
        }
        let Some(content) = if_text(&p.join("output-manifest.json"))? else {
            return Ok(None);
        };
        serde_json::from_str(&content)?
    };
    let validation = runtime::validate_output(&manifest, "output-manifest.schema.json")?;
    if validation["valid"] != true {
        return Ok(Some(schema_errors(&validation)));
    }
    let mut errors = vec![];
    let mut seen = BTreeSet::new();
    for f in items(&manifest["files"]) {
        let name = s(&f["path"]);
        if !seen.insert(name) {
            errors.push("Duplicate output manifest path".to_string());
        }
        let bytes = if let Some(snap) = &published {
            snap["files"]
                .get(name)
                .and_then(Value::as_str)
                .map(|s| s.as_bytes().to_vec())
                .with_context(|| format!("Output absent from generation: {name}"))
        } else {
            fs::read(p.join(name)).with_context(|| format!("Read output {name}"))
        };
        match bytes {
            Ok(bytes) if crate::common::digest(&bytes) != f["contentHash"] => {
                errors.push(format!("Hash mismatch: {name}"))
            }
            Err(e) => errors.push(e.to_string()),
            _ => {}
        }
    }
    Ok(Some(errors))
}
fn schema(targets: &[PathBuf]) -> Result<Value> {
    let mut rows = vec![];
    if let Some(root) = std::env::var_os("QEG_DISTRIBUTION_ROOT") {
        let root = PathBuf::from(root);
        ensure!(root.is_absolute(), "QEG_DISTRIBUTION_ROOT must be absolute");
        let mut packaged = std::collections::BTreeMap::new();
        let dir = root.join("schemas");
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.ends_with(".schema.json") {
                packaged.insert(name, read_json(entry.path())?);
            }
        }
        let mut registry = jsonschema::Registry::new();
        for schema in packaged.values() {
            registry = registry.add(s(&schema["$id"]), schema)?;
        }
        let registry = registry.prepare()?;
        for (name, schema) in &packaged {
            jsonschema::options()
                .with_registry(&registry)
                .build(schema)
                .map_err(|e| anyhow::anyhow!("Compile schema {name}: {e}"))?;
            rows.push(schema_item(
                &format!("schema:{name}"),
                Ok(("compiled".into(), vec![])),
            ));
        }
        ensure!(
            runtime::schemas()?
                .keys()
                .all(|name| packaged.contains_key(name)),
            "Installed distribution is missing a schema"
        );
    } else {
        for name in runtime::schemas()?.keys() {
            rows.push(schema_item(
                &format!("schema:{name}"),
                runtime::validate_output(&Value::Null, name).map(|_| ("compiled".into(), vec![])),
            ));
        }
    }
    for p in targets {
        let leased = storage::with_lease(p, |root| {
            if let Some(errors) = integrity(root)? {
                rows.push(schema_item(
                    &format!("{}:output-hashes", p.display()),
                    Ok((
                        if errors.is_empty() {
                            "All output hashes verified"
                        } else {
                            "Output hash verification failed"
                        }
                        .into(),
                        errors,
                    )),
                ));
            }
            for (name, schema) in [
                ("qeg.bundle.json", "qeg.bundle.schema.json"),
                (
                    "test-placement-plan.json",
                    "test-placement-plan.schema.json",
                ),
                ("gate-verdict.json", "gate-verdict.schema.json"),
                (
                    "quality-evidence-record.json",
                    "quality-evidence-record.schema.json",
                ),
                ("output-record.json", "quality-evidence-record.schema.json"),
                ("output-manifest.json", "output-manifest.schema.json"),
            ] {
                let path = root.join(name);
                if !exists(&path)? {
                    continue;
                }
                rows.push(schema_item(
                    &format!("{}:{name}", p.display()),
                    read_json(path)
                        .and_then(|v| runtime::validate_output(&v, schema))
                        .map(|r| {
                            (
                                if r["valid"] == true {
                                    "valid output"
                                } else {
                                    "output schema validation failed"
                                }
                                .into(),
                                schema_errors(&r),
                            )
                        }),
                ));
            }
            let input = storage::read_input(root)
                .and_then(|text| Ok(serde_json::from_str(&text)?))
                .and_then(|v| runtime::validate_gate_input(&v));
            rows.push(schema_item(
                &format!("{}:gate-input", p.display()),
                input.map(|r| {
                    (
                        if r["valid"] == true {
                            "valid"
                        } else {
                            "schema validation failed"
                        }
                        .into(),
                        schema_errors(&r),
                    )
                }),
            ));
            Ok(())
        });
        if let Err(e) = leased {
            rows.push(schema_item(
                &format!("{}:output-hashes", p.display()),
                Err(e),
            ));
        }
    }
    Ok(result("qeg-schema-check-v2", rows, "status"))
}
fn enums() -> Result<Value> {
    let contracts: Value = serde_json::from_str(include_str!("../../src/cli/enum-contracts.json"))?;
    let distribution = std::env::var_os("QEG_DISTRIBUTION_ROOT").map(PathBuf::from);
    let meta: Value = if let Some(root) = &distribution {
        ensure!(root.is_absolute(), "QEG_DISTRIBUTION_ROOT must be absolute");
        read_json(root.join("qeg-report-action/runtime-metadata.json"))?
    } else {
        serde_json::from_str(include_str!(
            "../../qeg-report-action/runtime-metadata.json"
        ))?
    };
    let mut rows = vec![];
    let registry = runtime::schemas()?;
    for c in items(&contracts) {
        let name = s(&c["typeName"]);
        let filename = s(&c["schemaFile"])
            .strip_prefix("schemas/")
            .context("Invalid enum contract")?;
        let packaged;
        let schema = if let Some(root) = &distribution {
            packaged = read_json(root.join("schemas").join(filename))?;
            &packaged
        } else {
            registry.get(filename).context("Missing schema")?
        };
        let mut left: Vec<_> = items(&meta["enums"][name]).iter().map(s).collect();
        left.sort();
        let mut right: Vec<_> = items(&schema["$defs"][s(&c["schemaDef"])]["enum"])
            .iter()
            .map(s)
            .collect();
        right.sort();
        let l: Vec<_> = left.iter().filter(|s| !right.contains(*s)).collect();
        let r: Vec<_> = right.iter().filter(|s| !left.contains(*s)).collect();
        rows.push(json!({"name":name,"status":if left==right&&!left.is_empty(){"pass"}else{"fail"},"typeValues":left,"schemaValues":right,"missingInSchema":l,"missingInTypes":r}));
    }
    Ok(result("qeg-enum-check-v1", rows, "status"))
}
pub(super) fn doctor(targets: &[PathBuf]) -> Result<Value> {
    let mut checks = vec![];
    let mut add = |name: &str, severity: &str, message: &str, fix: Option<&str>| {
        let mut v = json!({"name":name,"severity":severity,"message":message});
        if let Some(f) = fix {
            v["remediation"] = json!(f)
        }
        checks.push(v);
    };
    add(
        "rust-runtime",
        "pass",
        concat!("QEG Rust runtime ", env!("CARGO_PKG_VERSION")),
        None,
    );
    add("dist-cli", "pass", "QEG packaged CLI exists", None);
    let valid = schema(&[])?["status"] == "pass";
    add(
        "schema-compile",
        if valid { "pass" } else { "fail" },
        if valid {
            "schemas compile"
        } else {
            "one or more schemas failed to compile"
        },
        if valid {
            None
        } else {
            Some("Run qeg schema-check --json and fix the failing schema.")
        },
    );
    if let Some(ci) = if_text(Path::new(".github/workflows/ci.yml"))? {
        let act = ci.contains("qeg-report-action");
        let upload = act || ci.contains("actions/upload-artifact") && ci.contains("qeg-ci-report");
        let summary = act || ci.contains("GITHUB_STEP_SUMMARY") || ci.contains("github-summary");
        add(
            "github-actions-artifact",
            if upload { "pass" } else { "warn" },
            if upload {
                "workflow uploads qeg-ci-report artifact"
            } else {
                "workflow does not clearly upload qeg-ci-report artifact"
            },
            Some("Add actions/upload-artifact for .qeg/qeg-ci-report.json."),
        );
        add(
            "github-actions-summary",
            if summary { "pass" } else { "warn" },
            if summary {
                "workflow writes QEG job summary"
            } else {
                "workflow does not clearly write a QEG job summary"
            },
            Some("Run qeg report --github-summary or use qeg-report-action."),
        );
    } else {
        add(
            "github-actions-workflow",
            "warn",
            ".github/workflows/ci.yml is missing",
            Some("Use qeg init or qeg-report-action to add a workflow that uploads qeg-ci-report."),
        );
    }
    for p in targets {
        let name = format!("target:{}", p.display());
        let input = p.join("gate-input.json");
        if !exists(&input)? {
            add(
                &(name + ":gate-input"),
                "fail",
                "gate-input.json is missing",
                Some("Generate gate-input.json or run qeg init for a minimal starter."),
            );
            continue;
        }
        add(
            &format!("{name}:gate-input"),
            "pass",
            "gate-input.json exists",
            None,
        );
        match read_json(input) {
            Ok(v) => {
                for artifact in items(&v["metadata"]["inputArtifacts"])
                    .iter()
                    .chain(items(&v["evidencePackage"]["inputArtifactHashes"]))
                {
                    if let Some(path) = artifact["path"].as_str().filter(|s| !s.is_empty()) {
                        let yes = exists(&p.join(path))?;
                        add(
                            &format!("{name}:artifact:{path}"),
                            if yes { "pass" } else { "warn" },
                            if yes {
                                "artifact path exists"
                            } else {
                                "artifact path does not exist in this workspace"
                            },
                            Some(
                                "Ensure CI checks out or generates the artifact before qeg report.",
                            ),
                        );
                    }
                }
            }
            Err(e) => add(
                &format!("{name}:parse"),
                "fail",
                &format!("{e:#}"),
                Some("Fix gate-input.json so it is valid JSON."),
            ),
        }
    }
    Ok(
        json!({"reportVersion":"qeg-doctor-v1","generatedAt":now(),"status":worst(&checks,"severity"),"checks":checks}),
    )
}
fn evidence(targets: &[PathBuf]) -> Result<Value> {
    let mut rows = vec![];
    for p in targets {
        let attempt = || -> Result<Vec<Value>> {
            let input = runtime::validate_gate_input(&read_json(p.join("gate-input.json"))?)?;
            ensure!(
                input["valid"] == true,
                "schema invalid: {}",
                schema_errors(&input).join("; ")
            );
            let report = runtime::verify_evidence(&input["input"], p)?;
            let mut entries = items(&report["items"]).to_vec();
            for e in &mut entries {
                e["target"] = json!(p);
            }
            Ok(entries)
        };
        match attempt(){Ok(v)=>rows.extend(v),Err(e)=>rows.push(json!({"target":p,"artifactId":"gate-input","severity":"fail","code":"PATH_MISSING","message":format!("{e:#}")}))}
    }
    Ok(result("qeg-evidence-verify-v2", rows, "severity"))
}
fn lint(p: &Value, name: &str, add: &mut impl FnMut(&str, String)) {
    if !p.is_object() {
        add("fail", format!("{name} is missing"));
        return;
    }
    for k in ["policyId", "policyHash"] {
        if s(&p[k]).is_empty() {
            add("fail", format!("{name}.{k} is missing"));
        }
    }
    let h = s(&p["policyHash"]);
    if !h.is_empty() && !h.starts_with("sha256:") {
        add(
            "warn",
            format!("{name}.policyHash does not use sha256: prefix"),
        );
    }
    if items(&p["sourceRefs"]).is_empty() {
        add("fail", format!("{name}.sourceRefs is empty"));
    }
    if !p["exitCodePolicy"].is_object() {
        add("fail", format!("{name}.exitCodePolicy is missing"))
    } else {
        for (k, code) in [
            ("go", 0),
            ("conditional_go", 2),
            ("no_go", 2),
            ("disqualified", 2),
        ] {
            if p["exitCodePolicy"][k] != code {
                add("fail", format!("{name}.exitCodePolicy.{k} must be {code}"));
            }
        }
    }
    let (mut seen, mut dup) = (BTreeSet::new(), BTreeSet::new());
    for id in items(&p["dqScope"]).iter().map(s) {
        if !seen.insert(id) && dup.insert(id) {
            add("fail", format!("{name}.dqScope duplicates {id}"));
        }
    }
    let missing: Vec<_> = (1..=21)
        .map(|n| format!("DQ-{n:02}"))
        .filter(|id| !seen.contains(id.as_str()))
        .collect();
    if !missing.is_empty() {
        add(
            "warn",
            format!("{name}.dqScope does not include {}", missing.join(", ")),
        );
    }
    if p.get("reliabilityPolicy").is_some_and(|v| v.is_object()) {
        if !h.strip_prefix("sha256:").is_some_and(|v| {
            v.len() == 64
                && v.bytes()
                    .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
        }) {
            add(
                "fail",
                format!("{name}.policyHash must be SHA-256 when reliabilityPolicy is enabled"),
            );
        }
        let r: Vec<_> = ["DQ-18", "DQ-19", "DQ-20", "DQ-21"]
            .into_iter()
            .filter(|id| !seen.contains(id))
            .collect();
        if !r.is_empty() {
            add(
                "fail",
                format!("{name}.dqScope lacks reliability codes {}", r.join(", ")),
            );
        }
    }
}
fn policy(targets: &[PathBuf]) -> Result<Value> {
    let mut rows = vec![];
    for target in targets {
        let start = rows.len();
        let mut add = |sev: &str, msg: String| {
            rows.push(json!({"target":target,"severity":sev,"message":msg}))
        };
        match read_json(target.join("gate-input.json")) {
            Err(e) => add("fail", format!("{e:#}")),
            Ok(v) => {
                let p = &v["policy"];
                lint(p, "policy", &mut add);
                let packaged = &v["evidencePackage"]["gatePolicy"];
                if packaged.is_object() {
                    lint(packaged, "evidencePackage.gatePolicy", &mut add);
                    for k in ["policyId", "policyHash"] {
                        if !s(&p[k]).is_empty()
                            && !s(&packaged[k]).is_empty()
                            && p[k] != packaged[k]
                        {
                            add(
                                "fail",
                                format!("policy.{k} does not match evidencePackage.gatePolicy.{k}"),
                            );
                        }
                    }
                }
                for k in ["profile", "policyHash"] {
                    if !s(&v["metadata"][k]).is_empty()
                        && !s(&p[k]).is_empty()
                        && p[k] != v["metadata"][k]
                    {
                        add("fail", format!("metadata.{k} does not match policy.{k}"));
                    }
                }
            }
        }
        if rows.len() == start {
            rows.push(json!({"target":target,"severity":"pass","message":"policy lint passed"}));
        }
    }
    Ok(result("qeg-policy-lint-v1", rows, "severity"))
}
fn check(targets: &[PathBuf]) -> Result<Value> {
    let mut rows = vec![];
    let mut add = |name: &str, r: Value, array: &str, k: &str, f: fn(&str) -> bool, label: &str| {
        let n = items(&r[array]).iter().filter(|v| f(s(&v[k]))).count();
        rows.push(json!({"name":name,"status":r["status"],"message":format!("{n} {label}")}));
    };
    add(
        "schema-check",
        schema(targets)?,
        "items",
        "status",
        |v| v == "fail",
        "failing schema item(s)",
    );
    add(
        "enum-check",
        enums()?,
        "items",
        "status",
        |v| v == "fail",
        "enum drift item(s)",
    );
    add(
        "doctor",
        doctor(targets)?,
        "checks",
        "severity",
        |v| v != "pass",
        "doctor finding(s)",
    );
    if targets.is_empty() {
        for name in ["evidence-verify", "policy-lint", "snapshot", "report"] {
            rows.push(json!({"name":name,"status":"warn","message":"skipped because no targets were provided"}));
        }
    } else {
        add(
            "evidence-verify",
            evidence(targets)?,
            "items",
            "severity",
            |v| v == "fail",
            "evidence failure(s)",
        );
        add(
            "policy-lint",
            policy(targets)?,
            "items",
            "severity",
            |v| v == "fail",
            "policy failure(s)",
        );
        let failed = report::snapshots(targets, false)?
            .iter()
            .filter(|s| s["status"] == "missing" || s["status"] == "mismatch")
            .count();
        rows.push(json!({"name":"snapshot","status":if failed>0{"fail"}else{"pass"},"message":format!("{failed} snapshot failure(s)")}));
        let r = report::create(targets, &Default::default())?;
        let sum = &r["summary"];
        rows.push(json!({"name":"report","status":if sum["gateFailed"]==0&&sum["cliErrors"]==0{"pass"}else{"fail"},"message":format!("{} gate failure(s), {} CLI error(s)",sum["gateFailed"],sum["cliErrors"])}));
    }
    Ok(result("qeg-check-v2", rows, "status"))
}
pub(super) fn run(command: &str, args: &[String]) -> Result<i32> {
    let json = args.iter().any(|a| a == "--json");
    let targets = targets(
        &args
            .iter()
            .filter(|a| *a != "--json")
            .cloned()
            .collect::<Vec<_>>(),
    )?;
    if matches!(command, "policy-lint" | "evidence-verify") {
        ensure!(
            !targets.is_empty(),
            "Usage: qeg {} [--json] <fixture-dir-or-parent> [...]",
            command.replace('-', " ")
        );
    }
    let (title, r, fail) = match command {
        "policy-lint" => ("Policy Lint", policy(&targets)?, 1),
        "evidence-verify" => ("Evidence Verify", evidence(&targets)?, 1),
        "schema-check" => ("Schema Check", schema(&targets)?, 2),
        "enum-check" => ("Type/Schema Enum Check", enums()?, 2),
        "doctor" => ("Doctor", doctor(&targets)?, 1),
        "check" => ("Check", check(&targets)?, 1),
        _ => bail!("Unknown diagnostic {command}"),
    };
    if json {
        print!("{}", document(&r)?);
    } else {
        println!(
            "QEG {title}\nGenerated at: {}\nOverall: {}\n",
            s(&r["generatedAt"]),
            s(&r["status"]).to_uppercase()
        );
        for e in items(r.get("items").unwrap_or(&r["checks"])) {
            let severity = s(e.get("severity").unwrap_or(&e["status"]));
            let name = s(e.get("name").unwrap_or(&e["target"]));
            let artifact = e["artifactId"]
                .as_str()
                .map(|s| format!(" {s}"))
                .unwrap_or_default();
            let msg = e["message"]
                .as_str()
                .map(|s| format!(": {s}"))
                .unwrap_or_default();
            println!("- {} {name}{artifact}{msg}", severity.to_uppercase());
            if let Some(f) = e["remediation"].as_str().filter(|_| severity != "pass") {
                println!("  remediation: {f}");
            }
            for err in items(&e["errors"]).iter().take(8) {
                println!("  - {}", s(err));
            }
            if items(&e["errors"]).len() > 8 {
                println!("  - {} more error(s)", items(&e["errors"]).len() - 8);
            }
            for (k, label) in [
                ("missingInSchema", "missing in schema"),
                ("missingInTypes", "missing in types"),
            ] {
                if !items(&e[k]).is_empty() {
                    println!("  {label}: {}", join_values(&e[k], ", "));
                }
            }
        }
    }
    Ok(if r["status"] == "fail" { fail } else { 0 })
}
