use super::*;
use std::process::Command;
fn git(args: &[&str]) -> Result<String> {
    let o = Command::new("git").args(args).output()?;
    ensure!(
        o.status.success(),
        "git {}: {}",
        args.join(" "),
        String::from_utf8_lossy(&o.stderr).trim()
    );
    Ok(String::from_utf8(o.stdout)?)
}
fn path_key(base: &Path, name: &str) -> Result<String> {
    key(&clean(&base.join(name.replace('\\', "/"))))
}
fn changed() -> Result<(Vec<String>, PathBuf, &'static str)> {
    if let Some(v) = std::env::var_os("QEG_CHANGED_FILES") {
        let base = std::env::current_dir()?;
        return Ok((
            v.to_string_lossy()
                .split([',', '\r', '\n'])
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|p| path_key(&base, p))
                .collect::<Result<_>>()?,
            base,
            "env",
        ));
    }
    let root = PathBuf::from(
        git(&["rev-parse", "--show-toplevel"])
            .context("git repository detection failed")?
            .trim_end_matches(['\r', '\n']),
    );
    let mut errors = vec![];
    for (strategy, rev) in [
        ("origin_main", "origin/main...HEAD"),
        ("head_parent", "HEAD~1...HEAD"),
    ] {
        match git(&[
            "diff",
            "--name-only",
            "-z",
            "--no-relative",
            "--no-renames",
            "--diff-filter=ACDMRTUXB",
            rev,
        ]) {
            Ok(raw) => {
                return Ok((
                    raw.split('\0')
                        .filter(|p| !p.is_empty())
                        .map(|p| path_key(&root, p))
                        .collect::<Result<_>>()?,
                    root,
                    strategy,
                ));
            }
            Err(e) => errors.push(e.to_string()),
        }
    }
    let raw = git(&["status", "--porcelain=v1", "-z", "--untracked-files=all"])?;
    let mut records = raw.split('\0').filter(|p| !p.is_empty());
    let mut files = vec![];
    while let Some(record) = records.next() {
        if let Some(name) = record.get(3..) {
            files.push(path_key(&root, name)?);
        }
        if record.get(..2).is_some_and(|s| s.contains(['C', 'R']))
            && let Some(name) = records.next()
        {
            files.push(path_key(&root, name)?);
        }
    }
    ensure!(
        !files.is_empty(),
        "all changed-file detection strategies failed: {} | worktree: clean worktree cannot replace unavailable history",
        errors.join(" | ")
    );
    Ok((files, root, "worktree"))
}
fn mentions(target: &Path, files: &[String], base: &Path) -> Result<bool> {
    let path = key(target)?;
    if files
        .iter()
        .any(|f| f == &path || f.starts_with(&(path.clone() + "/")))
    {
        return Ok(true);
    }
    let input = crate::runtime::read_fixture_input(target, true)?;
    let paths = items(&input["metadata"]["inputArtifacts"]).iter().chain(
        items(&input["graph"]["nodes"])
            .iter()
            .filter(|n| n["kind"] == "changed_code"),
    );
    for name in paths.filter_map(|node| node["path"].as_str()) {
        if files.contains(&path_key(target, name)?) || files.contains(&path_key(base, name)?) {
            return Ok(true);
        }
    }
    Ok(false)
}
pub(super) fn select(targets: &[PathBuf], changed_only: bool) -> Result<(Vec<PathBuf>, Value)> {
    if !changed_only {
        return Ok((
            targets.to_vec(),
            json!({"mode":"all","status":"selected","strategy":"all","changedFileCount":0,"selectedTargetCount":targets.len()}),
        ));
    }
    match changed() {
        Err(e) => Ok((
            vec![],
            json!({"mode":"changed_only","status":"detection_failed","strategy":"worktree","changedFileCount":0,"selectedTargetCount":0,"error":format!("{e:#}")}),
        )),
        Ok((files, base, strategy)) => {
            let selected: Vec<_> = targets
                .iter()
                .filter(|p| mentions(p, &files, &base).unwrap_or(true))
                .cloned()
                .collect();
            let sel = json!({"mode":"changed_only","status":if selected.is_empty(){"no_relevant_changes"}else{"selected"},"strategy":strategy,"changedFileCount":files.len(),"selectedTargetCount":selected.len()});
            Ok((selected, sel))
        }
    }
}
