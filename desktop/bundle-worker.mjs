import { parentPort, workerData } from "node:worker_threads";
import { bundleProject } from "./bundle.mjs";
import { stop } from "esbuild";
try {
  parentPort.postMessage({ result: await bundleProject(workerData) });
} catch (e) {
  parentPort.postMessage({ error: e.message });
} finally {
  stop();
}
