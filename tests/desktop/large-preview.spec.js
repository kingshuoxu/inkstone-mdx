import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

test("trusted desktop project renders the complete 5 MiB document and tail component", async () => {
  test.setTimeout(240000);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ink-large-preview-"));
  const profile = await fs.mkdtemp(
    path.join(os.tmpdir(), "ink-large-profile-"),
  );
  const file = path.join(root, "large.mdx");
  const prefix = "# Complete desktop document\n\n";
  const suffix = "\n\n## END-OF-FULL-DOCUMENT\n\n<Counter />\n";
  const budget = 5 * 1024 * 1024 - Buffer.byteLength(prefix + suffix);
  const paragraph = "whole document ".repeat(270) + "\n\n";
  const filler =
    paragraph.repeat(Math.floor(budget / paragraph.length)) +
    "x".repeat(budget % paragraph.length);
  const source = prefix + filler + suffix;
  expect(Buffer.byteLength(source)).toBe(5 * 1024 * 1024);
  await fs.writeFile(file, source);
  const args = process.env.INKSTONE_EXECUTABLE ? [] : [path.resolve(".")];
  args.push("--user-data-dir=" + profile);
  if (process.platform === "linux") args.push("--no-sandbox");
  const app = await electron.launch({
    executablePath: process.env.INKSTONE_EXECUTABLE || undefined,
    args,
  });
  try {
    await app.evaluate(
      ({ dialog }, { root, file }) => {
        dialog.showOpenDialog = async (_win, options) => ({
          canceled: false,
          filePaths: [
            options.properties.includes("openDirectory") ? root : file,
          ],
        });
        dialog.showMessageBox = async () => ({ response: 1 });
        dialog.showMessageBoxSync = () => 1;
      },
      { root, file },
    );
    const page = await app.firstWindow();
    await page.locator("#language").selectOption("en");
    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.locator("#project-open").click();
    await page.locator("#open").click();
    await expect(page.locator("iframe")).toHaveCount(0);
    const start = Date.now();
    await page.locator("#pause").click();
    const frame = page.frameLocator("iframe:not([data-pending])");
    await expect(
      frame.getByRole("heading", { name: "END-OF-FULL-DOCUMENT" }),
    ).toBeAttached({ timeout: 150000 });
    await expect(
      frame.getByRole("heading", { name: "Complete desktop document" }),
    ).toBeAttached();
    const counter = frame.getByRole("button", { name: "Clicked 0 times" });
    await counter.scrollIntoViewIfNeeded();
    await counter.click();
    await expect(
      frame.getByRole("button", { name: "Clicked 1 times" }),
    ).toBeVisible();
    console.log(
      JSON.stringify({
        desktopFullPreviewBytes: Buffer.byteLength(source),
        fullPreviewMs: Date.now() - start,
      }),
    );
    await page.screenshot({ path: "docs/desktop-large-preview.png" });
    // Cancellation must settle even if it happens during asynchronous path validation.
    expect(
      await page.evaluate(async () => {
        const pending = window.inkstoneDesktop.compile("# cancelled").then(
          () => "unexpected-success",
          () => "cancelled",
        );
        await window.inkstoneDesktop.cancelCompile();
        return pending;
      }),
    ).toBe("cancelled");
    // Cancelling compilation must not discard the last good rendered document.
    await expect(
      frame.getByRole("heading", { name: "END-OF-FULL-DOCUMENT" }),
    ).toBeAttached();
    await page.locator("#project-revoke").click();
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(
      await page.evaluate(async () => {
        try {
          await window.inkstoneDesktop.compile("# forbidden");
          return false;
        } catch {
          return true;
        }
      }),
    ).toBe(true);
  } finally {
    await app.close();
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(profile, { recursive: true, force: true });
  }
});
