import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const temp = await mkdtemp(join(tmpdir(), "qeg-package-smoke-"));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "npm_execpath is required; run this smoke test through npm run test:package");
const npmCacheResult = spawnSync(process.execPath, [npmCli, "config", "get", "cache"], { encoding: "utf-8" });
assert.equal(npmCacheResult.status, 0, npmCacheResult.stderr || npmCacheResult.stdout);
const npmCache = npmCacheResult.stdout.trim();
assert.ok(npmCache, "npm cache path is required");
const packed = spawnSync(process.execPath, [npmCli, "pack", "--json", "--pack-destination", temp, "--cache", npmCache], { encoding: "utf-8" });
assert.equal(packed.status, 0, packed.stderr || packed.stdout);
const [{ filename }] = JSON.parse(packed.stdout);
const tarball = join(temp, filename);
const installed = spawnSync(process.execPath, [npmCli, "install", tarball, "--prefix", temp, "--ignore-scripts", "--no-audit", "--no-fund", "--prefer-offline", "--cache", npmCache], { encoding: "utf-8" });
assert.equal(installed.status, 0, installed.stderr || installed.stdout);
const packageRoot = join(temp, "node_modules", "@quality-harness", "quality-evidence-graph");
const qegBin = join(temp, "node_modules", ".bin", process.platform === "win32" ? "qeg.cmd" : "qeg");
function runQeg(args) {
  if (process.platform === "win32") {
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/c", "call", qegBin, ...args], { encoding: "utf-8", cwd: temp });
  }
  return spawnSync(qegBin, args, { encoding: "utf-8", cwd: temp });
}
const help = runQeg(["--help"]);
assert.equal(help.status, 0, help.stderr || help.stdout);
assert.match(help.stdout, /Usage: qeg/);
const version = runQeg(["--version"]);
assert.equal(version.status, 0, version.stderr || version.stdout);
assert.equal(version.stdout.trim(), "0.3.0");
const schemaCheck = runQeg(["schema-check"]);
assert.equal(schemaCheck.status, 0, schemaCheck.stderr || schemaCheck.stdout);
const imported = await import(new URL(`file:///${join(packageRoot, "dist", "index.js").replaceAll("\\", "/")}`));
assert.equal(typeof imported.evaluateGate, "function");
assert.equal(typeof imported.validateGateInput, "function");
assert.equal(typeof imported.verifyEvidenceArtifacts, "function");
assert.equal(typeof imported.getExitCode, "function");
assert.equal(JSON.parse(await readFile(join(packageRoot, "package.json"), "utf-8")).version, "0.3.0");

await writeFile(
  join(temp, "package.json"),
  JSON.stringify({ private: true, type: "module" }, null, 2) + "\n",
);
await writeFile(
  join(temp, "contract.ts"),
  await readFile(resolve("tests", "type-contract", "contract.ts"), "utf-8"),
);
await writeFile(
  join(temp, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        exactOptionalPropertyTypes: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ["contract.ts"],
    },
    null,
    2,
  ) + "\n",
);
const typeContract = spawnSync(
  process.execPath,
  [resolve("node_modules", "typescript", "bin", "tsc"), "-p", join(temp, "tsconfig.json")],
  { encoding: "utf-8", cwd: temp },
);
assert.equal(typeContract.status, 0, typeContract.stderr || typeContract.stdout);

console.log("Clean tarball install, CLI/library smoke, and packed public type contract passed");
