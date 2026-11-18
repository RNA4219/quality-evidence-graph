#!/usr/bin/env node
import { spawn } from "node:child_process";
import { nativeBinary, nativeEnv } from "./native.mjs";
const child = spawn(nativeBinary(), process.argv.slice(2), { stdio: "inherit", env: nativeEnv() });
child.once("error", error => { console.error(error.message); process.exitCode = 1; });
child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
