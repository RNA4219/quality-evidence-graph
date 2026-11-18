//! GitHub Action の診断ファイル、Markdown 要約、step output を生成する。
use crate::common::{document, items, s};
use anyhow::{Context, Result, ensure};
use chrono::{SecondsFormat, Utc};
use serde_json::{Value, json};
use std::{env, fs, io::Write, path::Path};

fn append(path: &Path, text: &str) -> Result<()> {
    fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?
        .write_all(text.as_bytes())?;
    Ok(())
}

fn failure() -> Value {
    let reason = "QEG report command failed before producing a report artifact";
    let target = env::var("QEG_EFFECTIVE_REPORT_COMMAND").unwrap_or_else(|_| "qeg".into());
    json!({
        "reportVersion":"qeg-ci-report-v2","generatedAt":Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true),
        "selection":{"mode":"all","status":"detection_failed","strategy":"all","changedFileCount":0,"selectedTargetCount":0,"error":reason},
        "errors":[{"code":"ACTION_REPORT_FAILED","message":reason}],
        "summary":{"totalTargets":1,"passed":0,"baselineAccepted":0,"gateFailed":0,"cliErrors":1,"dqCounts":[],"blockerCount":0,"residualRiskCount":0,"humanReviewCount":0},
        "targets":[{"target":target,"status":"cli_error","exitCode":1,"reasons":[],"disqualifications":[],"blockers":[],"residualRisks":[],"requiredHumanReview":[],"error":reason}]
    })
}

fn number(v: &Value) -> u64 {
    v.as_u64().unwrap_or_default()
}

fn summary(report: &Value, dqs: u64) -> String {
    let totals = &report["summary"];
    let mut lines = vec!["## QEG CI Report".to_owned(), String::new()];
    for (label, key) in [
        ("targets", "totalTargets"),
        ("passed", "passed"),
        ("baseline accepted", "baselineAccepted"),
        ("gate failed", "gateFailed"),
        ("cli errors", "cliErrors"),
    ] {
        lines.push(format!("- {label}: {}", number(&totals[key])));
    }
    lines.push(format!("- DQs: {dqs}"));
    if let Some(diff) = report.get("diff").filter(|v| v.is_object()) {
        for key in ["new", "resolved", "unchanged", "unverified"] {
            lines.push(format!("- {key} DQs: {}", items(&diff[key]).len()));
        }
    }
    lines.push(String::new());
    lines.join("\n")
}

fn publish(path: &Path, content: &str) -> Result<()> {
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(parent)?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
    temporary.write_all(content.as_bytes())?;
    temporary.persist(path)?;
    Ok(())
}

pub fn run(args: &[String]) -> Result<i32> {
    ensure!(
        args.len() == 2,
        "Usage: __action-summary <staged-report> <report-exit-code>"
    );
    let mut exit = args[1].parse::<i32>().context("Invalid report exit code")?;
    let destination = env::var("QEG_OUTPUT_PATH")?;
    let summary_path = env::var("QEG_SUMMARY_PATH")?;
    let outputs = env::var("GITHUB_OUTPUT")?;
    let loaded = match fs::read(&args[0]) {
        Ok(bytes) => serde_json::from_slice::<Value>(&bytes)
            .ok()
            .filter(|v| v["summary"].is_object()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.into()),
    };
    let mut report = if let Some(value) = loaded {
        value
    } else {
        exit = 1;
        let report = failure();
        if env::var("QEG_GITHUB_SUMMARY").as_deref() == Ok("true")
            && let Ok(path) = env::var("GITHUB_STEP_SUMMARY")
            && !path.is_empty()
        {
            append(
                Path::new(&path),
                &format!(
                    "## QEG CI Report\n\n{}\n",
                    s(&report["errors"][0]["message"])
                ),
            )?;
        }
        println!("{}", document(&report)?);
        report
    };
    if ["QEG_BUILD_OUTCOME", "QEG_INSTALL_OUTCOME"]
        .iter()
        .any(|key| env::var(key).as_deref() == Ok("failure"))
    {
        exit = 1;
        if !report["errors"].is_array() {
            report["errors"] = json!([]);
        }
        report["errors"].as_array_mut().unwrap().push(
            json!({"code":"ACTION_PREFLIGHT_FAILED","message":"install or build command failed"}),
        );
        report["summary"]["cliErrors"] =
            json!(number(&report["summary"]["cliErrors"]).saturating_add(1));
    }
    let totals = &report["summary"];
    let dqs = items(&totals["dqCounts"])
        .iter()
        .fold(0_u64, |n, item| n.saturating_add(number(&item["count"])));
    let destination = Path::new(&destination);
    publish(destination, &document(&report)?)?;
    publish(Path::new(&summary_path), &summary(&report, dqs))?;
    publish(
        &destination.with_file_name("qeg-report-exit-code.txt"),
        &format!("{exit}\n"),
    )?;
    append(
        Path::new(&outputs),
        &format!(
            "gate_failed={}\ncli_errors={}\ndq_count={dqs}\nreport_path={}\nsummary_markdown_path={summary_path}\nexit_code={exit}\n",
            number(&totals["gateFailed"]),
            number(&totals["cliErrors"]),
            destination.display()
        ),
    )?;
    Ok(0)
}
