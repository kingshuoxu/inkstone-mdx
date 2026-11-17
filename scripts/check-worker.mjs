import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { Worker } from "node:worker_threads";
const asset = readdirSync("dist/assets").find((n) => n.startsWith("worker-"));
assert.ok(asset);
const url = new URL(`../dist/assets/${asset}`, import.meta.url).href;
const worker = new Worker(
  `const {parentPort}=require('node:worker_threads');global.self=global;global.postMessage=x=>parentPort.postMessage(x);import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,
  { eval: true },
);
function send(source) {
  return new Promise((resolve, reject) => {
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.postMessage({ id: 1, source });
  });
}
try {
  let r = await send(
    "# Worker &amp; JSX\n\n<Badge>OK</Badge>" + "\n\nplain text".repeat(2000),
  );
  assert.equal(r.error, undefined);
  assert.equal(r.engine, "rust");
  assert.match(r.code, /Worker & JSX/);
  r = await send("<Broken>");
  assert.equal(typeof r.error, "string");
  console.log(
    "Built module worker runs Rust WASM and reports errors without DOM globals.",
  );
} finally {
  await worker.terminate();
}
