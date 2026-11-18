use std::{
    env, fs,
    path::{Path, PathBuf},
};
fn collect(root: &Path, directory: &Path, suffix: &str, paths: &mut Vec<String>) {
    for entry in fs::read_dir(directory).unwrap() {
        let entry = entry.unwrap();
        let path = entry.path();
        let kind = entry.file_type().unwrap();
        if kind.is_dir() {
            collect(root, &path, suffix, paths)
        } else if kind.is_file() && path.to_string_lossy().ends_with(suffix) {
            paths.push(
                path.strip_prefix(root)
                    .unwrap()
                    .to_str()
                    .unwrap()
                    .replace('\\', "/"),
            );
        }
    }
}
fn main() {
    let root = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let mut files: Vec<String> = [
        "Cargo.toml",
        "Cargo.lock",
        "build.rs",
        "LICENSE",
        "README.md",
        "bindings/native.mjs",
        "src/adapters/producer-schemas.json",
        "src/cli/enum-contracts.json",
        "src-rust/commands/dq.json",
        "qeg-report-action/action.yml",
        "qeg-report-action/report.sh",
        "qeg-report-action/dist/cli.mjs",
        "qeg-report-action/runtime-metadata.json",
        "qeg-report-action/THIRD_PARTY_NOTICES.md",
    ]
    .into_iter()
    .map(String::from)
    .collect();
    for (dir, suffix) in [
        ("src-rust", ".rs"),
        ("schemas", ".schema.json"),
        ("qeg-report-action/licenses", ".txt"),
    ] {
        println!("cargo:rerun-if-changed={dir}");
        collect(&root, &root.join(dir), suffix, &mut files);
    }
    files.sort();
    let mut source = String::from("pub static ASSETS: &[(&str, &[u8])] = &[\n");
    for name in files {
        println!("cargo:rerun-if-changed={name}");
        source.push_str(&format!(
            "({name:?},include_bytes!(concat!(env!(\"CARGO_MANIFEST_DIR\"),\"/\",{name:?}))),\n"
        ));
    }
    source.push_str("];\n");
    fs::write(
        PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("assets.rs"),
        source,
    )
    .unwrap();
}
