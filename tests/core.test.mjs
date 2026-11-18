import test from "node:test";
import assert from "node:assert/strict";
import { compileSource } from "../src/compiler.js";
import { readDraft, writeDraft, saveHandle } from "../src/storage.js";
import { previewDocument } from "../src/sandbox.js";
test("compiles real MDX expressions and GFM", async () => {
  const code = await compileSource(
    "# Hello\n\n{1+2}\n\n<Counter />\n\n| a | b |\n| - | - |\n| 1 | 2 |",
  );
  assert.match(code, /1 \+ 2/);
  assert.match(code, /table/);
  assert.match(code, /Counter/);
});
test("rejects imports and exports with actionable errors", async () => {
  for (const s of ['import A from "./A"\n\n<A/>', "export const x = 1"])
    await assert.rejects(compileSource(s), /Imports and exports/);
});
test("reports invalid JSX and enforces preview size limit", async () => {
  await assert.rejects(compileSource("<Broken>"));
  await assert.rejects(compileSource("a".repeat(5 * 1024 * 1024 + 1)), /5 MiB/);
});
test("recovery validates corrupt drafts and preserves Unicode", () => {
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k),
    setItem: (k, v) => map.set(k, v),
  };
  assert.equal(readDraft(storage), null);
  writeDraft(storage, "# 你好 🌱", "test.mdx");
  assert.equal(readDraft(storage).source, "# 你好 🌱");
  storage.setItem("inkstone.draft.v1", "broken");
  assert.equal(readDraft(storage), null);
});
test("save refuses external modifications before creating writer", async () => {
  await assert.rejects(
    saveHandle(
      {
        getFile: async () => ({ text: async () => "external" }),
        createWritable: () => assert.fail("must not write"),
      },
      "mine",
      "old",
    ),
    /changed on disk/,
  );
});
test("save commits only after close and aborts failed writes", async () => {
  let written,
    closed = false,
    aborted = false;
  const h = {
    getFile: async () => ({ text: async () => "old" }),
    createWritable: async () => ({
      write: async (s) => {
        written = s;
      },
      close: async () => {
        closed = true;
      },
      abort: async () => {
        aborted = true;
      },
    }),
  };
  await saveHandle(h, "new", "old");
  assert.equal(written, "new");
  assert.equal(closed, true);
  h.createWritable = async () => ({
    write: async () => {
      throw Error("disk full");
    },
    abort: async () => {
      aborted = true;
    },
  });
  await assert.rejects(saveHandle(h, "new", "old"), /disk full/);
  assert.equal(aborted, true);
});
test("payload cannot escape script element; CSP denies network and frames", () => {
  const html = previewDocument('console.log("safe")', "</script><img src=x>");
  assert.ok(!html.includes("</script><img"));
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /frame-src 'none'/);
  assert.match(html, /form-action 'none'/);
});

test("browser handle conflict checks preserve UTF-8 BOM and reject invalid bytes", async () => {
  const baseline = "\ufeff# 中文\r\n";
  let written;
  const h = {
    getFile: async () => new Blob([baseline]),
    createWritable: async () => ({
      write: async (s) => {
        written = s;
      },
      close: async () => {},
    }),
  };
  await saveHandle(h, baseline + "new", baseline);
  assert.equal(written, baseline + "new");
  h.getFile = async () => new Blob([new Uint8Array([0xff])]);
  h.createWritable = async () =>
    assert.fail("must not overwrite invalid bytes");
  await assert.rejects(saveHandle(h, "new", baseline));
});
