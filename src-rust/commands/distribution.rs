use super::*;
use crate::common::digest;
use indexmap::IndexMap;
use regex::Regex;
use std::io::Write;
use std::sync::LazyLock;
const WORKFLOW: &str = "name: QEG\n\non:\n  pull_request:\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\njobs:\n  qeg:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n      - uses: ./.qeg/runtime/qeg-report-action\n        with:\n          targets: .qeg\n          output-path: .qeg/qeg-ci-report.json\n";
fn initial_input() -> Value {
    let now = now();
    let metadata = json!({"qegVersion":"0.2","runId":"qeg:run-local-init","createdAt":now,"profile":"standard","inputArtifacts":[]});
    json!({"metadata":metadata,"graph":{"metadata":metadata,"nodes":[],"edges":[],"completeness":{"score":1,"partial":false,"parserFailures":[],"unsupportedClaims":[]}},
        "policy":{"inputContract":crate::graph::upstream_input_contract("local-init"),"policyId":"qeg:policy-local-init","policyHash":"sha256:replace-me","profile":"standard","effectiveDate":now,"approver":"replace-me",
        "sourceRefs":[{"id":"qeg:sr-policy-local-init","path":"docs/policy.md"}],"dqScope":(1..=21).map(|n|format!("DQ-{n:02}")).collect::<Vec<_>>(),"exitCodePolicy":{"go":0,"conditional_go":2,"no_go":2,"disqualified":2}},"waivers":[]})
}
fn create(path: &Path, content: &str, force: bool) -> Result<&'static str> {
    fs::create_dir_all(path.parent().context("Output parent missing")?)?;
    match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
    {
        Ok(mut handle) => {
            handle.write_all(content.as_bytes())?;
            Ok("created")
        }
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            if force {
                ensure!(
                    fs::symlink_metadata(path)?.is_file(),
                    "Not a regular file: {}",
                    path.display()
                );
                fs::write(path, content)?;
                Ok("overwritten")
            } else {
                Ok("skipped")
            }
        }
        Err(e) => Err(e.into()),
    }
}
pub(super) fn init(args: &[String]) -> Result<i32> {
    let mut it = args.iter();
    let mut root = ".";
    let mut force = false;
    while let Some(a) = it.next() {
        match a.as_str() {
            "--root" => root = take_option(&mut it, a)?,
            "--force" => force = true,
            _ => bail!("Usage: qeg init [--root <dir>] [--force]"),
        }
    }
    let root = abs(root)?;
    let qeg = root.join(".qeg");
    let mut results = vec![];
    for (p, content) in [
        (qeg.join("gate-input.json"), document(&initial_input())?),
        (
            qeg.join("qeg-baseline.json"),
            document(&json!({"entries":[]}))?,
        ),
        (root.join(".github/workflows/qeg.yml"), WORKFLOW.into()),
    ] {
        let status = create(&p, &content, force)?;
        results.push((p, status));
    }
    crate::assets::install_action(&qeg.join("runtime"), force)?;
    println!("QEG init\n- runtime: {}", qeg.join("runtime").display());
    for (p, st) in &results {
        println!("- {st}: {}", p.display());
    }
    if results.iter().any(|(_, s)| *s == "skipped") {
        println!("Use --force to overwrite skipped files.");
    }
    Ok(0)
}
fn redact(v: &mut Value) {
    static SECRET: LazyLock<Regex> =
        LazyLock::new(|| Regex::new("(?i)token|secret|password|api[_-]?key|credential").unwrap());
    static TOKEN: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"(ghp_|github_pat_|sk-)[A-Za-z0-9_\-]+").unwrap());
    match v {
        Value::Object(m) => {
            for (k, v) in m {
                if SECRET.is_match(k) {
                    *v = json!("[REDACTED]");
                } else {
                    redact(v)
                }
            }
        }
        Value::Array(a) => a.iter_mut().for_each(redact),
        Value::String(s) => {
            if SECRET.is_match(s) {
                *s = "[REDACTED]".into();
            } else {
                *s = TOKEN.replace_all(s, "[REDACTED]").into_owned();
            }
        }
        _ => {}
    }
}
fn hash(data: &[u8]) -> String {
    digest(data).trim_start_matches("sha256:").to_string()
}
pub(super) fn repro(args: &[String]) -> Result<i32> {
    let mut paths = vec![];
    let mut it = args.iter();
    let mut report = None;
    let mut out = ".qeg/repro-bundle";
    while let Some(a) = it.next() {
        match a.as_str() {
            "--report" => report = Some(take_option(&mut it, a)?),
            "--out" => out = take_option(&mut it, a)?,
            _ => paths.push(a.clone()),
        }
    }
    let out = abs(out)?;
    let targets = targets(&paths)?;
    let mut files = IndexMap::new();
    let mut manifest = vec![];
    let mut errors = vec![];
    let mut stage = |name: &str, mut v: Value, source: Option<&Path>| -> Result<()> {
        ensure!(
            !files.contains_key(name),
            "Duplicate repro bundle filename: {name}"
        );
        redact(&mut v);
        let content = document(&v)?;
        let mut row = json!({"path":out.join(name),"sha256":hash(content.as_bytes())});
        if let Some(src) = source {
            row["sourceTarget"] = json!(src);
        }
        files.insert(name.to_string(), content);
        manifest.push(row);
        Ok(())
    };
    if let Some(path) = report {
        stage("qeg-ci-report.json", read_json(path)?, None)?;
    }
    stage("doctor.json", diagnostics::doctor(&targets)?, None)?;
    let mut inventory = vec![];
    for &(name, bytes) in crate::assets::ASSETS {
        if name.starts_with("schemas/") && name.ends_with(".schema.json") {
            inventory.push(json!({"file":&name[8..],"sha256":hash(bytes),"bytes":std::str::from_utf8(bytes)?.encode_utf16().count()}));
        }
    }
    inventory.sort_by(|a, b| s(&a["file"]).cmp(s(&b["file"])));
    stage("schemas.json", json!(inventory), None)?;
    if let Some(workflow) = if_text(Path::new(".github/workflows/ci.yml"))? {
        stage(
            "workflow.json",
            json!({"path":".github/workflows/ci.yml","content":workflow}),
            None,
        )?;
    }
    for p in targets {
        match crate::storage::read_input(&p).and_then(|s| Ok(serde_json::from_str(&s)?)) {
            Ok(v) => stage(
                &format!("gate-input-{}.json", hash(p.to_string_lossy().as_bytes())),
                v,
                Some(&p),
            )?,
            Err(e) => {
                let mut message = json!(format!("{e:#}"));
                redact(&mut message);
                errors.push(json!({"target":p,"error":message}));
            }
        }
    }
    let mut index = json!({"reportVersion":"qeg-repro-bundle-v1","generatedAt":now(),"package":{"name":"@quality-harness/quality-evidence-graph","version":env!("CARGO_PKG_VERSION")},"files":manifest,"inputErrors":errors});
    if let Some(path) = report {
        index["reportPath"] = json!(path);
    }
    files.insert("manifest.json".into(), document(&index)?);
    fs::create_dir_all(&out)?;
    crate::storage::with_lease(&out, |p| {
        crate::storage::publish(p, &files)?;
        let snap = crate::storage::read_outputs(p)?;
        for (name, content) in &files {
            ensure!(
                snap["files"][name.as_str()].as_str() == Some(content.as_str()),
                "Repro bundle hash mismatch: {name}"
            );
        }
        Ok(())
    })?;
    println!(
        "QEG repro bundle written to: {}\nManifest: {}",
        out.display(),
        out.join("manifest.json").display()
    );
    if !errors.is_empty() {
        println!(
            "Input capture diagnostics: {}; see manifest.inputErrors",
            errors.len()
        );
    }
    Ok(0)
}
