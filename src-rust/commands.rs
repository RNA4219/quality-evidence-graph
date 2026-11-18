use crate::common::{document, items, s};
use anyhow::{Context, Result, bail, ensure};
use chrono::{SecondsFormat, Utc};
use serde_json::{Value, json};
use std::fs;
use std::path::{Component, Path, PathBuf};
mod baseline;
mod diagnostics;
mod distribution;
mod format;
mod normalize;
mod report;
mod select;

pub use diagnostics::verify_output_manifest;
pub use format::execution_summary;
pub use normalize::status_for_api;
pub use report::compare_expected;

pub fn run(command: &str, args: &[String]) -> Result<i32> {
    match command {
        "report" => report::run(args),
        "check" | "doctor" | "schema-check" | "enum-check" => diagnostics::run(command, args),
        "evidence" => match args.split_first() {
            Some((sub, rest)) if sub == "normalize" => normalize::run(rest),
            Some((sub, rest)) if sub == "verify" => diagnostics::run("evidence-verify", rest),
            _ => bail!(
                "Usage: qeg evidence verify <target> | normalize --adapter <kind> --input <raw.json> --context <context.json> --out <evidence.json>"
            ),
        },
        "policy" if args.first().map(String::as_str) == Some("lint") => {
            diagnostics::run("policy-lint", &args[1..])
        }
        "policy" => bail!("Usage: qeg policy lint <fixture-dir-or-parent> [...]"),
        "baseline" => baseline::run(args),
        "snapshot" => report::snapshot_command(args),
        "explain" => explain(args),
        "init" => distribution::init(args),
        "repro-bundle" => distribution::repro(args),
        _ => bail!("Unknown command: {command}"),
    }
}

fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
fn read_json(p: impl AsRef<Path>) -> Result<Value> {
    let p = p.as_ref();
    serde_json::from_slice(&fs::read(p).with_context(|| format!("Read {}", p.display()))?)
        .with_context(|| format!("Invalid JSON in {}", p.display()))
}
fn clean(p: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for c in p.components() {
        match c {
            Component::CurDir => {}
            Component::ParentDir => {
                result.pop();
            }
            _ => result.push(c.as_os_str()),
        }
    }
    result
}
fn abs(p: impl AsRef<Path>) -> Result<PathBuf> {
    Ok(clean(&std::env::current_dir()?.join(p)))
}
fn portable(p: &Path) -> String {
    p.display().to_string().replace('\\', "/")
}
fn key(p: &Path) -> Result<String> {
    // Deleted changed files can still have a symlinked or junction-backed parent.
    let mut ancestor = p;
    let mut suffix = Vec::new();
    let mut resolved = loop {
        match crate::storage::absolute(ancestor) {
            Ok(path) => break path,
            Err(error)
                if error.downcast_ref::<std::io::Error>().is_some_and(|e| {
                    matches!(
                        e.kind(),
                        std::io::ErrorKind::NotFound | std::io::ErrorKind::NotADirectory
                    )
                }) =>
            {
                let Some(name) = ancestor.file_name() else {
                    return Err(error);
                };
                suffix.push(name);
                ancestor = ancestor.parent().context("No path parent")?;
            }
            Err(error) => return Err(error),
        }
    };
    for component in suffix.into_iter().rev() {
        resolved.push(component);
    }
    let v = portable(&resolved);
    Ok(if cfg!(windows) { v.to_lowercase() } else { v })
}
fn exists(p: &Path) -> Result<bool> {
    match fs::metadata(p) {
        Ok(_) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e.into()),
    }
}
fn if_text(p: &Path) -> Result<Option<String>> {
    match fs::read_to_string(p) {
        Ok(v) => Ok(Some(v)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e).with_context(|| format!("Read {}", p.display())),
    }
}
fn fixture_like(p: &Path) -> Result<bool> {
    for marker in [
        "gate-input.json",
        "expected-gate-verdict.json",
        "ingest-manifest.json",
        "qeg.bundle.json",
        "test-placement-plan.json",
        "output-manifest.json",
        "quality-evidence-record.json",
        "migration-report.json",
    ] {
        if exists(&p.join(marker))? {
            return Ok(true);
        }
    }
    Ok(false)
}
fn targets(args: &[String]) -> Result<Vec<PathBuf>> {
    let mut result = vec![];
    for raw in args {
        let p = abs(raw)?;
        let mut paths = vec![];
        if p.is_dir() && !fixture_like(&p)? {
            for ent in fs::read_dir(&p)? {
                let ent = ent?;
                if ent.file_type()?.is_dir() && fixture_like(&ent.path())? {
                    paths.push(ent.path());
                }
            }
            paths.sort();
        }
        if paths.is_empty() {
            paths.push(p)
        }
        for p in paths {
            if !result.contains(&p) {
                result.push(p)
            }
        }
    }
    Ok(result)
}
fn take_option<'a>(args: &mut impl Iterator<Item = &'a String>, name: &str) -> Result<&'a str> {
    args.next()
        .map(String::as_str)
        .filter(|s| !s.is_empty())
        .with_context(|| format!("Expected value after {name}"))
}
fn worst(v: &[Value], field: &str) -> &'static str {
    if v.iter().any(|i| i[field] == "fail") {
        "fail"
    } else if v.iter().any(|i| i[field] == "warn") {
        "warn"
    } else {
        "pass"
    }
}
fn join_values(v: &Value, sep: &str) -> String {
    items(v).iter().map(s).collect::<Vec<_>>().join(sep)
}
fn schema_errors(v: &Value) -> Vec<String> {
    items(&v["issues"])
        .iter()
        .map(|i| format!("{} {}", s(&i["path"]), s(&i["message"])))
        .collect()
}
fn explanation(code: &str) -> Result<&'static Value> {
    static DATA: std::sync::LazyLock<Value> = std::sync::LazyLock::new(|| {
        serde_json::from_str(include_str!("commands/dq.json")).expect("checked-in DQ catalog")
    });
    DATA.get(code)
        .context("Usage: qeg explain <DQ-01..DQ-21> [--json]")
}
fn explain(args: &[String]) -> Result<i32> {
    let entry = explanation(args.first().map(String::as_str).unwrap_or(""))?;
    if args.iter().any(|a| a == "--json") {
        print!("{}", document(entry)?);
    } else {
        println!(
            "{}: {}\n\nMeaning\n- {}",
            s(&entry["code"]),
            s(&entry["title"]),
            s(&entry["meaning"])
        );
        for (k, label) in [
            ("commonCauses", "Common causes"),
            ("requiredEvidence", "Required evidence"),
            ("minimalFix", "Minimal fix"),
            ("references", "References"),
        ] {
            println!("\n{label}");
            for v in items(&entry[k]) {
                println!("- {}", s(v));
            }
        }
    }
    Ok(0)
}
