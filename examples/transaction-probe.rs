//! ネイティブI/Oの境界で停止する受入テスト用の子プロセス。
use anyhow::{Context, Result, bail, ensure};
use quality_evidence_graph::{cli, migration, probe, runtime, storage};
use serde_json::{Value, json};
use std::{
    cell::Cell,
    fs,
    io::{self, Read, Write},
    path::{Path, PathBuf},
};

fn pause(label: &str) -> io::Result<()> {
    println!("boundary:{label}");
    io::stdout().flush()?;
    let mut response = String::new();
    io::stdin().read_line(&mut response)?;
    if response.trim() != "resume" {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            "probe lost its controller",
        ));
    }
    Ok(())
}
fn run() -> Result<i32> {
    let mut args = std::env::args().skip(1);
    let mode = args.next().context("probe mode is required")?;
    let directory = PathBuf::from(args.next().context("target directory is required")?);
    match mode.as_str() {
        "publication" | "rename-failure" => {
            let boundary = args.next().unwrap_or_default();
            let payload = json!({"value":"new"}).to_string() + "\n";
            let files = ["a.json", "b.json", "output-manifest.json"]
                .into_iter()
                .map(|name| (name.to_owned(), payload.clone()))
                .collect();
            let deny = mode == "rename-failure";
            let fired = Cell::new(false);
            probe::observe(
                move |operation, path| {
                    if deny
                        && operation == "before-rename"
                        && path.ends_with("b.json")
                        && !fired.replace(true)
                    {
                        return Err(io::Error::new(
                            io::ErrorKind::PermissionDenied,
                            "rename denied",
                        ));
                    }
                    Ok(())
                },
                || {
                    storage::publish_with(&directory, &files, |event| {
                        if event == boundary {
                            pause(event)?
                        }
                        Ok(())
                    })
                },
            )?;
            Ok(0)
        }
        "evidence-failure" => {
            let operation = args.next().context("expected stat or read operation")?;
            let target = PathBuf::from(args.next().context("expected artifact path")?);
            let mut request = String::new();
            io::stdin().read_to_string(&mut request)?;
            let request: Value = serde_json::from_str(&request)?;
            let result = probe::observe(
                move |label, path| {
                    if operation == label && path == target {
                        return Err(io::Error::new(
                            io::ErrorKind::PermissionDenied,
                            "permission denied (fixture)",
                        ));
                    }
                    Ok(())
                },
                || {
                    runtime::verify_evidence_with_options(
                        &request["input"],
                        &directory,
                        request["strict"].as_bool(),
                    )
                },
            )?;
            println!("{result}");
            Ok(0)
        }
        _ => {
            let (command, operation, file) = match mode.as_str() {
                "place-after-read" => ("place-tests", "after-read", "gate-input.json"),
                "record-after-read" => ("record", "after-read", "gate-input.json"),
                "migration-before-input" => ("migrate", "before-rename", "gate-input.json"),
                "migration-after-input" => ("migrate", "after-rename", "gate-input.json"),
                "migration-after-pointer" => ("migrate", "after-rename", ".qeg-current.json"),
                "recover-after-input" => ("recover", "after-rename", "gate-input.json"),
                _ => bail!("Unknown probe mode {mode}"),
            };
            let fired = Cell::new(false);
            probe::observe(
                move |label, path| {
                    if label == operation
                        && path.file_name() == Path::new(file).file_name()
                        && !fired.replace(true)
                    {
                        pause(&mode)?
                    }
                    Ok(())
                },
                || {
                    match command {
                        "migrate" => {
                            let config: Value = serde_json::from_slice(&fs::read(
                                args.next().context("migration config path is required")?,
                            )?)?;
                            migration::migrate(&directory, Some(&config), true)?;
                        }
                        "recover" => {
                            storage::recover(&directory)?;
                        }
                        _ => {
                            let code = cli::run(vec![
                                command.to_owned(),
                                directory.to_string_lossy().into_owned(),
                            ])?;
                            ensure!(
                                code == 0 || code == 2,
                                "Command failed with exit code {code}"
                            );
                            return Ok(code);
                        }
                    }
                    Ok(0)
                },
            )
        }
    }
}
fn main() -> std::process::ExitCode {
    match run() {
        Ok(code) => std::process::ExitCode::from(code as u8),
        Err(e) => {
            eprintln!("{e:#}");
            std::process::ExitCode::FAILURE
        }
    }
}
