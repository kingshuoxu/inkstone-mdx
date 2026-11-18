import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

test("native Help shortcuts use fixed URLs, localize and recover from failure", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "ink-links-"));
  const args = process.env.INKSTONE_EXECUTABLE ? [] : [path.resolve(".")];
  args.push("--user-data-dir=" + profile);
  if (process.platform === "linux") args.push("--no-sandbox");
  const app = await electron.launch({
    executablePath: process.env.INKSTONE_EXECUTABLE || undefined,
    args,
  });
  try {
    const page = await app.firstWindow();
    await page.locator("#language").selectOption("en");
    await app.evaluate(({ shell, dialog }) => {
      globalThis.projectLinkTest = { opened: [], errors: [], fail: false };
      shell.openExternal = async (url) => {
        if (globalThis.projectLinkTest.fail) throw Error("simulated failure");
        globalThis.projectLinkTest.opened.push(url);
      };
      dialog.showMessageBox = async (_window, options) => {
        globalThis.projectLinkTest.errors.push(options.message);
        return { response: 0 };
      };
    });
    const click = (id) =>
      app.evaluate(
        ({ Menu }, id) => Menu.getApplicationMenu().getMenuItemById(id).click(),
        id,
      );
    await click("project-repository");
    await click("project-issue");
    await expect
      .poll(() => app.evaluate(() => globalThis.projectLinkTest.opened))
      .toEqual([
        "https://github.com/kingshuoxu/inkstone-mdx",
        "https://github.com/kingshuoxu/inkstone-mdx/issues/new",
      ]);
    expect(
      await page.evaluate(() =>
        Object.keys(window.inkstoneDesktop).some((key) =>
          /external|repository|issue/i.test(key),
        ),
      ),
    ).toBe(false);
    await page.locator("#language").selectOption("zh-CN");
    expect(
      await app.evaluate(({ Menu }) =>
        Menu.getApplicationMenu().getMenuItemById("project-issue").label,
      ),
    ).toBe("反馈问题…");
    await app.evaluate(() => {
      globalThis.projectLinkTest.fail = true;
    });
    await click("project-issue");
    await expect
      .poll(() => app.evaluate(() => globalThis.projectLinkTest.errors))
      .toEqual(["无法打开浏览器，请重试。"]);
    await app.evaluate(() => {
      globalThis.projectLinkTest.fail = false;
    });
    await click("project-issue");
    await expect
      .poll(() => app.evaluate(() => globalThis.projectLinkTest.opened.length))
      .toBe(3);
    await expect(page.locator(".cm-content")).toBeVisible();
  } finally {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((window) => window.destroy()),
    );
    await app.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
