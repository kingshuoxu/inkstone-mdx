import { test, expect } from "@playwright/test";
const colored = '.cm-content span[class*="ink-token-"]';
async function ready(page) {
  await expect(page.locator(".cm-editor")).toHaveAttribute(
    "data-highlight-state",
    "ready",
    { timeout: 30000 },
  );
}
async function open(page, source) {
  await page.locator("#file-input").setInputFiles({
    name: "highlight.mdx",
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  });
  await expect(page.locator("#file-name")).toHaveText("highlight.mdx");
  await ready(page);
}
test("large file retains theme, fence context, scrolling, edits and mode switching", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const source =
    "# TOP\n\n~~strike~~ **bold** *italic* [link](https://example.com)\n\n" +
    "ordinary paragraph\n\n".repeat(53000) +
    "\n# BOTTOM\n\n**tail**\n";
  await open(page, source);
  await expect(page.locator("#syntax-status")).toContainText("background");
  await expect(page.locator(colored).filter({ hasText: "TOP" })).toHaveCSS(
    "font-weight",
    "700",
  );
  await expect(page.locator(colored).filter({ hasText: "italic" })).toHaveCSS(
    "font-style",
    "italic",
  );
  const editor = page.locator(".cm-content");
  await editor.focus();
  await page.keyboard.press("ControlOrMeta+Home");
  await page.keyboard.insertText("```\n");
  await ready(page);
  // The heading is now in an unclosed fenced block, not a heading.
  await expect(page.locator(colored).filter({ hasText: "TOP" })).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await ready(page);
  await expect(page.locator(colored).filter({ hasText: "TOP" })).toHaveCSS(
    "font-weight",
    "700",
  );
  await page.keyboard.press("ControlOrMeta+End");
  await expect(page.locator(colored).filter({ hasText: "BOTTOM" })).toHaveCSS(
    "font-weight",
    "700",
    { timeout: 30000 },
  );
  await page.keyboard.insertText("\n# NEW 中文");
  await ready(page);
  await expect(page.locator(colored).filter({ hasText: "NEW 中文" })).toHaveCSS(
    "font-weight",
    "700",
  );
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("# Small");
  await expect(page.locator("#syntax-status")).toBeHidden();
  await expect(page.locator(".cm-editor")).not.toHaveAttribute(
    "data-highlight-state",
    /./,
  );
  await page.keyboard.press("ControlOrMeta+z");
  await ready(page);
  await expect(page.locator("#syntax-status")).toBeVisible();
});
test("near-5-MiB colored document remains editable during background work", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const unit =
    "# Heading\n\n**bold** *italic* ~~strike~~ [link](https://example.com)\n\n";
  const source = unit.repeat(
    Math.floor((5 * 1024 * 1024 - 4096) / unit.length),
  );
  await open(page, source);
  await expect(page.locator(colored).first()).toBeVisible();
  await page.locator(".cm-content").focus();
  await page.keyboard.press("ControlOrMeta+End");
  await ready(page);
  await page.evaluate(() => {
    window.highlightSamples = [];
    document
      .querySelector(".cm-content")
      .addEventListener("beforeinput", () => {
        const start = performance.now();
        requestAnimationFrame(() =>
          window.highlightSamples.push(performance.now() - start),
        );
      });
  });
  for (let i = 0; i < 20; i++) {
    await page.keyboard.insertText("中");
    await expect
      .poll(() => page.evaluate(() => window.highlightSamples.length))
      .toBe(i + 1);
  }
  await ready(page);
  const samples = await page.evaluate(() =>
    window.highlightSamples.sort((a, b) => a - b),
  );
  const data = {
    bytes: Buffer.byteLength(source),
    medianMs: samples[10],
    p95Ms: samples[18],
    samples,
    preview: "paused",
    highlight: "worker enabled",
  };
  console.log("HIGHLIGHT_INPUT", JSON.stringify(data));
  await info.attach("highlight-input.json", {
    body: JSON.stringify(data),
    contentType: "application/json",
  });
  await page.screenshot({ path: `docs/highlight-${info.project.name}.png` });
  // A generous regression gate, not a claim of smooth 60fps on all hardware.
  expect(samples[10]).toBeLessThan(150);
});
test("worker load error is visible and reopening retries without losing content", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.route(/highlight-worker.*\.js/, (route) => route.abort());
  const source = "# RETRY\n\n" + "text\n\n".repeat(180000);
  await page.locator("#file-input").setInputFiles({
    name: "failed.mdx",
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  });
  await expect(page.locator(".cm-editor")).toHaveAttribute(
    "data-highlight-state",
    "error",
  );
  await expect(page.locator("#notice")).toContainText(
    "Background highlighting failed",
  );
  await page.unroute(/highlight-worker.*\.js/);
  await open(page, source);
  await expect(page.locator(colored).filter({ hasText: "RETRY" })).toHaveCSS(
    "font-weight",
    "700",
  );
});
