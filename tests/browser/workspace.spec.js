import { test, expect } from "@playwright/test";

test("splitter follows the pointer and works with the keyboard without resetting preview", async ({
  page,
}) => {
  await page.goto("/");
  const splitter = page.getByRole("separator", {
    name: "Resize source and preview",
  });
  const preview = page.frameLocator("iframe:not([data-pending])");
  await expect(
    preview.getByRole("heading", { name: "A little space to think." }),
  ).toBeVisible();

  await expect(splitter).toHaveAttribute("aria-valuenow", "50");
  const box = await splitter.boundingBox();
  const x = box.x + 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const source = page.locator("#source-pane");
  const initialWidth = (await source.boundingBox()).width;
  await page.mouse.move(x + 150, y, { steps: 6 });
  expect((await source.boundingBox()).width).toBeGreaterThan(
    initialWidth + 120,
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(splitter).toHaveAttribute("aria-valuenow", "50");
  await expect(page.locator(".panes")).not.toHaveAttribute("data-resizing", "");

  await splitter.focus();
  await splitter.press("Shift+ArrowRight");
  await expect(splitter).toHaveAttribute("aria-valuenow", "60");
  await splitter.press("End");
  await expect(splitter).toHaveAttribute("aria-valuenow", "75");
  await splitter.press("Home");
  await expect(splitter).toHaveAttribute("aria-valuenow", "25");
  await splitter.press("Enter");
  await expect(splitter).toHaveAttribute("aria-valuenow", "50");

  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(splitter).toBeHidden();
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await expect(splitter).toBeVisible();
  await expect(
    preview.getByRole("heading", { name: "A little space to think." }),
  ).toBeVisible();
});

test("narrow Chinese workspace keeps source, preview and help reachable", async ({
  browser,
  baseURL,
}) => {
  const page = await browser.newPage({
    locale: "zh-CN",
    viewport: { width: 360, height: 760 },
  });
  try {
    await page.goto(baseURL);
    await expect(page.locator(".panes")).toHaveAttribute("data-mode", "source");
    await expect(page.locator("#splitter")).toBeHidden();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);

    const help = page.getByRole("button", { name: "组件与帮助", exact: true });
    await help.click();
    await expect(
      page.getByRole("dialog", { name: "让 Markdown 遇见组件。" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeFocused();

    await page.getByRole("button", { name: "预览", exact: true }).click();
    await expect(page.locator(".panes")).toHaveAttribute(
      "data-mode",
      "preview",
    );
    await expect(page.locator("iframe:not([data-pending])")).toBeVisible();
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator(".panes")).toHaveAttribute(
      "data-mode",
      "preview",
    );
  } finally {
    await page.close();
  }
});
