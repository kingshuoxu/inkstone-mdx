import { test, expect } from "@playwright/test";
for (const size of [10000, 100000])
  test(`live preview and input, dense ${size}`, async ({ page }, info) => {
    page.on("dialog", (dialog) => dialog.accept()); // Known benchmark fixtures only.
    await page.goto("/");
    await expect(
      page
        .frameLocator("iframe:not([data-pending])")
        .getByRole("heading", { level: 1 })
        .first(),
    ).toBeVisible();
    const unit = "# Heading\n\n**bold** and {1+2}\n\n<Badge>中文</Badge>\n\n";
    const source = unit.repeat(Math.floor(size / Buffer.byteLength(unit)));
    const editor = page.locator(".cm-content");
    await page.evaluate(() => {
      window.samples = [];
      document
        .querySelector(".cm-content")
        .addEventListener("beforeinput", () => {
          const t = performance.now();
          requestAnimationFrame(() =>
            window.samples.push(performance.now() - t),
          );
        });
    });
    await page.locator("#file-input").setInputFiles({
      name: "benchmark.mdx",
      mimeType: "text/plain",
      buffer: Buffer.from(source + "\n\nMARKER0"),
    });
    await expect(page.locator("iframe")).toHaveCount(0);
    const times = [];
    let engine;
    for (let i = 0; i < 4; i++) {
      const start = performance.now();
      if (i === 0)
        await page.getByRole("button", { name: "Run preview" }).click();
      else {
        await editor.focus();
        await page.keyboard.press("ControlOrMeta+End");
        await page.keyboard.press("Backspace");
        await page.keyboard.insertText(String(i));
      }
      await expect(
        page
          .frameLocator("iframe:not([data-pending])")
          .getByText("MARKER" + i, { exact: true }),
      ).toBeVisible({ timeout: 15000 });
      times.push(performance.now() - start);
      engine = await page
        .locator("#compile-status")
        .getAttribute("data-engine");
    }
    if (info.project.name === "rust" && size > 16000)
      expect(engine).toBe("rust");
    // Type while a compilation is in flight; cancellation must retain the final source.
    await editor.focus();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.insertText("x");
    await page.waitForTimeout(260);
    for (let i = 0; i < 10; i++) await page.keyboard.insertText("y");
    await expect(
      page
        .frameLocator("iframe:not([data-pending])")
        .getByText("MARKER3x" + "y".repeat(10), { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    const input = await page.evaluate(() =>
      window.samples.slice(-10).sort((a, b) => a - b),
    );
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const metrics = await cdp.send("Performance.getMetrics");
    const data = {
      version: info.project.name,
      bytes: Buffer.byteLength(source),
      engine,
      firstRunToPreviewMs: times[0],
      editToPreviewMs: times.slice(1),
      typingMedianMs: input[5],
      typingP95Ms: input[9],
      pageJSHeapBytes: metrics.metrics.find((m) => m.name === "JSHeapUsedSize")
        ?.value,
      note: "Preview includes debounce, compile, IPC/iframe and React render; page heap excludes worker/WASM and is not total memory.",
    };
    console.log("LIVE_COMPARISON", JSON.stringify(data));
    await info.attach("live-comparison.json", {
      body: JSON.stringify(data),
      contentType: "application/json",
    });
  });
