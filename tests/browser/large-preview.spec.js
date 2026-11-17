import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const cap = 5 * 1024 * 1024;
async function open(page, source, name = "full-large.mdx") {
  await page.locator("#file-input").setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  });
  await expect(page.locator("#file-name")).toHaveText(name);
}
async function ready(page) {
  await expect(page.locator("#compile-status")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 180000 },
  );
  return page.frameLocator("iframe:not([data-pending])");
}
for (const kind of ["long-paragraphs", "rich-300k-lines"]) {
  test(`complete 5 MiB preview: ${kind}, tail component and editing`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "production",
      "Heavy whole-document test runs on production.",
    );
    test.setTimeout(360000);
    page.on("dialog", (d) => d.accept());
    await page.goto("/");
    await ready(page);
    const prefix = "# FULL DOCUMENT TOP\n\n";
    const unit =
      kind === "long-paragraphs"
        ? "ordinary paragraph ".repeat(200) + "\n\n"
        : "# Heading\n\n**bold** *italic* ~~strike~~ [link](https://example.com)\n\n";
    const tail =
      "\n\n# UNIQUE FULL DOCUMENT END\n\n<Counter />\n\n<Badge>{6 * 7}</Badge>\n";
    const count = Math.floor(
      (cap - 8192 - prefix.length - tail.length) / unit.length,
    );
    const source = prefix + unit.repeat(count) + tail;
    await open(page, source);
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.locator("#pause").click();
    const start = Date.now();
    const frame = await ready(page);
    await expect(
      frame.getByRole("heading", { name: "FULL DOCUMENT TOP", exact: true }),
    ).toBeVisible();
    const heading = frame.getByRole("heading", {
      name: "UNIQUE FULL DOCUMENT END",
      exact: true,
    });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    await expect(frame.locator(".badge")).toHaveText("42");
    await frame.getByRole("button", { name: "Clicked 0 times" }).click();
    await expect(
      frame.getByRole("button", { name: "Clicked 1 times" }),
    ).toBeVisible();
    const iframe = page.frames().find((f) => f !== page.mainFrame());
    const metrics = await iframe.evaluate(() => ({
      nodes: document.querySelectorAll("*").length,
      headings: document.querySelectorAll("h1").length,
      textLength: document.querySelector("#root").textContent.length,
    }));
    expect(metrics.headings).toBe(kind === "rich-300k-lines" ? count + 2 : 2);
    const timing = {
      kind,
      bytes: Buffer.byteLength(source),
      lines: source.split("\n").length,
      previewMs: Number(
        await page.locator("#compile-status").getAttribute("data-preview-ms"),
      ),
      observedReadyMs: Date.now() - start,
      ...metrics,
    };
    console.log("FULL_PREVIEW", JSON.stringify(timing));
    await writeFile(
      `docs/full-preview-${kind}.json`,
      JSON.stringify(timing, null, 2),
    );
    await page.screenshot({ path: `docs/full-preview-${kind}.png` });
    // End-of-document edits must update the full render, not a truncated prefix.
    await page.locator(".cm-content").focus();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.insertText("\n# UPDATED FULL END\n");
    await expect(page.locator("#compile-status")).toHaveAttribute(
      "data-state",
      /compiling|rendering/,
      { timeout: 10000 },
    );
    await ready(page);
    await expect(
      page
        .frameLocator("iframe:not([data-pending])")
        .getByRole("heading", { name: "UPDATED FULL END", exact: true }),
    ).toHaveCount(1);
  });
}
test("whole large document preserves reference definitions, JSX, Unicode and JS compatibility", async ({
  page,
}) => {
  test.setTimeout(180000);
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const source =
    '# Cross-document semantics\n\n[far reference][far]\n\n<Callout title="跨文档">\n\n' +
    "中文正文 ".repeat(80000) +
    "\n\n</Callout>\n\n[far]: https://example.com/full\n\nTail[^note]\n\n[^note]: Complete footnote\n\n<Counter />\n";
  await open(page, source);
  await page.locator("#pause").click();
  const frame = await ready(page);
  await expect(
    frame.getByRole("link", { name: "far reference", exact: true }),
  ).toHaveAttribute("href", "https://example.com/full");
  await expect(frame.locator(".callout strong")).toHaveText("跨文档");
  await expect(frame.locator("#root")).toContainText("Complete footnote");
  await expect(
    frame.getByRole("button", { name: "Clicked 0 times" }),
  ).toHaveCount(1);
});
test("cancel large compilation, open another document and never accept an old result", async ({
  page,
}) => {
  test.setTimeout(60000);
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await ready(page);
  await open(page, "# OLD\n\n" + "**dense** {1 + 2}\n\n".repeat(150000));
  await page.locator("#pause").click();
  await expect(page.locator("#compile-status")).toHaveAttribute(
    "data-state",
    "compiling",
  );
  await page.locator("#pause").click();
  await open(page, "# NEW DOCUMENT\n\n<Counter />", "new.mdx");
  await page.locator("#pause").click();
  const frame = await ready(page);
  await expect(frame.getByRole("heading")).toHaveText("NEW DOCUMENT");
  await page.waitForTimeout(1500);
  await expect(frame.getByRole("heading")).toHaveText("NEW DOCUMENT");
});
