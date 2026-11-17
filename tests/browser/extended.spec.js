import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
const hash = (s) => createHash("sha256").update(s).digest("hex");
async function downloaded(page) {
  const wait = page.waitForEvent("download");
  await page.locator("#copy").click();
  const d = await wait;
  const chunks = [];
  for await (const chunk of await d.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
for (const unicode of [false, true])
  test(`near-5-MiB sustained editing, download and recovery (${unicode ? "Chinese" : "ASCII"})`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    page.on("dialog", (d) => d.accept());
    await page.addInitScript(() => {
      delete window.showOpenFilePicker;
      delete window.showSaveFilePicker;
    });
    await page.goto("/");
    const unit = unicode
      ? "中文段落与恢复验证。\n"
      : "A paragraph for sustained editing and recovery.\n";
    const bytes = 5 * 1024 * 1024 - 4096;
    const source = unit.repeat(Math.floor(bytes / Buffer.byteLength(unit)));
    await page.locator("#file-input").setInputFiles({
      name: "large.mdx",
      mimeType: "text/plain",
      buffer: Buffer.from(source),
    });
    await expect(page.locator("#file-name")).toHaveText("large.mdx");
    await expect(page.locator("iframe")).toHaveCount(0);
    const editor = page.locator(".cm-content");
    await editor.focus();
    await page.keyboard.press("ControlOrMeta+End");
    await page.evaluate(() => {
      window.largeSamples = [];
      document
        .querySelector(".cm-content")
        .addEventListener("beforeinput", () => {
          const start = performance.now();
          requestAnimationFrame(() =>
            window.largeSamples.push(performance.now() - start),
          );
        });
    });
    for (let i = 0; i < 20; i++) {
      await page.keyboard.insertText("中");
      await expect
        .poll(() => page.evaluate(() => window.largeSamples.length))
        .toBe(i + 1);
    }
    const expected = source + "中".repeat(20);
    expect(hash(await downloaded(page))).toBe(hash(expected));
    const recovery = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("inkstone.draft.v1")).source;
      } catch {
        return null;
      }
    });
    const available = recovery === expected;
    if (!available)
      await expect(page.locator("#draft-status")).toContainText(
        "Recovery unavailable",
      );
    const samples = await page.evaluate(() =>
      window.largeSamples.sort((a, b) => a - b),
    );
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const metrics = await cdp.send("Performance.getMetrics");
    console.log(
      "LARGE_FILE",
      JSON.stringify({
        unicode,
        bytes: Buffer.byteLength(expected),
        samples: 20,
        medianMs: samples[10],
        p95Ms: samples[18],
        recoveryAvailable: available,
        pageJSHeapBytes: metrics.metrics.find(
          (m) => m.name === "JSHeapUsedSize",
        )?.value,
        preview: "paused",
      }),
    );
    if (available) {
      await page.reload();
      await expect(page.locator("#notice")).toContainText(
        "Recovered your last",
      );
      expect(hash(await downloaded(page))).toBe(hash(expected));
      await expect(page.locator("iframe")).toHaveCount(0);
    }
    await info.attach("large-file.json", {
      body: JSON.stringify({
        bytes: Buffer.byteLength(expected),
        sha256: hash(expected),
        recoveryAvailable: available,
        samples,
      }),
      contentType: "application/json",
    });
  });
test("Chromium IME composition protocol: candidate updates, commit, cancel and undo (simulated)", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#pause").click();
  const editor = page.locator(".cm-content");
  await editor.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("中文前缀 ");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", {
    text: "ni",
    selectionStart: 2,
    selectionEnd: 2,
  });
  await cdp.send("Input.imeSetComposition", {
    text: "你好",
    selectionStart: 2,
    selectionEnd: 2,
  });
  await cdp.send("Input.insertText", { text: "你好" });
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("inkstone.draft.v1")).source,
      ),
    )
    .toBe("中文前缀 你好");
  await cdp.send("Input.imeSetComposition", {
    text: "取消",
    selectionStart: 2,
    selectionEnd: 2,
  });
  await cdp.send("Input.imeSetComposition", {
    text: "",
    selectionStart: 0,
    selectionEnd: 0,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("inkstone.draft.v1")).source,
      ),
    )
    .toBe("中文前缀 你好");
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("inkstone.draft.v1")).source,
      ),
    )
    .toBe("中文前缀 你好");
});

test("BOM and CRLF survive edits; invalid UTF-8 cannot replace the document", async ({
  page,
}) => {
  await page.goto("/");
  const original = "\uFEFF# 中文\r\n\r\nKeep me\r\n";
  await page.locator("#file-input").setInputFiles({
    name: "crlf.mdx",
    mimeType: "text/plain",
    buffer: Buffer.from(original),
  });
  await page.locator(".cm-content").focus();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("new");
  expect(await downloaded(page)).toBe(original + "new");
  await page.locator("#file-input").setInputFiles({
    name: "invalid.mdx",
    mimeType: "text/plain",
    buffer: Buffer.from([0xff, 0xfe, 0x61]),
  });
  await expect(page.locator("#notice")).toContainText("not valid UTF-8");
  expect(await downloaded(page)).toBe(original + "new");
});
