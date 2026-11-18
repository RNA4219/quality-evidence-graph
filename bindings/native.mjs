import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const executable = process.platform === "win32" ? "qeg.exe" : "qeg";
export const packagedBinary = join(root, "native", process.platform + "-" + process.arch, executable);
export const nativeEnv = () => ({ ...process.env, QEG_DISTRIBUTION_ROOT: root });

export function buildNative() {
  const target = join(root, "target");
  const build = spawnSync("cargo", ["build", "--locked", "--release", "--manifest-path", join(root, "Cargo.toml"), "--target-dir", target, "--bin", "qeg"], { stdio: ["ignore", 2, 2], cwd: root });
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error("Rust QEG build failed (exit " + build.status + ")");
  return join(target, "release", executable);
}

let resolved;
export function nativeBinary() {
  if (!resolved) resolved = existsSync(packagedBinary) ? packagedBinary : buildNative();
  return resolved;
}
