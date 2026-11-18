import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const portable = path => path.replaceAll("\\", "/");

function run(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

// Cargo's graph also contains development edges. Follow only the edges used by
// a native build, retaining build scripts and procedural macro dependencies.
function nativePackages(metadata) {
  const nodes = new Map(metadata.resolve.nodes.map(node => [node.id, node]));
  const visited = new Set();
  const pending = [metadata.resolve.root];
  while (pending.length) {
    const id = pending.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    for (const dependency of nodes.get(id).deps) {
      if (dependency.dep_kinds.some(edge => edge.kind !== "dev")) pending.push(dependency.pkg);
    }
  }
  return metadata.packages.filter(pkg => pkg.id !== metadata.resolve.root && visited.has(pkg.id))
    .sort((a, b) => compare(a.name, b.name) || compare(a.version, b.version));
}

function crateNotices(pkg) {
  const dir = dirname(pkg.manifest_path);
  const paths = new Set();
  if (pkg.license_file) paths.add(resolve(dir, pkg.license_file));
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (![".git", ".github", "target"].includes(entry.name)) visit(path);
      } else if (entry.isFile() && /(?:^|[-_. ])(?:licen[cs]es?|copying|copyright|notices?|unlicense)(?:$|[-_. ])/i.test(entry.name)
        && !/\.(rs|c|h|js|json|toml|ya?ml|sh|py)$/i.test(entry.name)) {
        paths.add(path);
      }
    }
  }
  visit(dir);
  return [...paths].sort(compare).map(path => ({
    file: portable(relative(dir, path)),
    text: readFileSync(path, "utf8"),
  }));
}

function revision(pkg) {
  const path = join(dirname(pkg.manifest_path), ".cargo_vcs_info.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).git?.sha1 : undefined;
}

function inheritedNotices(pkg, packages, byId) {
  // These crate archives omit the license that the project ships at workspace level.
  if (["jsonschema-value", "jsonschema-regex"].includes(pkg.name)) {
    const sha = revision(pkg);
    const sibling = packages.find(p => p.name === "jsonschema" && p.repository === pkg.repository
      && p.version === pkg.version && p.license === pkg.license && sha && revision(p) === sha);
    const notice = sibling && byId.get(sibling.id).find(item => item.file === "LICENSE");
    if (notice) return [{ ...notice, source: sibling.name + "@" + sibling.version + "/LICENSE",
      revision: sha }];
  }
  const simdRevision = "d74c030d9dc4f3cae02146d1f497ff62726ef09a";
  if (["uuid-simd", "vsimd"].includes(pkg.name) && pkg.repository === "https://github.com/Nugine/simd"
      && revision(pkg) === simdRevision && pkg.license === "MIT") {
    return [{ file: "LICENSE", source: pkg.repository + "/blob/" + simdRevision + "/LICENSE",
      revision: simdRevision, text: readFileSync(join(root, "tools/licenses/nugine-simd-LICENSE.txt"), "utf8") }];
  }
  throw new Error("License text unavailable for " + pkg.name + "@" + pkg.version);
}

export function writeNativeNotices(executable) {
  const target = /^host:\s*(\S+)$/m.exec(run(process.env.RUSTC || "rustc", ["-vV"]))?.[1];
  if (!target) throw new Error("Could not determine the native Rust host target");
  const metadata = JSON.parse(run("cargo", ["metadata", "--locked", "--offline", "--format-version", "1",
    "--manifest-path", join(root, "Cargo.toml"), "--filter-platform", target]));
  const packages = nativePackages(metadata);
  const byId = new Map(packages.map(pkg => [pkg.id, crateNotices(pkg)]));
  const texts = {};
  const crates = packages.map(pkg => {
    const local = byId.get(pkg.id);
    const notices = (local.length ? local : inheritedNotices(pkg, packages, byId)).map(({text, ...origin}) => {
      if (!text.trim()) throw new Error("Empty notice: " + pkg.name + "/" + origin.file);
      const hash = createHash("sha256").update(text).digest("hex");
      texts[hash] = text;
      return { ...origin, textSha256: hash };
    });
    return { name: pkg.name, version: pkg.version, license: pkg.license ?? null,
      source: pkg.source, repository: pkg.repository, authors: pkg.authors, notices };
  });
  const out = join(dirname(executable), "THIRD_PARTY_NOTICES.json");
  writeFileSync(out, JSON.stringify({ target, executable: executable.split(/[/\\]/).pop(),
    executableSha256: createHash("sha256").update(readFileSync(executable)).digest("hex"),
    crates, texts }, null, 2) + "\n");
  console.log("Native notices: " + crates.length + " crates for " + target);
}
