use super::*;
use std::collections::BTreeMap;
use std::io::Write;

fn sorted_field(v: &Value, field: &str) -> Vec<String> {
    let mut result: Vec<_> = items(v)
        .iter()
        .filter_map(|i| i[field].as_str().map(String::from))
        .collect();
    result.sort();
    result
}

pub fn compare_expected(expected: &Value, evaluated: &Value) -> Value {
    let g = &evaluated["gateResult"];
    let exit = &evaluated["policy"]["exitCodePolicy"][s(&g["verdict"])];
    let expected_dq = sorted_field(&expected["expectedDisqualifications"], "code");
    let actual_dq = sorted_field(&g["disqualifications"], "code");
    let includes = expected["expectedDisqualificationMode"] == "includes";
    let missing: Vec<_> = expected_dq
        .iter()
        .filter(|id| !actual_dq.contains(id))
        .collect();
    let unexpected: Vec<_> = actual_dq
        .iter()
        .filter(|id| !includes && !expected_dq.contains(id))
        .collect();
    let dq_match = if includes {
        missing.is_empty()
    } else {
        expected_dq == actual_dq
    };
    let exp_ids = sorted_field(&expected["expectedBlockers"], "id");
    let actual_ids = sorted_field(&g["blockers"], "id");
    let mode = expected["expectedBlockerMode"]
        .as_str()
        .or(if exp_ids.is_empty() {
            None
        } else {
            Some("exact")
        });
    let blocker_match = mode.is_none()
        || ((mode == Some("includes") || exp_ids == actual_ids)
            && items(&expected["expectedBlockers"]).iter().all(|e| {
                items(&g["blockers"]).iter().any(|b| {
                    b["id"] == e["id"]
                        && b["message"] == e["message"]
                        && [
                            "ruleId",
                            "riskIds",
                            "testId",
                            "evidenceId",
                            "effective",
                            "waiverId",
                        ]
                        .iter()
                        .all(|k| e.get(*k).is_none_or(|v| b.get(*k) == Some(v)))
                })
            }));
    let verdict_match = g["verdict"] == expected["expectedVerdict"];
    let exit_match = exit == &expected["expectedExitCode"];
    let mut comparison = json!({"fixture":expected["fixture"],"expectedVerdict":expected["expectedVerdict"],"expectedExitCode":expected["expectedExitCode"],
      "validationPassed":verdict_match && exit_match && dq_match && blocker_match,"verdictMatch":verdict_match,"exitCodeMatch":exit_match,"dqMatch":dq_match,
      "expectedDqCodes":expected_dq,"actualDqCodes":actual_dq,"unexpectedDqCodes":unexpected,"missingDqCodes":missing,
      "blockerMatch":blocker_match,"expectedBlockerIds":exp_ids,"actualBlockerIds":actual_ids});
    if let Some(reference) = expected.get("contractRef") {
        comparison["contractRef"] = reference.clone();
    }
    comparison
}

pub(super) fn target_result(p: &Path) -> Value {
    let attempt = || -> Result<Value> {
        let eval = crate::runtime::evaluate(p, true)?;
        let g = &eval["gateResult"];
        let exit = eval["policy"]["exitCodePolicy"][s(&g["verdict"])]
            .as_i64()
            .context("Missing exitCodePolicy")?;
        let ep = p.join("expected-gate-verdict.json");
        let expected = if ep.is_file() {
            Some(compare_expected(&read_json(ep)?, &eval))
        } else {
            None
        };
        let passed = exit == 0
            && expected
                .as_ref()
                .is_none_or(|v| v["validationPassed"] == true);
        let mut result = json!({"target":eval["fixtureDir"],"status":if passed{"passed"}else{"gate_failed"},"exitCode":exit});
        for field in [
            "evaluationScope",
            "verdict",
            "reasons",
            "disqualifications",
            "blockers",
            "residualRisks",
            "requiredHumanReview",
            "reliability",
            "executionAccounting",
        ] {
            if let Some(v) = g.get(field) {
                result[field] = v.clone();
            }
        }
        if let Some(v) = expected {
            result["expected"] = v;
        }
        Ok(result)
    };
    attempt().unwrap_or_else(|err|json!({"target":p,"status":"cli_error","exitCode":1,"reasons":[],"disqualifications":[],"blockers":[],"residualRisks":[],"requiredHumanReview":[],"reliability":{"enabled":false},"error":format!("{err:#}")}))
}

#[derive(Default)]
pub(super) struct Options {
    baseline: Option<String>,
    changed: bool,
    diff: Option<String>,
}
pub(super) fn create(targets: &[PathBuf], opts: &Options) -> Result<Value> {
    let (selected, sel) = select::select(targets, opts.changed)?;
    let mut errors = vec![];
    if let Some(e) = sel.get("error") {
        errors.push(json!({"code":"CHANGE_DETECTION_FAILED","message":e}));
    }
    let baseline = match &opts.baseline {
        Some(path) => match baseline::eligible(path) {
            Ok(v) => Some(v),
            Err(e) => {
                errors.push(json!({"code":"BASELINE_INVALID","message":format!("{e:#}")}));
                None
            }
        },
        None => None,
    };
    let mut rows = vec![];
    let mut codes = BTreeMap::new();
    for p in selected {
        let mut row = target_result(&p);
        if let Some(b) = &baseline {
            baseline::apply(&mut row, b)?;
        }
        for dq in items(&row["disqualifications"]) {
            *codes.entry(s(&dq["code"]).to_string()).or_insert(0) += 1;
        }
        rows.push(row);
    }
    let count = |status: &str| rows.iter().filter(|r| r["status"] == status).count();
    let total = |field: &str| rows.iter().map(|r| items(&r[field]).len()).sum::<usize>();
    let dqs: Vec<_> = codes
        .into_iter()
        .map(|(code, n)| {
            Ok(json!({"code":code,"count":n,"remediation":explanation(&code)?["remediation"]}))
        })
        .collect::<Result<_>>()?;
    let summary = json!({"totalTargets":rows.len(),"passed":count("passed"),"baselineAccepted":count("baseline_accepted"),"gateFailed":count("gate_failed"),
        "cliErrors":count("cli_error")+errors.len(),"dqCounts":dqs,"blockerCount":total("blockers"),"residualRiskCount":total("residualRisks"),"humanReviewCount":total("requiredHumanReview")});
    let mut rep = json!({"reportVersion":"qeg-ci-report-v2","generatedAt":now(),"selection":sel,"errors":errors,"summary":summary,"targets":rows});
    if let Some(path) = &opts.diff {
        rep["diff"] = baseline::diff(&rep, path)?;
    }
    Ok(rep)
}
pub(super) fn run(args: &[String]) -> Result<i32> {
    let mut it = args.iter();
    let mut requested = vec![];
    let mut opts = Options::default();
    let (mut output, mut json, mut summary) = (None, false, false);
    while let Some(a) = it.next() {
        match a.as_str() {
            "--json" => json = true,
            "--format" => {
                json = match take_option(&mut it, a)? {
                    "text" => false,
                    "json" => true,
                    _ => bail!("Expected --format text|json"),
                }
            }
            "--out" => output = Some(PathBuf::from(take_option(&mut it, a)?)),
            "--github-summary" => summary = true,
            "--baseline" => opts.baseline = Some(take_option(&mut it, a)?.into()),
            "--changed-only" => opts.changed = true,
            "--diff" => opts.diff = Some(take_option(&mut it, a)?.into()),
            _ => requested.push(a.clone()),
        }
    }
    ensure!(
        !requested.is_empty(),
        "Usage: qeg report [--json|--format text|json] [--out <path>] [--github-summary] [--baseline <path>] [--changed-only] [--diff <previous-report.json>] <fixture-dir-or-parent> [...]"
    );
    let r = create(&targets(&requested)?, &opts)?;
    let result = if json {
        document(&r)?
    } else {
        format::report(&r, false)
    };
    if let Some(p) = output {
        if let Some(dir) = p.parent() {
            fs::create_dir_all(dir)?;
        }
        fs::write(p, &result)?;
    }
    if summary {
        let p = PathBuf::from(std::env::var_os("GITHUB_STEP_SUMMARY").unwrap_or_default());
        ensure!(
            p.is_absolute(),
            "--github-summary requires an absolute GITHUB_STEP_SUMMARY file path"
        );
        ensure!(
            fs::symlink_metadata(&p)
                .with_context(|| format!("Inspect GITHUB_STEP_SUMMARY {}", p.display()))?
                .is_file(),
            "GITHUB_STEP_SUMMARY must be a regular file"
        );
        fs::OpenOptions::new()
            .append(true)
            .open(p)?
            .write_all(format::report(&r, true).as_bytes())?;
    }
    print!("{result}");
    Ok(if r["summary"]["cliErrors"].as_u64().unwrap_or(0) > 0 {
        1
    } else if r["summary"]["gateFailed"].as_u64().unwrap_or(0) > 0 {
        2
    } else {
        0
    })
}
fn legacy(v: &mut Value, target: &str, anchor: &str) {
    match v {
        Value::Object(obj) => {
            for (k, v) in obj {
                if k == "generatedAt" {
                    *v = json!("<snapshot>")
                } else {
                    legacy(v, target, anchor)
                }
            }
        }
        Value::String(x) => *x = x.replace('\\', "/").replace(target, anchor),
        Value::Array(a) => {
            for v in a {
                legacy(v, target, anchor)
            }
        }
        _ => {}
    }
}
pub(super) fn snapshots(targets: &[PathBuf], update: bool) -> Result<Vec<Value>> {
    let mut rows = vec![];
    for p in targets {
        let r = create(std::slice::from_ref(p), &Options::default())?;
        let mut normalized = r.clone();
        normalized["generatedAt"] = json!("<snapshot>");
        normalized["targets"][0]["target"] = json!("<target>");
        let snapshot = json!({"snapshotVersion":"qeg-report-snapshot-v1","report":normalized});
        let path = p.join("expected-report.json");
        let status = if update {
            fs::write(&path, document(&snapshot)?)?;
            "updated"
        } else {
            match if_text(&path)? {
                None => "missing",
                Some(content) => {
                    let expected: Value = serde_json::from_str(&content).unwrap_or_default();
                    let matches = if expected.get("snapshotVersion").is_some() {
                        expected == snapshot
                    } else if let Some(anchor) = expected["targets"][0]["target"]
                        .as_str()
                        .filter(|s| !s.is_empty())
                    {
                        let mut legacy_report = r.clone();
                        legacy(
                            &mut legacy_report,
                            &portable(Path::new(s(&r["targets"][0]["target"]))),
                            anchor,
                        );
                        legacy_report == expected
                    } else {
                        false
                    };
                    if matches { "pass" } else { "mismatch" }
                }
            }
        };
        rows.push(json!({"target":p,"status":status,"path":path}));
    }
    Ok(rows)
}
pub(super) fn snapshot_command(args: &[String]) -> Result<i32> {
    let args0 = args
        .iter()
        .filter(|a| *a != "--update")
        .cloned()
        .collect::<Vec<_>>();
    ensure!(
        !args0.is_empty(),
        "Usage: qeg snapshot [--update] <fixture-dir-or-parent> [...]"
    );
    let rows = snapshots(&targets(&args0)?, args.iter().any(|s| s == "--update"))?;
    println!("QEG Report Snapshots");
    for r in &rows {
        println!(
            "- {} {} -> {}",
            s(&r["status"]).to_uppercase(),
            s(&r["target"]),
            s(&r["path"])
        );
    }
    Ok(
        if rows
            .iter()
            .any(|r| r["status"] == "missing" || r["status"] == "mismatch")
        {
            2
        } else {
            0
        },
    )
}
