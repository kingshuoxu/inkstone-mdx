import { test, expect } from "@playwright/test";
async function replace(page, source) {
  await page.locator(".cm-content").fill(source);
}
test("real JSX, component state, split modes and mobile layout", async ({
  page,
}) => {
  await page.goto("/");
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: "A little space to think." }),
  ).toBeVisible();
  await frame.getByRole("button", { name: "Clicked 0 times" }).click();
  await expect(
    frame.getByRole("button", { name: "Clicked 1 times" }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/workspace.png" });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".source-pane")).toBeHidden();
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
test("syntax errors retain last good preview, recover draft and render runtime errors", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.frameLocator("iframe").getByRole("heading").first(),
  ).toBeVisible();
  await replace(page, "<Broken>");
  await expect(page.locator("#preview-error")).toBeVisible();
  await expect(
    page.frameLocator("iframe").getByRole("heading").first(),
  ).toHaveText("A little space to think.");
  await replace(page, "# Recovered\n\n{2 + 3}");
  await expect(page.frameLocator("iframe").getByRole("heading")).toHaveText(
    "Recovered",
  );
  page.on("dialog", (d) => d.accept());
  await page.reload();
  await expect(page.locator("#notice")).toContainText("Recovered your last");
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Run preview" }).click();
  await expect(page.frameLocator("iframe").getByRole("heading")).toHaveText(
    "Recovered",
  );
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
test("measure input handler to next animation frame on 100 KB document", async ({
  page,
}) => {
  await page.goto("/");
  await replace(
    page,
    "# Paragraph\n\nA quiet line with **formatting**.\n\n".repeat(2200),
  );
  const values = [];
  for (let i = 0; i < 20; i++) {
    values.push(
      await page.evaluate(async () => {
        const el = document.querySelector(".cm-content");
        const start = performance.now();
        el.dispatchEvent(
          new InputEvent("beforeinput", {
            inputType: "insertText",
            data: "a",
            bubbles: true,
            cancelable: true,
          }),
        );
        document.execCommand("insertText", false, "a");
        await new Promise(requestAnimationFrame);
        return performance.now() - start;
      }),
    );
  }
  values.sort((a, b) => a - b);
  console.log(
    "INPUT_TO_FRAME_MS",
    JSON.stringify({ median: values[10], p95: values[18], samples: 20 }),
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#compile-status")).toHaveText("Paused");
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
  await expect(page.frameLocator("iframe").getByRole("heading")).toHaveText(
    "Opened",
  );
});
