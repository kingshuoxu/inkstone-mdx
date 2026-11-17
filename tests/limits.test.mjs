import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkedSource, readDocument, atomicSave } from "../desktop/files.mjs";
import { compileSource } from "../src/compiler.js";
import { bundleProject } from "../desktop/bundle.mjs";
import { writeDraft, readDraft } from "../src/storage.js";
const fileCap = 5 * 1024 * 1024,
  previewCap = 512000;
const exactChinese = (bytes) =>
  "中".repeat(Math.floor(bytes / 3)) + "x".repeat(bytes % 3);
test("5 MiB native source guard counts UTF-8 bytes, accepting boundary and refusing one extra byte", () => {
  const source = exactChinese(fileCap);
  assert.equal(Buffer.byteLength(source), fileCap);
  assert.equal(checkedSource(source), source);
  assert.throws(() => checkedSource(source + "x"), /5 MiB/);
  assert.throws(() => checkedSource(null), /Invalid source/);
});
test("native opening and atomic save/copy round-trip exactly 5 MiB; oversized open is refused", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ink-limits-"));
  try {
    const source = exactChinese(fileCap),
      original = path.join(root, "边界.mdx"),
      copy = path.join(root, "副本.mdx");
    await atomicSave(original, source, null);
    assert.equal((await readDocument(original)).source, source);
    await atomicSave(copy, source, null);
    assert.equal((await readDocument(copy)).source, source);
    await fs.appendFile(original, "x");
    await assert.rejects(readDocument(original), /5 MiB/);
    assert.equal((await fs.stat(copy)).size, fileCap);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("browser and project preview accept 512000 UTF-8 bytes and reject 512001 before compilation", async () => {
  const source = exactChinese(previewCap);
  const code = await compileSource(source);
  assert.ok(code.includes("中"));
  await assert.rejects(compileSource(source + "x"), /500 KB/);
  const root = path.resolve("examples/project"),
    file = path.join(root, "index.mdx");
  const result = await bundleProject({ root, file, source });
  assert.ok(result.js.length > 0);
  await assert.rejects(
    bundleProject({ root, file, source: source + "x" }),
    /500 KB/,
  );
});
test("recovery quota failure is surfaced and does not silently replace the previous draft", () => {
  const old = JSON.stringify({ source: "# old", name: "old.mdx" });
  const storage = {
    getItem: () => old,
    setItem: () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    },
  };
  assert.throws(() => writeDraft(storage, exactChinese(fileCap), "large.mdx"), {
    name: "QuotaExceededError",
  });
  assert.equal(readDraft(storage).source, "# old");
});

test("native UTF-8 decoding preserves BOM/CRLF and rejects corrupt bytes", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ink-encoding-"));
  try {
    const file = path.join(root, "document.mdx");
    const source = "\uFEFF# 中文\r\n";
    await fs.writeFile(file, source);
    assert.equal((await readDocument(file)).source, source);
    await fs.writeFile(file, Buffer.from([0xff, 0xfe]));
    await assert.rejects(readDocument(file), /not valid UTF-8/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
