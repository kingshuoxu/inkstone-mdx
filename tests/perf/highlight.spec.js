import { test, expect } from "@playwright/test";
for (const kind of ["plain", "rich"])
  test(`near-5-MiB highlighted editing comparison (${kind})`, async ({
    page,
  }, info) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/");
    const unit =
      kind === "plain"
        ? "A paragraph for sustained editing and recovery.\n"
        : "# Heading\n\n**bold** and *italic* with [link](https://example.com)\n\n";
    const source = unit.repeat(
      Math.floor((5 * 1024 * 1024 - 4096) / unit.length),
    );
    await page.locator("#file-input").setInputFiles({
      name: "compare.mdx",
      mimeType: "text/plain",
      buffer: Buffer.from(source),
    });
    await expect(page.locator("#file-name")).toHaveText("compare.mdx");
    const editor = page.locator(".cm-content");
    await editor.focus();
    await page.keyboard.press("ControlOrMeta+End");
    if (info.project.name === "rust")
      await expect(page.locator(".cm-editor")).toHaveAttribute(
        "data-highlight-state",
        "ready",
        { timeout: 30000 },
      );
    await page.evaluate(() => {
      window.highlightSamples = [];
      document
        .querySelector(".cm-content")
        .addEventListener("beforeinput", () => {
          const t = performance.now();
          requestAnimationFrame(() =>
            window.highlightSamples.push(performance.now() - t),
          );
        });
    });
    for (let i = 0; i < 20; i++) {
      await page.keyboard.insertText("中");
      await expect
        .poll(() => page.evaluate(() => window.highlightSamples.length))
        .toBe(i + 1);
    }
    const samples = await page.evaluate(() =>
      window.highlightSamples.sort((a, b) => a - b),
    );
    const data = {
      version: info.project.name,
      kind,
      bytes: Buffer.byteLength(source),
      samples,
      medianMs: samples[10],
      p95Ms: samples[18],
      note: "beforeinput to next rAF; preview paused; baseline 19f4d5b full main-thread highlighting, new background highlighting",
    };
    console.log("HIGHLIGHT_COMPARISON", JSON.stringify(data));
    await info.attach("highlight-comparison.json", {
      body: JSON.stringify(data),
      contentType: "application/json",
    });
  });
