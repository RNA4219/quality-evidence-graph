import { parentPort, receiveMessageOnPort, workerData } from "node:worker_threads";
import { loadAddon } from "./native.mjs";

const { addonPath, request, signal } = workerData;
const addon = loadAddon(addonPath);
addon.publishWithBoundaries(request, boundary => {
  // 書き込みのリースを維持し、呼び出し元がこの境界を承認してから次へ進む。
  Atomics.store(signal, 0, 0);
  parentPort.postMessage(boundary);
  Atomics.wait(signal, 0, 0);
  if (Atomics.load(signal, 0) !== 1) {
    throw new Error(receiveMessageOnPort(parentPort)?.message ?? "Publication callback failed");
  }
});
