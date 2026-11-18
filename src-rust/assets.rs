use anyhow::Result;
use std::{fs, path::Path};
include!(concat!(env!("OUT_DIR"), "/assets.rs"));

pub fn install_action(runtime: &Path, force: bool) -> Result<()> {
    for &(name, bytes) in ASSETS {
        let destination = runtime.join(name);
        if !force && destination.try_exists()? {
            continue;
        }
        fs::create_dir_all(destination.parent().unwrap())?;
        fs::write(destination, bytes)?;
    }
    // 同一環境では初期化後すぐ実行でき、別OSのrunnerは同梱ソースをビルドできる。
    let executable = std::env::current_exe()?;
    if executable.file_stem().is_some_and(|s| s == "qeg") {
        let os = if cfg!(windows) {
            "win32"
        } else if cfg!(target_os = "macos") {
            "darwin"
        } else {
            std::env::consts::OS
        };
        let arch = match std::env::consts::ARCH {
            "x86_64" => "x64",
            "aarch64" => "arm64",
            "x86" => "ia32",
            other => other,
        };
        let destination = runtime
            .join("native")
            .join(format!("{os}-{arch}"))
            .join(executable.file_name().unwrap());
        if force || !destination.try_exists()? {
            fs::create_dir_all(destination.parent().unwrap())?;
            fs::copy(&executable, destination)?;
        }
    }
    Ok(())
}
