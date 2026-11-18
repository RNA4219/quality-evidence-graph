import { isAbsolute, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { addon, addonPath } from "./addon.mjs";

export function invoke(method, ...args) {
  return JSON.parse(addon.invoke(method, JSON.stringify(args)));
}

function captureDirectory(directory) {
  if (typeof directory !== "string" || directory === "") return directory;
  if (process.platform === "win32") return resolve(directory);
  // POSIX ではシンボリックリンクの後の .. をファイルシステムに解決させる。
  return isAbsolute(directory) ? directory : process.cwd() + "/" + directory;
}

const directoryOperations = new Set([
  "readPublishedOutputs", "publishFiles", "recoverOutputs", "planConsumerMigration", "applyConsumerMigration",
  "loadRawArtifacts", "evaluateFixture", "verifyOutputManifest",
]);

export async function invokeAsync(method, ...args) {
  // libuv のキューで待つ間に呼び出し元が process.chdir() しても同じ入力を開く。
  if (directoryOperations.has(method)) args[0] = captureDirectory(args[0]);
  if (method === "verifyEvidenceArtifacts" && typeof args[1]?.baseDir === "string") {
    args[1] = { ...args[1], baseDir: captureDirectory(args[1].baseDir) };
  }
  if (method === "writeOutputRecord" && typeof args[0]?.fixtureDir === "string") {
    args[0] = { ...args[0], fixtureDir: captureDirectory(args[0].fixtureDir) };
  }
  return JSON.parse(await addon.invokeAsync(method, JSON.stringify(args)));
}

function publishAtBoundaries(directory, files, callback) {
  const signal = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  const worker = new Worker(new URL("./publication-worker.mjs", import.meta.url), {
    execArgv: [],
    workerData: { addonPath, request: JSON.stringify([captureDirectory(directory), [...files]]), signal },
  });
  return new Promise((resolve, reject) => {
    worker.once("error", reject);
    worker.once("exit", code => {
      if (code === 0) resolve();
      else reject(new Error("Publication worker exited with code " + code));
    });
    worker.on("message", async boundary => {
      let accepted = false;
      try {
        await callback(boundary);
        accepted = true;
      } catch (error) {
        try { worker.postMessage(String(error)); } catch { /* 呼び出し元が文字列化できない値を投げた場合 */ }
      } finally {
        Atomics.store(signal, 0, accepted ? 1 : -1);
        Atomics.notify(signal, 0);
      }
    });
  });
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
