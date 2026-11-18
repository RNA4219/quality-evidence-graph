import { spawnSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { nativeBinary, nativeEnv } from "./native.mjs";

export function invoke(method, ...args) {
  const result = spawnSync(nativeBinary(), ["--api", method], {
    input: JSON.stringify(args), encoding: "utf8", maxBuffer: Infinity, env: nativeEnv(),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || "QEG process failed");
  return JSON.parse(result.stdout);
}

export function invokeAsync(method, ...args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(nativeBinary(), ["--api", method], {stdio: "pipe", env: nativeEnv()});
    const output = [], errors = [];
    proc.stdout.on("data", chunk => output.push(chunk));
    proc.stderr.on("data", chunk => errors.push(chunk));
    proc.once("error", reject);
    proc.stdin.on("error", error => { if (error.code !== "EPIPE") reject(error); });
    proc.once("close", code => {
      if (code !== 0) return reject(new Error(Buffer.concat(errors).toString().trim() || "QEG process failed"));
      try { resolve(JSON.parse(Buffer.concat(output).toString())); } catch (error) { reject(error); }
    });
    proc.stdin.end(JSON.stringify(args));
  });
}

async function publishAtBoundaries(directory, files, callback) {
  const proc = spawn(nativeBinary(), ["--api", "publishBoundaries"], {stdio: "pipe", env: nativeEnv()});
  let errors = "";
  proc.stderr.setEncoding("utf8").on("data", chunk => { errors += chunk; });
  proc.stdin.on("error", error => { if (error.code !== "EPIPE") proc.destroy?.(error); });
  const done = new Promise((resolve, reject) => { proc.once("error", reject); proc.once("close", resolve); });
  const lines = createInterface({ input: proc.stdout });
  proc.stdin.write(JSON.stringify([directory, [...files]]) + "\n");
  for await (const line of lines) {
    const boundary = JSON.parse(line);
    try { await callback(boundary); proc.stdin.write("true\n"); }
    catch (error) { proc.stdin.end(JSON.stringify(String(error)) + "\n"); break; }
  }
  if (await done !== 0) throw new Error(errors.trim() || "Publishing outputs failed");
}

export const evaluateGate = input => invoke("evaluateGate", input);
export const getExitCode = (verdict, policy) => invoke("getExitCode", verdict, policy);
export const isGateEligibleTestEvidence = test => invoke("isGateEligibleTestEvidence", test);
export const buildGraph = (manifest, loaded) => invoke("buildGraph", manifest, loaded);
export const placeTests = (graph, policy) => invoke("placeTests", graph, policy);
export const upstreamInputContract = target => invoke("upstreamInputContract", target);
export const parseProducerArtifact = (ref, content) => invoke("parseProducerArtifact", ref, content);
export const validateGateInput = raw => invokeAsync("validateGateInput", raw);
export const validateOutput = (value, schema) => invokeAsync("validateOutput", value, schema);
export const verifyEvidenceArtifacts = (input, options) => invokeAsync("verifyEvidenceArtifacts", input, options);
export const recoverOutputs = directory => invokeAsync("recoverOutputs", directory);
export const planConsumerMigration = (directory, config) => invokeAsync("planConsumerMigration", directory, config);
export const applyConsumerMigration = (directory, config) => invokeAsync("applyConsumerMigration", directory, config);
export async function readPublishedOutputs(directory) {
  const result = await invokeAsync("readPublishedOutputs", directory);
  return { ...result, files: new Map(Object.entries(result.files)) };
}
export async function publishFiles(directory, files, options = {}) {
  if (options.onBoundary) return publishAtBoundaries(directory, files, options.onBoundary);
  await invokeAsync("publishFiles", directory, [...files]);
}
export function createRecordArtifacts(evaluated) {
  const result = invoke("createRecordArtifacts", evaluated);
  return {record: result.record, files: new Map(Object.entries(result.files))};
}
const contracts = invoke("constants");
export const UPSTREAM_REQUIRED_ARTIFACTS = contracts.required;
export const PLACEMENT_LAYERS = contracts.layers;
