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
    const readyMs = Date.now() - start;
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
      observedReadyMs: readyMs,
      ...metrics,
    };
    console.log("FULL_PREVIEW", JSON.stringify(timing));
    await writeFile(
      `docs/full-preview-${kind}.json`,
      JSON.stringify(timing, null, 2),
    );
    await page.locator(".cm-content").focus();
    await page.keyboard.press("ControlOrMeta+End");
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

test("large edits are batched and old preview stays visible until the latest full render", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    window.compileRequests = [];
    window.previewInputSamples = [];
    document.addEventListener("beforeinput", () => {
      const start = performance.now();
      requestAnimationFrame(() =>
        window.previewInputSamples.push(performance.now() - start),
      );
    });
    const Native = window.Worker;
    window.Worker = class extends Native {
      postMessage(data, ...rest) {
        if (
          data &&
          "id" in data &&
          typeof data.source === "string" &&
          !data.type
        )
          window.compileRequests.push(data.source.slice(-200));
        return super.postMessage(data, ...rest);
      }
    };
  });
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await ready(page);
  await open(
    page,
    "# BATCH START\n\n" + "batch content ".repeat(80000) + "\n\n# OLD TAIL\n",
  );
  await page.locator("#pause").click();
  const frame = await ready(page);
  await expect(
    frame.getByRole("heading", { name: "OLD TAIL", exact: true }),
  ).toHaveCount(1);
  await page.evaluate(() => {
    window.compileRequests = [];
    window.previewInputSamples = [];
  });
  await page.locator(".cm-content").focus();
  await page.keyboard.press("ControlOrMeta+End");
  for (let i = 0; i < 20; i++) {
    await page.keyboard.insertText(i === 0 ? "\n# BATCHED " : "x");
    await page.waitForTimeout(30);
  }
  expect(await page.evaluate(() => window.compileRequests.length)).toBe(0);
  await expect(
    frame.getByRole("heading", { name: "OLD TAIL", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator("#compile-status")).toHaveText("Waiting…");
  await ready(page);
  expect(await page.evaluate(() => window.compileRequests.length)).toBe(1);
  const samples = await page.evaluate(() =>
    window.previewInputSamples.slice().sort((a, b) => a - b),
  );
  console.log(
    "BATCHED_PREVIEW_INPUT",
    JSON.stringify({
      samples: samples.length,
      medianMs: samples[Math.floor(samples.length / 2)],
      p95Ms: samples[Math.floor(samples.length * 0.95)],
      context:
        "1.12 MB document, last full preview visible, edits coalesced until idle",
    }),
  );
  await expect(
    page
      .frameLocator("iframe:not([data-pending])")
      .getByRole("heading", { name: "BATCHED " + "x".repeat(19), exact: true }),
  ).toHaveCount(1);
});

test("edits during a delayed compile coalesce into one latest follow-up without stale publication", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    window.compileRequests = [];
    const Native = window.Worker;
    window.Worker = class extends Native {
      postMessage(data, ...rest) {
        if (
          data &&
          "id" in data &&
          typeof data.source === "string" &&
          !data.type
        )
          window.compileRequests.push(data.source.slice(-200));
        return super.postMessage(data, ...rest);
      }
      set onmessage(fn) {
        super.onmessage = (event) => {
          if (event.data.code && window.delayCompileResponse) {
            window.delayCompileResponse = false;
            setTimeout(() => fn(event), 3000);
          } else fn(event);
        };
      }
    };
  });
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await ready(page);
  await open(page, "# ASYNC OLD\n\n" + "complete text ".repeat(80000) + "\n");
  await page.locator("#pause").click();
  await ready(page);
  await page.evaluate(() => {
    window.compileRequests = [];
    window.delayCompileResponse = true;
  });
  await page.locator(".cm-content").focus();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n# INTERMEDIATE\n");
  await expect(page.locator("#compile-status")).toHaveAttribute(
    "data-state",
    "compiling",
  );
  for (let i = 0; i < 10; i++)
    await page.keyboard.insertText(i === 0 ? "\n# LATEST " : "z");
  await expect(
    page
      .frameLocator("iframe:not([data-pending])")
      .getByRole("heading", { name: "INTERMEDIATE", exact: true }),
  ).toHaveCount(0);
  await ready(page);
  expect(await page.evaluate(() => window.compileRequests.length)).toBe(2);
  await expect(
    page
      .frameLocator("iframe:not([data-pending])")
      .getByRole("heading", { name: "LATEST " + "z".repeat(9), exact: true }),
  ).toHaveCount(1);
});

test("a delayed render-ready message cannot replace a newer document after pause", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    if (window !== window.top) return;
    window.addEventListener(
      "message",
      (event) => {
        if (
          event.data?.type === "inkstone-preview" &&
          event.data.state === "ready" &&
          window.delayReady &&
          !event.data.delayed
        ) {
          window.delayReady = false;
          event.stopImmediatePropagation();
          setTimeout(
            () =>
              window.dispatchEvent(
                new MessageEvent("message", {
                  data: { ...event.data, delayed: true },
                  source: event.source,
                }),
              ),
            2500,
          );
        }
      },
      true,
    );
  });
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await ready(page);
  await page.evaluate(() => {
    window.delayReady = true;
  });
  await open(page, "# DELAYED RENDER\n\n" + "retained content ".repeat(40000));
  await page.locator("#pause").click();
  await expect(page.locator("#compile-status")).toHaveAttribute(
    "data-state",
    "rendering",
    { timeout: 30000 },
  );
  await page.locator("#pause").click();
  await open(page, "# NEW AFTER RENDER CANCEL", "new-render.mdx");
  await page.locator("#pause").click();
  const frame = await ready(page);
  await expect(frame.getByRole("heading")).toHaveText(
    "NEW AFTER RENDER CANCEL",
  );
  await page.waitForTimeout(3000);
  await expect(frame.getByRole("heading")).toHaveText(
    "NEW AFTER RENDER CANCEL",
  );
});

test("synchronous worker creation failure settles the large-file queue and can retry", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const Native = window.Worker;
    window.Worker = class extends Native {
      constructor(url, options) {
        if (window.failNextCompileWorker && /\/worker[-.]/.test(String(url))) {
          window.failNextCompileWorker = false;
          throw new Error("simulated worker resource failure");
        }
        super(url, options);
      }
    };
  });
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await ready(page);
  await open(page, "# RETRY LARGE\n\n" + "complete content ".repeat(40000));
  await page.evaluate(() => {
    window.failNextCompileWorker = true;
  });
  await page.locator("#pause").click();
  await expect(page.locator("#preview-error")).toContainText("Compiler failed");
  await page.locator(".cm-content").focus();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n\n# QUEUE RECOVERED\n");
  const frame = await ready(page);
  await expect(
    frame.getByRole("heading", { name: "QUEUE RECOVERED", exact: true }),
  ).toHaveCount(1);
});

test("small files still refresh promptly without exposing a scheduling mode", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await page.locator(".cm-content").focus();
  await page.keyboard.press("ControlOrMeta+a");
  const start = Date.now();
  await page.keyboard.insertText("# SMALL LIVE\n\n{2 + 3}");
  await expect(
    page
      .frameLocator("iframe:not([data-pending])")
      .getByRole("heading", { name: "SMALL LIVE", exact: true }),
  ).toBeVisible({ timeout: 1400 });
  expect(Date.now() - start).toBeLessThan(1500);
  await expect(page.locator("body")).not.toContainText("Changes queued");
});
