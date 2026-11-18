#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { nativeBinary, nativeEnv } from "../../bindings/native.mjs";

try {
  const result = spawnSync(nativeBinary(), process.argv.slice(2), { stdio: "inherit", env: nativeEnv() });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
