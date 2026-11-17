import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

// Execute the actual Vite output without DOM globals. Unit tests importing the
// compiler directly use Node resolution and cannot catch browser export errors.
const asset = readdirSync("dist/assets").find((name) =>
  name.startsWith("worker-"),
);
assert.ok(asset, "Build the app before checking the worker");
let result;
const self = {};
vm.runInNewContext(readFileSync(`dist/assets/${asset}`, "utf8"), {
  self,
  postMessage: (message) => {
    result = message;
  },
  performance,
  TextEncoder,
  TextDecoder,
  URL,
  console,
  setTimeout,
  clearTimeout,
});
await self.onmessage({
  data: { id: 1, source: "# Worker &amp; JSX\n\n<Badge>OK</Badge>" },
});
assert.equal(result.id, 1);
assert.equal(result.error, undefined);
assert.match(result.code, /Worker & JSX/);
assert.match(result.code, /Badge/);
await self.onmessage({ data: { id: 2, source: "<Broken>" } });
assert.equal(result.id, 2);
assert.equal(typeof result.error, "string");
console.log(
  "Built worker compiles JSX/entities and reports errors without DOM globals.",
);
