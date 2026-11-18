// 開発用の回帰試験と既存のfixture移行スクリプトが使う入口。
import { createHash } from "node:crypto";
import { invoke, invokeAsync } from "./api.mjs";
export { createRecordArtifacts, publishFiles } from "./api.mjs";
export const contentHash = bytes => "sha256:" + createHash("sha256").update(bytes).digest("hex");
export const evaluateFixture = (directory, options) => invokeAsync("evaluateFixture", directory, options);
export const writeOutputRecord = evaluated => invokeAsync("writeOutputRecord", evaluated);
export const loadRawArtifacts = directory => invokeAsync("loadRawArtifacts", directory);
export const verifyOutputManifest = async directory => (await invokeAsync("verifyOutputManifest", directory)) ?? undefined;
export const validateWaiver = (waiver, graph, time) => invoke("validateWaiver", waiver, graph, time);
export function timestampNanos(text) {
  const nanos = invoke("timestampNanos", text);
  return nanos === null ? undefined : BigInt(nanos);
}
export const normalizeStatus = value => value === undefined ? undefined : invoke("normalizeStatus", value);
export const shellStatus = raw => invoke("shellStatus", raw) ?? undefined;
export const statusAliases = (raw, ...keys) => invoke("statusAliases", raw, ...keys) ?? undefined;
export const OUTPUT_SCHEMAS = {
  "qeg.bundle.json": "qeg.bundle.schema.json",
  "test-placement-plan.json": "test-placement-plan.schema.json",
  "gate-verdict.json": "gate-verdict.schema.json",
  "quality-evidence-record.json": "quality-evidence-record.schema.json",
  "output-record.json": "quality-evidence-record.schema.json",
  "output-manifest.json": "output-manifest.schema.json",
};
