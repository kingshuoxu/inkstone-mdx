import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle } from "@codemirror/language";
import { highlightTree } from "@lezer/highlight";
import { workerHighlighter, highlightRules } from "../src/highlight-style.js";
function expected(doc, ranges, highlighter = workerHighlighter) {
  const out = [];
  const tree = markdown().language.parser.parse(doc);
  for (const { from, to } of ranges)
    highlightTree(tree, highlighter, (...s) => out.push(s), from, to);
  return out;
}
function client(t) {
  const worker = new Worker(
    new URL("./helpers/highlight-worker.mjs", import.meta.url),
  );
  t.after(() => worker.terminate());
  let id = 0;
  function wait(request) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(Error("highlight worker timed out"));
      }, 30000);
      function cleanup() {
        clearTimeout(timer);
        worker.off("message", message);
        worker.off("error", error);
      }
      function message(data) {
        if (data.request === request) {
          cleanup();
          resolve(data);
        }
      }
      function error(e) {
        cleanup();
        reject(e);
      }
      worker.on("message", message);
      worker.on("error", error);
    });
  }
  return {
    worker,
    wait,
    ask(data) {
      const request = ++id;
      const result = wait(request);
      worker.postMessage({ ...data, request });
      return result;
    },
  };
}
test("worker styles preserve every original default highlight rule", () => {
  for (const rule of highlightRules) {
    const tags = Array.isArray(rule.tag) ? rule.tag : [rule.tag];
    for (const tag of tags) assert.ok(workerHighlighter.style([tag]));
    const original =
      defaultHighlightStyle.specs[Number(rule.class.split("-").at(-1))];
    const { tag, ...style } = original;
    assert.deepEqual(rule.style, style);
  }
  const doc =
    '# Head\n\n~~deleted~~ *italic* **bold** [link](https://example.com)\n\n---\n\n```js\nlet x=1\n```\n\n<div class="a">HTML</div>';
  const ranges = [{ from: 0, to: doc.length }];
  assert.deepEqual(
    expected(doc, ranges).map((s) => s.slice(0, 2)),
    expected(doc, ranges, defaultHighlightStyle).map((s) => s.slice(0, 2)),
  );
});
test("worker matches full Markdown parser across Unicode, lists, HTML, fences and edits", async (t) => {
  const c = client(t);
  let doc =
    "# 中文 🌱\n\n**bold** *italic* ~~deleted~~ [link](https://example.com)\n\n> quote\n> - item\n\n```js\nlet x=1;\n```\n\n<div>HTML</div>\n\n[id]: https://example.com\n\n[reference][id]\n";
  let ranges = [{ from: 0, to: doc.length }];
  assert.deepEqual((await c.ask({ doc, ranges })).spans, expected(doc, ranges));
  for (const insert of ["```\n", "\n", "中文", "</div>\n"]) {
    const from = Math.floor(doc.length / 3);
    const changes = [
      {
        fromA: from,
        toA: from + 2,
        fromB: from,
        toB: from + insert.length,
        insert,
      },
    ];
    doc = doc.slice(0, from) + insert + doc.slice(from + 2);
    ranges = [
      { from: 5, to: Math.min(80, doc.length) },
      { from: 100, to: doc.length },
    ];
    assert.deepEqual(
      (await c.ask({ changes, ranges })).spans,
      expected(doc, ranges),
    );
  }
  // Multi-range transaction positions are all relative to the original doc.
  const changes = [
    { fromA: 0, toA: 0, fromB: 0, toB: 4, insert: "```\n" },
    {
      fromA: doc.length,
      toA: doc.length,
      fromB: doc.length + 4,
      toB: doc.length + 8,
      insert: "\n```",
    },
  ];
  doc = "```\n" + doc + "\n```";
  ranges = [{ from: 0, to: doc.length }];
  assert.deepEqual(
    (await c.ask({ changes, ranges })).spans,
    expected(doc, ranges),
  );
});
test("near-5-MiB worker incremental edits, rapid cancellation and sparse viewports", async (t) => {
  const c = client(t);
  const unit =
    "# Heading\n\n**bold** *italic* ~~strike~~ [link](https://example.com)\n\n";
  let doc = unit.repeat(Math.floor((5 * 1024 * 1024 - 4096) / unit.length));
  let ranges = [{ from: 0, to: 1000 }];
  assert.deepEqual((await c.ask({ doc, ranges })).spans, expected(doc, ranges));
  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    const changes = [{ fromA: 20, toA: 20, fromB: 20, toB: 21, insert: "中" }];
    doc = doc.slice(0, 20) + "中" + doc.slice(20);
    const result = await c.ask({ changes, ranges });
    times.push(performance.now() - start);
    assert.equal(
      result.spans.some((s) => s[1] > 1000),
      false,
    );
  }
  ranges = [
    { from: 0, to: 100 },
    { from: doc.length - 1000, to: doc.length },
  ];
  assert.deepEqual((await c.ask({ ranges })).spans, expected(doc, ranges));
  const final = c.wait(999);
  for (let i = 0; i < 30; i++) {
    doc = "x" + doc;
    c.worker.postMessage({
      request: 970 + i,
      changes: [{ fromA: 0, toA: 0, fromB: 0, toB: 1, insert: "x" }],
      ranges: [{ from: 0, to: 1000 }],
    });
  }
  assert.deepEqual((await final).spans, expected(doc, [{ from: 0, to: 1000 }]));
  times.sort((a, b) => a - b);
  console.log(
    "HIGHLIGHT_WORKER_ROUNDTRIP_MS",
    JSON.stringify({
      median: times[5],
      p95: times[9],
      note: "Node worker roundtrip, NOT browser input latency",
    }),
  );
});
