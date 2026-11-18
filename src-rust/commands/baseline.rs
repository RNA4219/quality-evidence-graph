use super::*;
use std::collections::{BTreeMap, BTreeSet};

fn read(path: &str) -> Result<Value> {
    let v = read_json(path)?;
    let r = crate::runtime::validate_output(&v, "report-baseline.schema.json")?;
    ensure!(
        r["valid"] == true,
        "Invalid baseline structure: {path}; {}",
        schema_errors(&r).join("; ")
    );
    Ok(v)
}
fn entry_issues(b: &Value, clock: i128) -> Result<Vec<Value>> {
    let mut out = vec![];
    let mut issue = |severity: &str, message: &str| {
        out.push(json!({"severity":severity,"message":message,"entry":b}))
    };
    if s(&b["owner"]).trim().is_empty() {
        issue("fail", "baseline entry has no owner");
    }
    if let Some(t) = b.get("expiresAt") {
        let expires = crate::common::timestamp_nanos(t).or_else(|| {
            use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, TimeZone};
            let value = t.as_str()?;
            // Legacy baselines may have an ISO calendar date, an unzoned local timestamp, or an HTTP date.
            let seconds = if let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
                date.and_hms_opt(0, 0, 0)?.and_utc().timestamp()
            } else if let Ok(date) = NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.f") {
                Local.from_local_datetime(&date).earliest()?.timestamp()
            } else {
                DateTime::parse_from_rfc2822(value).ok()?.timestamp()
            };
            Some(seconds as i128 * 1_000_000_000)
        });
        match expires {
            None => issue("fail", "baseline entry expiresAt is not a valid date"),
            Some(n) if n <= clock => issue("fail", "baseline entry is expired"),
            _ => {}
        }
    } else {
        issue("warn", "baseline entry has no expiresAt")
    }
    if let Some(path) = b["target"].as_str()
        && !abs(path)?.is_dir()
    {
        issue(
            "fail",
            "baseline target does not exist or is not a directory",
        );
    }
    Ok(out)
}
fn matches(b: &Value, p: &str, d: &Value) -> Result<bool> {
    if let Some(t) = b["target"].as_str()
        && key(&abs(t)?)? != key(&abs(p)?)?
    {
        return Ok(false);
    }
    if b["code"] != d["code"] || b.get("message").is_some_and(|msg| msg != &d["message"]) {
        return Ok(false);
    }
    Ok(b.get("nodeIds")
        .is_none_or(|v| sorted(v) == sorted(&d["nodeIds"])))
}
fn sorted(v: &Value) -> Vec<&str> {
    let mut v: Vec<_> = items(v).iter().map(s).collect();
    v.sort();
    v
}
pub(super) fn eligible(path: &str) -> Result<Value> {
    let v = read(path)?;
    let mut failures = vec![];
    let clock = Utc::now().timestamp_micros() as i128 * 1000;
    for (i, b) in items(&v["entries"]).iter().enumerate() {
        for issue in entry_issues(b, clock)? {
            if issue["severity"] == "fail" {
                failures.push(format!("entry {i}: {}", s(&issue["message"])));
            }
        }
    }
    ensure!(
        failures.is_empty(),
        "Baseline is not eligible: {}",
        failures.join("; ")
    );
    Ok(v)
}
pub(super) fn apply(row: &mut Value, base: &Value) -> Result<()> {
    let dqs = items(&row["disqualifications"]);
    if row["status"] != "gate_failed"
        || dqs.is_empty()
        || ["blockers", "residualRisks", "requiredHumanReview"]
            .iter()
            .any(|k| !items(&row[*k]).is_empty())
        || row["expected"]["validationPassed"] == false
    {
        return Ok(());
    }
    for dq in dqs {
        let mut found = false;
        for b in items(&base["entries"]) {
            if matches(b, s(&row["target"]), dq)? {
                found = true;
                break;
            }
        }
        if !found {
            return Ok(());
        }
    }
    row["status"] = json!("baseline_accepted");
    row["exitCode"] = json!(0);
    if let Some(reasons) = row["reasons"].as_array_mut() {
        reasons.push(json!(
            "All current DQs are accepted by baseline; report fails only on new DQs."
        ));
    }
    Ok(())
}
pub(super) fn run(args: &[String]) -> Result<i32> {
    ensure!(
        args.first().is_some_and(|s| s == "audit") && args.len() >= 2,
        "Usage: qeg baseline audit <baseline.json> [--json] [fixture-dir-or-parent ...]"
    );
    let path = &args[1];
    let b = read(path)?;
    let rows = targets(
        &args[2..]
            .iter()
            .filter(|a| *a != "--json")
            .cloned()
            .collect::<Vec<_>>(),
    )?
    .iter()
    .map(|p| report::target_result(p))
    .collect::<Vec<_>>();
    let clock = Utc::now().timestamp_micros() as i128 * 1000;
    let mut out = vec![];
    for e in items(&b["entries"]) {
        out.extend(entry_issues(e, clock)?);
        if !rows.is_empty() {
            let mut matched = false;
            for row in &rows {
                for dq in items(&row["disqualifications"]) {
                    matched |= matches(e, s(&row["target"]), dq)?;
                }
            }
            if !matched {
                out.push(json!({"severity":"warn","entry":e,"message":"baseline entry no longer matches a current DQ"}));
            }
        }
    }
    let status = worst(&out, "severity");
    let r = json!({"reportVersion":"qeg-baseline-audit-v1","generatedAt":now(),"status":status,"baselinePath":path,"items":out});
    if args[2..].iter().any(|a| a == "--json") {
        print!("{}", document(&r)?)
    } else {
        println!(
            "QEG Baseline Audit\nGenerated at: {}\nOverall: {}\nBaseline: {path}\n",
            s(&r["generatedAt"]),
            status.to_uppercase()
        );
        if out.is_empty() {
            println!("No baseline audit findings.");
        }
        for v in &out {
            let e = &v["entry"];
            println!(
                "- {} {} {}: {}",
                s(&v["severity"]).to_uppercase(),
                e["target"].as_str().unwrap_or("*"),
                s(&e["code"]),
                s(&v["message"])
            );
        }
    }
    Ok(i32::from(status == "fail"))
}

fn norm(target: &str) -> Result<String> {
    if target == "<repo>" || target.starts_with("<repo>/") {
        return Ok(target.into());
    }
    let target = key(&abs(target)?)?;
    let base = key(&std::env::current_dir()?)?;
    Ok(if target == base {
        "<repo>".into()
    } else if let Some(rel) = target.strip_prefix(&(base + "/")) {
        format!("<repo>/{rel}")
    } else {
        target
    })
}
fn diff_items(report: &Value) -> Result<Vec<(String, Value)>> {
    let mut result = vec![];
    for r in report["targets"]
        .as_array()
        .context("Invalid previous report: targets must be an array")?
    {
        let target = norm(r["target"].as_str().context("Invalid report target")?)?;
        for d in r["disqualifications"]
            .as_array()
            .context("Invalid report disqualifications")?
        {
            let mut v = json!({"target":target,"code":d["code"],"message":d["message"],"nodeIds":d["nodeIds"]});
            let o = v.clone();
            v["nodeIds"] = json!(sorted(&d["nodeIds"]));
            result.push((v.to_string(), o));
        }
    }
    result.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(result)
}
pub(super) fn diff(r: &Value, path: &str) -> Result<Value> {
    let prev = diff_items(&read_json(path)?)?;
    let current = diff_items(r)?;
    let pk: BTreeSet<_> = prev.iter().map(|p| p.0.as_str()).collect();
    let ck: BTreeSet<_> = current.iter().map(|p| p.0.as_str()).collect();
    let mut added = vec![];
    let mut unchanged = vec![];
    let mut resolved = vec![];
    let mut unverified = vec![];
    for (key, v) in &current {
        if pk.contains(key.as_str()) {
            unchanged.push(v)
        } else {
            added.push(v)
        }
    }
    let targets = items(&r["targets"])
        .iter()
        .map(|t| Ok((norm(s(&t["target"]))?, t)))
        .collect::<Result<BTreeMap<_, _>>>()?;
    for (key, mut v) in prev {
        if ck.contains(key.as_str()) {
            continue;
        }
        let reason = match targets.get(s(&v["target"])) {
            None => Some("not_evaluated"),
            Some(t)
                if t["status"] == "cli_error"
                    || t["verdict"].is_null()
                    || items(&t["disqualifications"])
                        .iter()
                        .any(|d| d["code"] == "DQ-01") =>
            {
                Some("evaluation_failed")
            }
            _ => None,
        };
        if let Some(reason) = reason {
            v["reason"] = json!(reason);
            unverified.push(v)
        } else {
            resolved.push(v)
        }
    }
    Ok(
        json!({"previousReport":path,"new":added,"resolved":resolved,"unchanged":unchanged,"unverified":unverified}),
    )
}
