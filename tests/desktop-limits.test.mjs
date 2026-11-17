import test from "node:test";
import assert from "node:assert/strict";
import {
  checkedPreviewHTML,
  MAX_PREVIEW_HTML_BYTES,
  MAX_BUNDLE_BYTES,
  PROJECT_COMPILE_TIMEOUT_MS,
} from "../desktop/preview-limits.mjs";

test("desktop preview output uses a bounded UTF-8 budget, not character counts", () => {
  assert.equal(MAX_BUNDLE_BYTES, 64 * 1024 * 1024);
  assert.equal(PROJECT_COMPILE_TIMEOUT_MS, 120000);
  assert.equal(checkedPreviewHTML("<p>中文</p>"), "<p>中文</p>");
  assert.throws(() => checkedPreviewHTML(null), /invalid/);
  const source = "中".repeat(Math.floor(MAX_PREVIEW_HTML_BYTES / 3) + 1);
  assert.ok(source.length < MAX_PREVIEW_HTML_BYTES);
  assert.throws(() => checkedPreviewHTML(source), /80 MiB/);
});
