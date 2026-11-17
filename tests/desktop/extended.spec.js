import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const hash = (s) => createHash("sha256").update(s).digest("hex");
async function launch() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "ink-extended-"));
  const args = process.env.INKSTONE_EXECUTABLE ? [] : [path.resolve(".")];
  args.push("--user-data-dir=" + profile);
  if (process.env.INKSTONE_SYSTEM_IME === "1")
    args.push("--ozone-platform=x11", "--gtk-version=3");
  if (process.platform === "linux") args.push("--no-sandbox");
  const app = await electron.launch({
    executablePath: process.env.INKSTONE_EXECUTABLE || undefined,
    args,
  });
  const page = await app.firstWindow();
  await app.evaluate(({ dialog, BrowserWindow }) => {
    dialog.showMessageBoxSync = () => 1;
    const w = BrowserWindow.getAllWindows()[0];
    w.show();
    w.focus();
  });
  return { app, page, profile };
}
async function close(app, profile) {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
  );
  await app.close();
  await fs.rm(profile, { recursive: true, force: true });
}
test("near-5-MiB native edit save copy and reload", async () => {
  test.setTimeout(120000);
  const { app, page, profile } = await launch();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ink-large-"));
  const file = path.join(dir, "large.mdx"),
    copy = path.join(dir, "copy.mdx");
  try {
    const unit = "中文大文件保存与恢复。\n";
    const source = unit.repeat(
      Math.floor((5 * 1024 * 1024 - 4096) / Buffer.byteLength(unit)),
    );
    await fs.writeFile(file, source);
    await app.evaluate(
      ({ dialog }, { file, copy }) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: copy,
        });
      },
      { file, copy },
    );
    await page.locator("#open").click();
    await expect(page.locator("#file-name")).toHaveText("large.mdx");
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.locator(".cm-content").focus();
    await page.keyboard.press("ControlOrMeta+End");
    for (let i = 0; i < 20; i++) await page.keyboard.insertText("中");
    const expected = source + "中".repeat(20);
    await page.locator("#save").click();
    await expect
      .poll(async () => hash(await fs.readFile(file, "utf8")))
      .toBe(hash(expected));
    await page.locator("#copy").click();
    await expect
      .poll(async () => {
        try {
          return hash(await fs.readFile(copy, "utf8"));
        } catch {
          return "";
        }
      })
      .toBe(hash(expected));
    await page.reload();
    await expect(page.locator("#notice")).toContainText("Recovered your last");
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("inkstone.draft.v1")).source.length,
      ),
    ).toBe(expected.length);
    await expect(page.locator("iframe")).toHaveCount(0);
    console.log(
      "NATIVE_LARGE_FILE",
      JSON.stringify({
        platform: process.platform,
        bytes: Buffer.byteLength(expected),
        sha256: hash(expected),
        packaged: !!process.env.INKSTONE_EXECUTABLE,
      }),
    );
  } finally {
    await close(app, profile);
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("real Linux IBus libpinyin system IME via X11 keys", async () => {
  test.skip(
    process.env.INKSTONE_SYSTEM_IME !== "1",
    "Requires a real IBus/X11 session; not replaced with simulated text.",
  );
  const { app, page, profile } = await launch();
  try {
    await page.locator("#pause").click();
    await page.locator(".cm-content").click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    expect(execFileSync("ibus", ["engine"], { encoding: "utf8" }).trim()).toBe(
      "libpinyin",
    );
    execFileSync("xdotool", [
      "type",
      "--clearmodifiers",
      "--delay",
      "120",
      "nihao",
    ]);
    execFileSync("xdotool", ["key", "space"]);
    await expect
      .poll(
        () =>
          page.evaluate(
            () => JSON.parse(localStorage.getItem("inkstone.draft.v1")).source,
          ),
        { timeout: 15000 },
      )
      .toBe("你好");
    await page.screenshot({ path: "docs/desktop-system-ime.png" });
    console.log(
      "SYSTEM_IME",
      JSON.stringify({
        platform: "Linux",
        engine: "IBus libpinyin",
        input: "X11-injected key events nihao + space",
        result: "你好",
        humanManual: false,
      }),
    );
  } finally {
    await close(app, profile);
  }
});
