use crate::{
    commands,
    common::{document, items, s},
    gate, graph, migration, record, runtime,
    storage::{self, Files},
};
use anyhow::{Context, Result, bail, ensure};
use serde_json::{Value, json};
use std::{
    fs,
    io::{self, BufRead, Write},
    path::Path,
};
const COMMANDS: &str = "build-graph, place-tests, validate, gate, record, outputs, migrate, report, baseline, doctor, explain, schema-check, enum-check, evidence, policy, repro-bundle, check, init, snapshot";
fn code(e: &Value) -> Result<i32> {
    let verdict = s(&e["gateResult"]["verdict"]);
    Ok(e["policy"]["exitCodePolicy"][verdict]
        .as_i64()
        .context("Invalid exitCodePolicy")? as i32)
}
fn pipeline(command: &str, directory: &Path) -> Result<i32> {
    storage::with_lease(directory, |root| {
        let mut files = Files::new();
        let (input, status, summary) = if command == "build-graph" {
            let (manifest, loaded) = graph::load_raw_artifacts(root)?;
            let graph = graph::build_graph(&manifest, &loaded)?;
            let mut input = json!({"metadata":graph["metadata"],"graph":graph,"policy":manifest["policy"],"waivers":manifest.get("waivers").cloned().unwrap_or(json!([]))});
            if let Some(p) = manifest.get("evidencePackage") {
                input["evidencePackage"] = p.clone();
            }
            runtime::assert_output(&graph, "qeg.bundle.schema.json")?;
            files.insert("qeg.bundle.json".into(), document(&graph)?);
            let partial = graph["completeness"]["partial"] == true;
            (
                input,
                if partial { 2 } else { 0 },
                format!(
                    "Graph: {} nodes, {} edges; partial={partial}. Test placement and Gate evaluation remain required.",
                    items(&graph["nodes"]).len(),
                    items(&graph["edges"]).len()
                ),
            )
        } else {
            let mut input = runtime::read_fixture_input(root, false)?;
            let plan = graph::place_tests(&input["graph"])?;
            runtime::assert_output(&plan, "test-placement-plan.schema.json")?;
            files.insert("test-placement-plan.json".into(), document(&plan)?);
            let blocked = items(&plan["placements"])
                .iter()
                .filter(|p| p["disposition"] == "blocked")
                .count();
            let failed = blocked > 0 || input["graph"]["completeness"]["partial"] == true;
            let summary = format!(
                "Plan: {} obligations, {blocked} blocked. This is a plan, not execution evidence.",
                items(&plan["obligations"]).len()
            );
            input["placementPlan"] = plan;
            (input, if failed { 2 } else { 0 }, summary)
        };
        let validation = runtime::validate_gate_input(&input)?;
        ensure!(
            validation["valid"] == true,
            "Generated gate input invalid: {}",
            runtime::messages(&validation["issues"])
        );
        files.insert("gate-input.json".into(), document(&input)?);
        storage::publish(root, &files)?;
        println!("{summary}");
        Ok(status)
    })
}
fn verify_fixture(dir: &Path) -> Result<i32> {
    let expected: Value = serde_json::from_slice(
        &fs::read(dir.join("expected-gate-verdict.json"))
            .context("Error reading expected verdict")?,
    )?;
    let evaluated = runtime::evaluate(dir, false)?;
    let result = commands::compare_expected(&expected, &evaluated);
    println!(
        "Fixture: {}\nDescription: {}\nExpected verdict: {}\nActual verdict: {}",
        s(&expected["fixture"]),
        s(&expected["description"]),
        s(&expected["expectedVerdict"]),
        s(&evaluated["gateResult"]["verdict"])
    );
    let status = |key: &str| if result[key] == true { "PASS" } else { "FAIL" };
    let list = |key: &str| {
        items(&result[key])
            .iter()
            .map(s)
            .collect::<Vec<_>>()
            .join(", ")
    };
    let mode = expected["expectedDisqualificationMode"]
        .as_str()
        .unwrap_or("exact");
    println!("Verdict match: {}", status("verdictMatch"));
    println!("Expected exit code: {}", expected["expectedExitCode"]);
    println!("Actual exit code: {}", code(&evaluated)?);
    println!("Exit code match: {}", status("exitCodeMatch"));
    println!("Contract ref: {}", s(&expected["contractRef"]));
    println!("DQ validation mode: {mode}");
    println!("Expected DQ codes: {}", list("expectedDqCodes"));
    println!("Actual DQ codes: {}", list("actualDqCodes"));
    if mode == "exact" && result["dqMatch"] == false {
        for (key, label) in [
            (
                "unexpectedDqCodes",
                "Unexpected DQ codes (present but not expected)",
            ),
            (
                "missingDqCodes",
                "Missing DQ codes (expected but not present)",
            ),
        ] {
            if !items(&result[key]).is_empty() {
                println!("{label}: {}", list(key));
            }
        }
    }
    println!("DQ codes match: {}", status("dqMatch"));
    println!("Expected blocker IDs: {}", list("expectedBlockerIds"));
    println!("Actual blocker IDs: {}", list("actualBlockerIds"));
    println!("Blockers match: {}", status("blockerMatch"));
    ensure!(result["validationPassed"] == true, "Validation: FAIL");
    println!("Validation: PASS");
    Ok(0)
}
fn files_from(args: &Value) -> Result<Files> {
    let entries: Vec<(String, String)> = serde_json::from_value(args.clone())?;
    Ok(entries.into_iter().collect())
}
pub fn publish_api_with(args: &Value, boundary: impl FnMut(&str) -> Result<()>) -> Result<()> {
    ensure!(args.is_array(), "Invalid API request");
    storage::publish_with(Path::new(s(&args[0])), &files_from(&args[1])?, boundary)
}
fn publish_boundaries() -> Result<i32> {
    let stdin = io::stdin();
    let mut lines = stdin.lock().lines();
    let a: Value = serde_json::from_str(&lines.next().context("Missing request")??)?;
    publish_api_with(&a, |boundary| {
        println!("{}", json!(boundary));
        io::stdout().flush()?;
        // 親プロセスが終了した場合は、プロセス強制終了と同じジャーナルを残す。
        let Some(line) = lines.next() else {
            std::process::exit(1)
        };
        let ack: Value = serde_json::from_str(&line?)?;
        ensure!(ack == true, "{}", s(&ack));
        Ok(())
    })?;
    Ok(0)
}
fn api(method: &str) -> Result<i32> {
    if method == "publishBoundaries" {
        return publish_boundaries();
    }
    let args: Value = serde_json::from_reader(io::stdin().lock())?;
    let value = dispatch_api(method, &args)?;
    let mut out = io::BufWriter::new(io::stdout().lock());
    serde_json::to_writer(&mut out, &value)?;
    out.flush()?;
    Ok(0)
}
pub fn dispatch_api(method: &str, a: &Value) -> Result<Value> {
    ensure!(a.is_array(), "Invalid API request");
    let dir = || Path::new(s(&a[0]));
    let v = match method {
        "constants" => {
            json!({"required":graph::required_artifacts(),"layers":graph::PLACEMENT_LAYERS})
        }
        "evaluateGate" => gate::evaluate_gate(&a[0])?,
        "getExitCode" => a[1]["exitCodePolicy"][s(&a[0])].clone(),
        "isGateEligibleTestEvidence" => json!(a[0]["testExecutionMode"] == "real"),
        "buildGraph" => graph::build_graph(&a[0], &a[1])?,
        "placeTests" => graph::place_tests(&a[0])?,
        "upstreamInputContract" => graph::upstream_input_contract(s(&a[0])),
        "parseProducerArtifact" => graph::parse_producer_artifact(&a[0], s(&a[1]))?,
        "loadRawArtifacts" => {
            let (m, l) = graph::load_raw_artifacts(dir())?;
            json!({"manifest":m,"loaded":l})
        }
        "validateGateInput" => runtime::validate_gate_input(&a[0])?,
        "validateOutput" => runtime::validate_output(&a[0], s(&a[1]))?,
        "verifyEvidenceArtifacts" => runtime::verify_evidence_with_options(
            &a[0],
            Path::new(s(&a[1]["baseDir"])),
            a[1]["strict"].as_bool(),
        )?,
        "readPublishedOutputs" => storage::read_outputs(dir())?,
        "publishFiles" => {
            storage::publish(dir(), &files_from(&a[1])?)?;
            Value::Null
        }
        "recoverOutputs" => json!(storage::recover(dir())?),
        "planConsumerMigration" | "applyConsumerMigration" => migration::migrate(
            dir(),
            a.get(1).filter(|v| !v.is_null()),
            method == "applyConsumerMigration",
        )?,
        "createRecordArtifacts" => {
            let (r, f) = record::artifacts(&a[0])?;
            json!({"record":r,"files":f})
        }
        "evaluateFixture" => runtime::evaluate(dir(), a[1]["quiet"] == true)?,
        "writeOutputRecord" => {
            record::write(&a[0])?;
            Value::Null
        }
        "verifyOutputManifest" => commands::verify_output_manifest(dir())?,
        "normalizeStatus" | "shellStatus" | "statusAliases" => commands::status_for_api(method, a)?,
        "timestampNanos" => json!(crate::common::timestamp_nanos(&a[0]).map(|t| t.to_string())),
        "validateWaiver" => gate::validate_waiver(&a[0], &a[1], &a[2]),
        _ => bail!("Unknown API operation: {method}"),
    };
    Ok(v)
}
pub fn run(args: Vec<String>) -> Result<i32> {
    let Some((command, args)) = args.split_first() else {
        eprintln!("Usage: qeg <command> <fixture-dir>\nCommands: {COMMANDS}");
        return Ok(1);
    };
    let target = || -> Result<&Path> {
        Ok(Path::new(args.first().with_context(|| {
            format!("Usage: qeg {command} <fixture-dir>")
        })?))
    };
    match command.as_str() {
        "--help" | "-h" => {
            println!(
                "Usage: qeg <command> [options] <fixture-dir-or-parent>\nCommands: {COMMANDS}"
            );
            Ok(0)
        }
        "--version" | "-v" => {
            println!("{}", env!("CARGO_PKG_VERSION"));
            Ok(0)
        }
        "--api" => api(args.first().context("Missing API operation")?),
        "__action-summary" => crate::action::run(args),
        "build-graph" | "place-tests" => {
            ensure!(args.len() == 1, "Usage: qeg {command} <target-dir>");
            pipeline(command, target()?)
        }
        "gate" => {
            let e = runtime::evaluate(target()?, false)?;
            runtime::assert_output(&e["gateResult"], "gate-verdict.schema.json")?;
            print!("{}", document(&e["gateResult"])?);
            code(&e)
        }
        "validate" => verify_fixture(target()?),
        "record" => storage::with_lease(target()?, |root| {
            let e = runtime::evaluate(root, false)?;
            record::write(&e)?;
            println!(
                "Own-output validation: PASS (all generated JSON artifacts passed their schemas)\nRecord written to: {}",
                root.join("quality-evidence-record.json").display()
            );
            code(&e)
        }),
        "outputs" => {
            ensure!(
                args.len() == 2 && matches!(args[0].as_str(), "read" | "recover"),
                "Usage: qeg outputs <read|recover> <target-dir>"
            );
            let p = Path::new(&args[1]);
            if args[0] == "recover" {
                println!("Recovered generation: {}", storage::recover(p)?)
            } else {
                print!("{}", document(&storage::read_outputs(p)?)?)
            }
            Ok(0)
        }
        "migrate" => {
            let root = target()?;
            let mut flags = args[1..].iter();
            let (mut config, mut apply, mut dry) = (None, false, false);
            while let Some(flag) = flags.next() {
                match flag.as_str() {
                    "--apply" => apply = true,
                    "--dry-run" => dry = true,
                    "--config" => {
                        let path = flags
                            .next()
                            .context("Usage: qeg migrate <target-dir> --config <config.json>")?;
                        config = Some(serde_json::from_slice(&fs::read(path)?)?)
                    }
                    _ => bail!(
                        "Usage: qeg migrate <target-dir> [--config <config.json>] [--dry-run|--apply]"
                    ),
                }
            }
            ensure!(
                !apply || (!dry && config.is_some()),
                "Usage: qeg migrate <target-dir> --config <config.json> --apply"
            );
            let report = migration::migrate(root, config.as_ref(), apply)?;
            print!("{}", document(&report)?);
            Ok(
                if matches!(s(&report["status"]), "blocked" | "needs_configuration") {
                    2
                } else {
                    0
                },
            )
        }
        _ => commands::run(command, args),
    }
}
