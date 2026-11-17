import { test, expect } from "@playwright/test";
async function replace(page, source) {
  const editor = page.getByRole("textbox", { name: "MDX source editor" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(source);
}
test("real JSX, component state, split modes and mobile layout", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: "A little space to think." }),
  ).toBeVisible();
  await frame.getByRole("button", { name: "Clicked 0 times" }).click();
  await expect(
    frame.getByRole("button", { name: "Clicked 1 times" }),
  ).toBeVisible();
  const line = await page.locator(".cm-line").first().boundingBox();
  const number = await page
    .locator(".cm-lineNumbers .cm-gutterElement")
    .filter({ hasText: /^1$/ })
    .boundingBox();
  expect(Math.abs(line.y - number.y)).toBeLessThanOrEqual(2);
  await page.screenshot({
    path: `docs/workspace-${testInfo.project.name}.png`,
  });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".source-pane")).toBeHidden();
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `docs/mobile-${testInfo.project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
test("syntax errors retain last good preview, recover draft and render runtime errors", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.frameLocator("iframe").getByRole("heading", { level: 1 }).first(),
  ).toBeVisible();
  await replace(page, "<Broken>");
  await expect(page.locator("#preview-error")).toBeVisible();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { level: 1 }).first(),
  ).toHaveText("A little space to think.");
  await replace(page, "# Recovered\n\n{2 + 3}");
  await expect(
    page.frameLocator("iframe").getByRole("heading", { level: 1 }),
  ).toHaveText("Recovered");
  page.on("dialog", (d) => d.accept());
  await page.reload();
  await expect(page.locator("#notice")).toContainText("Recovered your last");
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Run preview" }).click();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { level: 1 }),
  ).toHaveText("Recovered");
  await replace(page, "{unknownVariable}");
  await expect(page.frameLocator("iframe").locator("#root")).toContainText(
    "Runtime error",
  );
});
test("sandbox blocks parent DOM, storage, fetch, and has no app bridge", async ({
  page,
}) => {
  await page.goto("/");
  await replace(
    page,
    `{(() => { let a,b; try { a=parent.document.body.innerHTML } catch { a='parent blocked' } try { localStorage.setItem('escape','yes'); b='bad' } catch { b='storage blocked' } return a+' / '+b+' / '+typeof window.require })()}`,
  );
  await expect(page.frameLocator("iframe").locator("#root")).toContainText(
    "parent blocked / storage blocked / undefined",
  );
  expect(await page.locator("iframe").getAttribute("sandbox")).toBe(
    "allow-scripts",
  );
  const frame = page.frames().find((f) => f !== page.mainFrame());
  expect(
    await frame.evaluate(async () => {
      try {
        await fetch("https://example.com");
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("escape"))).toBe(null);
});
test("open Unicode file and download exact source in fallback browsers", async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete window.showOpenFilePicker;
    delete window.showSaveFilePicker;
  });
  await page.goto("/");
  await page.locator("#file-input").setInputFiles({
    name: "hello.mdx",
    mimeType: "text/plain",
    buffer: Buffer.from("# 你好 🌱\n\n<Badge>新</Badge>"),
  });
  await expect(page.locator("#file-name")).toHaveText("hello.mdx");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save a copy" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("hello.mdx");
  const stream = await download.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk;
  expect(text).toBe("# 你好 🌱\n\n<Badge>新</Badge>");
});
test("failed native save retains dirty source", async ({ page }) => {
  await page.addInitScript(() => {
    window.showSaveFilePicker = async () => ({
      name: "saved.mdx",
      getFile: async () => ({ text: async () => "" }),
      createWritable: async () => ({
        write: async () => {
          throw Error("disk full");
        },
        abort: async () => {},
      }),
    });
  });
  await page.goto("/");
  await replace(page, "# Keep me");
  await page.getByRole("button", { name: /^Save ⌘/ }).click();
  await expect(page.locator("#notice")).toContainText("disk full");
  await expect(page.locator(".cm-content")).toContainText("Keep me");
  expect(await page.title()).toMatch(/^•/);
});
test("measure real input to next animation frame on 100 KB document", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const source = "# Paragraph\n\nA quiet line with **formatting**.\n\n".repeat(
    2200,
  );
  await page.locator("#file-input").setInputFiles({
    name: "benchmark.mdx",
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  });
  await expect(page.locator("#file-name")).toHaveText("benchmark.mdx");
  await expect(page.locator("iframe")).toHaveCount(0);
  const editor = page.getByRole("textbox", { name: "MDX source editor" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.evaluate(() => {
    window.inputSamples = [];
    document
      .querySelector(".cm-content")
      .addEventListener("beforeinput", () => {
        const start = performance.now();
        requestAnimationFrame(() =>
          window.inputSamples.push(performance.now() - start),
        );
      });
  });
  for (let i = 0; i < 20; i++) {
    await page.keyboard.insertText("a");
    await expect
      .poll(() => page.evaluate(() => window.inputSamples.length))
      .toBe(i + 1);
  }
  const values = await page.evaluate(() =>
    window.inputSamples.sort((a, b) => a - b),
  );
  const result = {
    bytes: Buffer.byteLength(source),
    samples: values.length,
    median: values[10],
    p95: values[18],
    preview: "paused",
    browser: "chromium",
  };
  console.log("INPUT_TO_FRAME_MS", JSON.stringify(result));
  await testInfo.attach("input-to-frame.json", {
    body: JSON.stringify(result),
    contentType: "application/json",
  });
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("inkstone.draft.v1")).source,
    ),
  ).toBe(source + "a".repeat(20));
});

test("opened files require explicit trust before executing preview", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#file-input").setInputFiles({
    name: "untrusted.mdx",
    mimeType: "text/plain",
    buffer: Buffer.from("# Opened\n\n{1+2}"),
  });
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("#compile-status")).toContainText("Paused");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Run preview" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Run preview" }).click();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { level: 1 }),
  ).toHaveText("Opened");
});

test("Chinese UI switches live, preserves source and undo, and persists after reload", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  page.on("dialog", (d) => d.accept());
  await replace(page, "# 中文文档\n\n<Badge>中文标签</Badge>\n\n<Counter />");
  await page.locator("#language").selectOption("zh-CN");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(
    page.getByRole("textbox", { name: "MDX 源码编辑器" }),
  ).toContainText("中文文档");
  await expect(
    page.getByRole("heading", { name: "让文字，拥有更多可能。" }),
  ).toBeVisible();
  await expect(
    page.frameLocator("iframe").getByRole("button", { name: "已点击 0 次" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "组件与帮助 ↗" }).click();
  await expect(
    page.getByRole("heading", { name: "让 Markdown 遇见组件。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭帮助" }).click();
  await page.screenshot({ path: `docs/chinese-${testInfo.project.name}.png` });
  const editor = page.getByRole("textbox", { name: "MDX 源码编辑器" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n\n新增文字");
  await page.locator("#language").selectOption("en");
  await page.getByRole("textbox", { name: "MDX source editor" }).click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    page.getByRole("textbox", { name: "MDX source editor" }),
  ).not.toContainText("新增文字");
  await page.locator("#language").selectOption("zh-CN");
  await page.reload();
  await expect(page.locator("#language")).toHaveValue("zh-CN");
  await expect(page.locator("#notice")).toContainText("已恢复上次的草稿");
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "运行预览" }).click();
  await replace(page, "import X from './missing.jsx'\n\n<X />");
  await expect(page.locator("#preview-error")).toContainText("网页版不支持");
  await page.locator("#language").selectOption("en");
  await expect(page.locator("#preview-error")).toContainText(
    "Imports and exports",
  );
  await page.locator("#language").selectOption("zh-CN");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: `docs/chinese-mobile-${testInfo.project.name}.png`,
  });
});
test("Chinese preference follows browser locale and survives unavailable preference storage", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "zh-CN" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4174");
  await expect(page.locator("#language")).toHaveValue("zh-CN");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("quota");
    };
  });
  await page.locator("#language").selectOption("en");
  await expect(page.locator("#notice")).toContainText(
    "Language preference could not be saved",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await context.close();
});
