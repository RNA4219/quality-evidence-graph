import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const executable = process.platform === "win32" ? "qeg.exe" : "qeg";
export const packagedBinary = join(root, "native", process.platform + "-" + process.arch, executable);
export const packagedAddon = join(dirname(packagedBinary), "qeg.node");
export const nativeEnv = () => ({ ...process.env, QEG_DISTRIBUTION_ROOT: root });

function buildCargo(manifest, output, args) {
  const target = join(root, "target");
  const build = spawnSync("cargo", ["build", "--locked", "--release", "--manifest-path", join(root, manifest), "--target-dir", target, ...args], { stdio: ["ignore", 2, 2], cwd: root });
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error("Rust QEG build failed (exit " + build.status + ")");
  return join(target, "release", output);
}

export function buildNative() {
  return buildCargo("Cargo.toml", executable, ["--bin", "qeg"]);
}

export function buildAddon() {
  const library = process.platform === "win32" ? "qeg_node.dll"
    : process.platform === "darwin" ? "libqeg_node.dylib" : "libqeg_node.so";
  return buildCargo("npm-native/Cargo.toml", library, ["--lib"]);
}

export function loadAddon(path) {
  const binding = { exports: {} };
  process.dlopen(binding, path);
  return binding.exports;
}

let resolved;
export function nativeBinary() {
  if (!resolved) resolved = existsSync(packagedBinary) ? packagedBinary : buildNative();
  return resolved;
}
