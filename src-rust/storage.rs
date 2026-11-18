use crate::common::{digest, s};
use anyhow::{Context, Result, anyhow, ensure};
use indexmap::IndexMap;
use serde_json::{Value, json};
use std::{
    cell::RefCell,
    collections::HashSet,
    fs::{self, File},
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
};
use uuid::Uuid;

pub type Files = IndexMap<String, String>;
const GENERATIONS: &str = ".qeg-generations";
const POINTER: &str = ".qeg-current.json";
const PENDING: &str = ".qeg-pending.json";

pub fn absolute(path: &Path) -> Result<PathBuf> {
    let path = fs::canonicalize(path)?;
    #[cfg(windows)]
    {
        let text = path.to_string_lossy();
        if let Some(s) = text.strip_prefix(r"\\?\UNC\") {
            return Ok(PathBuf::from(format!(r"\\{s}")));
        }
        if let Some(s) = text.strip_prefix(r"\\?\") {
            return Ok(PathBuf::from(s));
        }
    }
    Ok(path)
}
#[cfg(windows)]
fn acquire(hash: &str) -> std::io::Result<std::os::windows::io::OwnedHandle> {
    use std::os::windows::io::{FromRawHandle, OwnedHandle};
    use windows_sys::Win32::{
        Foundation::INVALID_HANDLE_VALUE,
        Storage::FileSystem::{FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_DUPLEX},
        System::Pipes::{CreateNamedPipeW, PIPE_TYPE_BYTE},
    };
    let name: Vec<_> = format!(r"\\.\pipe\qeg-output-{hash}")
        .encode_utf16()
        .chain(Some(0))
        .collect();
    // name is NUL-terminated and valid for the call. OwnedHandle closes the exclusive instance.
    let handle = unsafe {
        CreateNamedPipeW(
            name.as_ptr(),
            PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
            PIPE_TYPE_BYTE,
            1,
            1024,
            1024,
            0,
            std::ptr::null(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(std::io::Error::last_os_error());
    }
    Ok(unsafe { OwnedHandle::from_raw_handle(handle) })
}
#[cfg(target_os = "linux")]
fn acquire(hash: &str) -> std::io::Result<std::os::unix::net::UnixListener> {
    use std::os::{
        linux::net::SocketAddrExt,
        unix::net::{SocketAddr, UnixListener},
    };
    UnixListener::bind_addr(&SocketAddr::from_abstract_name(format!(
        "qeg-output-{hash}"
    ))?)
}
#[cfg(not(any(windows, target_os = "linux")))]
fn acquire(hash: &str) -> std::io::Result<std::net::TcpListener> {
    let port = 20000 + (u32::from_str_radix(&hash[..8], 16).unwrap() % 40000) as u16;
    std::net::TcpListener::bind(("127.0.0.1", port))
}
thread_local! {static HELD:RefCell<HashSet<String>>=RefCell::new(HashSet::new());}
struct Held(String);
impl Drop for Held {
    fn drop(&mut self) {
        HELD.with_borrow_mut(|h| h.remove(&self.0));
    }
}
pub fn with_lease<T>(directory: &Path, f: impl FnOnce(&Path) -> Result<T>) -> Result<T> {
    let root = absolute(directory)?;
    let mut key = root.to_string_lossy().into_owned();
    if cfg!(windows) {
        key = key.to_lowercase()
    }
    if HELD.with_borrow(|h| h.contains(&key)) {
        return f(&root);
    }
    let hash = digest(key.as_bytes());
    let _lock = acquire(&hash[7..])
        .with_context(|| format!("Output busy or lease unavailable ({})", root.display()))?;
    HELD.with_borrow_mut(|h| h.insert(key.clone()));
    let _held = Held(key);
    f(&root)
}
pub fn optional(path: &Path) -> Result<Option<String>> {
    match fs::symlink_metadata(path) {
        Ok(m) => {
            ensure!(
                m.is_file(),
                "Output is not a regular file: {}",
                path.display()
            );
            Ok(Some(fs::read_to_string(path)?))
        }
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}
fn regular(path: &Path) -> Result<String> {
    optional(path)?.with_context(|| format!("Output file missing: {}", path.display()))
}
fn directory(path: &Path) -> Result<()> {
    ensure!(
        fs::symlink_metadata(path)?.is_dir(),
        "Invalid generation directory: {}",
        path.display()
    );
    Ok(())
}
fn sync_new(path: &Path, bytes: &str) -> Result<()> {
    let mut f = File::create_new(path)?;
    f.write_all(bytes.as_bytes())?;
    f.sync_all()?;
    Ok(())
}
fn replace(root: &Path, name: &str, content: &str) -> Result<()> {
    let target = root.join(name);
    match fs::symlink_metadata(&target) {
        Ok(m) => ensure!(
            m.is_file(),
            "Output is not a regular file: {}",
            target.display()
        ),
        Err(e) if e.kind() == ErrorKind::NotFound => (),
        Err(e) => return Err(e.into()),
    }
    let mut f = tempfile::Builder::new()
        .prefix(".qeg-replace-")
        .tempfile_in(root)?;
    f.write_all(content.as_bytes())?;
    f.as_file().sync_all()?;
    crate::probe::event("before-rename", &target)?;
    f.persist(&target)?;
    crate::probe::event("after-rename", &target)?;
    Ok(())
}
fn filename(n: &str) -> bool {
    !n.is_empty()
        && n != "generation.json"
        && n.as_bytes()[0].is_ascii_alphanumeric()
        && n.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}
fn pointer(p: &Value, version: &str) -> Result<()> {
    let id = s(&p["id"]);
    let hash = s(&p["hash"]);
    ensure!(
        p["version"] == version
            && id.len() == 36
            && id
                .bytes()
                .all(|c| c == b'-' || c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
            && hash.len() == 71
            && hash.starts_with("sha256:")
            && hash[7..]
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        "Invalid output generation pointer"
    );
    Ok(())
}
fn load_generation(root: &Path, p: &Value) -> Result<(Files, Option<Value>)> {
    pointer(p, "qeg-pointer/v1")?;
    let gens = root.join(GENERATIONS);
    directory(&gens)?;
    let stage = gens.join(s(&p["id"]));
    directory(&stage)?;
    let bytes = regular(&stage.join("generation.json"))?;
    ensure!(
        p["hash"] == digest(bytes.as_bytes()),
        "Generation manifest hash mismatch"
    );
    let manifest: Value = serde_json::from_str(&bytes)?;
    let entries = manifest["files"]
        .as_array()
        .context("Invalid generation manifest")?;
    ensure!(
        manifest["version"] == "qeg-generation/v1"
            && manifest["id"] == p["id"]
            && !entries.is_empty(),
        "Invalid generation manifest"
    );
    let mut files = Files::new();
    for item in entries {
        let name = s(&item["name"]);
        ensure!(
            filename(name) && !files.contains_key(name),
            "Invalid or duplicate generation filename"
        );
        let bytes = regular(&stage.join(name))?;
        ensure!(
            item["hash"] == digest(bytes.as_bytes()),
            "Generation hash mismatch: {name}"
        );
        files.insert(name.into(), bytes);
    }
    Ok((files, manifest.get("previous").cloned()))
}
pub fn committed_file(root: &Path, name: &str, bytes: &str) -> Result<bool> {
    let mut p = optional(&root.join(POINTER))?
        .map(|s| serde_json::from_str::<Value>(&s))
        .transpose()?;
    let mut seen = HashSet::new();
    while let Some(current) = p {
        ensure!(
            seen.insert(current["id"].clone().to_string()),
            "Cyclic output generation history"
        );
        let (files, previous) = load_generation(root, &current)?;
        if files.get(name).is_some_and(|v| v == bytes) {
            return Ok(true);
        }
        p = previous;
    }
    Ok(false)
}
pub struct Pending {
    pub committed: bool,
    pub before: IndexMap<String, Option<String>>,
}
pub fn pending(root: &Path) -> Result<Option<Pending>> {
    let Some(bytes) = optional(&root.join(PENDING))? else {
        return Ok(None);
    };
    let p: Value = serde_json::from_str(&bytes)?;
    pointer(&p, "qeg-pending/v1")?;
    let gens = root.join(GENERATIONS);
    let stage = gens.join(s(&p["id"]));
    let rollback = stage.join(".qeg-rollback");
    for dir in [&gens, &stage, &rollback] {
        directory(dir)?
    }
    let data = regular(&stage.join(".qeg-transaction.json"))?;
    ensure!(
        p["hash"] == digest(data.as_bytes()),
        "Publication journal hash mismatch"
    );
    let journal: Value = serde_json::from_str(&data)?;
    ensure!(
        journal["version"] == "qeg-transaction/v1"
            && journal["id"] == p["id"]
            && journal["next"].is_string()
            && journal.get("previous").is_none_or(Value::is_string),
        "Invalid publication journal"
    );
    let next: Value = serde_json::from_str(s(&journal["next"]))?;
    pointer(&next, "qeg-pointer/v1")?;
    ensure!(next["id"] == p["id"], "Invalid publication commit pointer");
    let current = optional(&root.join(POINTER))?;
    let committed = current.as_deref() == journal["next"].as_str();
    ensure!(
        committed || current.as_deref() == journal["previous"].as_str(),
        "Publication pointer differs from both journal generations"
    );
    let entries = journal["files"]
        .as_array()
        .filter(|f| !f.is_empty())
        .context("Invalid publication journal")?;
    let mut before = IndexMap::new();
    for entry in entries {
        let n = s(&entry["name"]);
        ensure!(
            filename(n) && !before.contains_key(n),
            "Invalid publication rollback filename"
        );
        let bytes = if let Some(h) = entry.get("hash") {
            let data = regular(&rollback.join(n))?;
            ensure!(
                *h == digest(data.as_bytes()),
                "Publication rollback hash mismatch: {n}"
            );
            Some(data)
        } else {
            None
        };
        before.insert(n.into(), bytes);
    }
    Ok(Some(Pending { committed, before }))
}
pub fn recover_pending(root: &Path) -> Result<()> {
    if let Some(p) = pending(root)? {
        if !p.committed {
            for (name, original) in p.before {
                if let Some(data) = original {
                    replace(root, &name, &data)?
                } else if optional(&root.join(&name))?.is_some() {
                    fs::remove_file(root.join(name))?
                }
            }
        }
        fs::remove_file(root.join(PENDING))?;
    }
    Ok(())
}
fn complete(root: &Path) -> Result<()> {
    ensure!(
        pending(root)?.is_none_or(|p| p.committed),
        "Interrupted output publication; run outputs recover before reading or writing this input"
    );
    Ok(())
}
pub fn read_input(root: &Path) -> Result<String> {
    with_lease(root, |root| {
        complete(root)?;
        let path = root.join("gate-input.json");
        let input = regular(&path)?;
        crate::probe::event("after-read", &path)?;
        Ok(input)
    })
}
fn matching_input(root: &Path, files: &Files) -> Result<()> {
    if let Some(input) = files.get("gate-input.json") {
        ensure!(
            optional(&root.join("gate-input.json"))?.as_ref() == Some(input),
            "Output alias hash mismatch: gate-input.json; native input preserved. Review the input and rerun the producer command to create a matching generation"
        )
    }
    Ok(())
}
pub fn read_outputs(root: &Path) -> Result<Value> {
    with_lease(root, |root| {
        complete(root)?;
        let p: Value = serde_json::from_str(
            &optional(&root.join(POINTER))?
                .context("No completed output generation; rerun the original producer command")?,
        )?;
        let (files, _) = load_generation(root, &p)?;
        matching_input(root, &files)?;
        for (name, bytes) in &files {
            ensure!(
                regular(&root.join(name))? == *bytes,
                "Output alias hash mismatch: {name}; run outputs recover"
            )
        }
        Ok(json!({"generation":p["id"],"files":files}))
    })
}
pub fn recover(root: &Path) -> Result<String> {
    with_lease(root, |root| {
        let current = optional(&root.join(POINTER))?
            .map(|v| serde_json::from_str::<Value>(&v))
            .transpose()?;
        let files = current
            .as_ref()
            .map(|p| load_generation(root, p))
            .transpose()?;
        recover_pending(root)?;
        let (files, _) = files
            .context("No completed generation to recover; rerun the original producer command")?;
        for (name, bytes) in &files {
            if name != "gate-input.json" {
                replace(root, name, bytes)?
            }
        }
        matching_input(root, &files)?;
        Ok(s(&current.unwrap()["id"]).into())
    })
}
pub fn publish(root: &Path, files: &Files) -> Result<()> {
    publish_with(root, files, |_| Ok(()))
}
pub fn publish_with(
    root: &Path,
    files: &Files,
    mut boundary: impl FnMut(&str) -> Result<()>,
) -> Result<()> {
    ensure!(
        !files.is_empty() && files.keys().all(|n| filename(n)),
        "Invalid output filename or empty publication"
    );
    fs::create_dir_all(root)?;
    with_lease(root, |root| {
        complete(root)?;
        let previous = optional(&root.join(POINTER))?;
        let previous_ref = previous
            .as_ref()
            .map(|p| serde_json::from_str::<Value>(p))
            .transpose()?;
        if let Some(p) = &previous_ref {
            load_generation(root, p)?;
        }
        recover_pending(root)?;
        let before: IndexMap<_, _> = files
            .keys()
            .map(|name| Ok((name, optional(&root.join(name))?)))
            .collect::<Result<_>>()?;
        let gens = root.join(GENERATIONS);
        fs::create_dir_all(&gens)?;
        directory(&gens)?;
        let id = Uuid::new_v4().to_string();
        let stage = gens.join(&id);
        fs::create_dir(&stage)?;
        let result = (|| -> Result<()> {
            boundary("staged-directory")?;
            let mut entries = Vec::new();
            for (name, data) in files {
                sync_new(&stage.join(name), data)?;
                entries.push(json!({"name":name,"hash":digest(data.as_bytes())}));
                boundary(&format!("staged:{name}"))?;
            }
            let mut manifest = json!({"version":"qeg-generation/v1","id":id});
            if let Some(p) = previous_ref {
                manifest["previous"] = p;
            }
            manifest["files"] = json!(entries);
            let data = manifest.to_string() + "\n";
            sync_new(&stage.join("generation.json"), &data)?;
            boundary("sealed")?;
            let next = json!({"version":"qeg-pointer/v1","id":id,"hash":digest(data.as_bytes())})
                .to_string()
                + "\n";
            let rollback = stage.join(".qeg-rollback");
            fs::create_dir(&rollback)?;
            let mut entries = Vec::new();
            for (name, data) in before {
                let mut e = json!({"name":name});
                if let Some(ref bytes) = data {
                    sync_new(&rollback.join(name), bytes)?;
                    e["hash"] = json!(digest(bytes.as_bytes()));
                }
                entries.push(e);
            }
            let mut journal =
                json!({"version":"qeg-transaction/v1","id":id,"next":next,"files":entries});
            if let Some(p) = previous {
                journal["previous"] = json!(p);
            }
            let bytes = journal.to_string() + "\n";
            sync_new(&stage.join(".qeg-transaction.json"), &bytes)?;
            replace(
                root,
                PENDING,
                &(json!({"version":"qeg-pending/v1","id":id,"hash":digest(bytes.as_bytes())})
                    .to_string()
                    + "\n"),
            )?;
            boundary("prepared")?;
            for (name, data) in files {
                replace(root, name, data)?;
                boundary(&format!("alias:{name}"))?;
            }
            replace(root, POINTER, &next)?;
            boundary("pointer-committed")?;
            recover_pending(root)?;
            boundary("committed")?;
            Ok(())
        })();
        if let Err(e) = result {
            recover_pending(root).context("Publication recovery failed")?;
            return Err(anyhow!(
                "Publishing outputs failed: {e}; recovery files: {}",
                stage.display()
            ));
        }
        Ok(())
    })
}
