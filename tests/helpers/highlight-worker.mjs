import { parentPort } from "node:worker_threads";
globalThis.postMessage = (data) => parentPort.postMessage(data);
globalThis.onmessage = null;
await import("../../src/highlight-worker.js");
parentPort.on("message", (data) => globalThis.onmessage({ data }));
