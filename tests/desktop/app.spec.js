import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
test("native project preview, npm state, isolation, saves, errors and revoke", async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), "ink-electron-"));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "ink-project-"));
  await fs.cp(path.resolve("examples/project"), project, { recursive: true });
  const file = path.join(project, "index.mdx");
  const source = await fs.readFile(file, "utf8");
  const args = process.env.INKSTONE_EXECUTABLE ? [] : [path.resolve(".")];
  args.push("--user-data-dir=" + userData);
  if (process.platform === "linux") args.push("--no-sandbox"); // CI container only; installed app never adds this.
  const app = await electron.launch({
    executablePath: process.env.INKSTONE_EXECUTABLE || undefined,
    args,
  });
  try {
    await app.evaluate(
      ({ dialog }, { project, file }) => {
        dialog.showOpenDialog = async (_win, opts) => ({
          canceled: false,
          filePaths: [
            opts.properties.includes("openDirectory") ? project : file,
          ],
        });
        dialog.showMessageBox = async () => ({ response: 1 });
      },
      { project, file },
    );
    const page = await app.firstWindow();
    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await expect(
      page
        .frameLocator("iframe")
        .getByRole("heading", { name: "A little space to think." }),
    ).toBeVisible();
    await page.locator("#project-open").click();
    await expect(page.locator("#project-status")).toContainText(
      "Trusted this session",
    );
    await page.locator("#open").click();
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.getByRole("button", { name: "Run preview" }).click();
    const frame = page.frameLocator("iframe");
    await expect(
      frame.getByRole("button", { name: "Project component: 0" }),
    ).toBeVisible();
    await frame.getByRole("button", { name: "Project component: 0" }).click();
    await expect(
      frame.getByRole("button", { name: "Project component: 1" }),
    ).toBeVisible();
    await page.screenshot({ path: "docs/desktop-project.png" });
    const preview = page.frames().find((f) => f !== page.mainFrame());
    expect(
      await preview.evaluate(async () => {
        let parentBlocked = false,
          networkBlocked = false;
        try {
          void parent.document.body;
        } catch {
          parentBlocked = true;
        }
        try {
          await fetch("https://example.com");
        } catch {
          networkBlocked = true;
        }
        return {
          parentBlocked,
          networkBlocked,
          bridge: typeof window.inkstoneDesktop,
          node: typeof process,
          require: typeof require,
        };
      }),
    ).toEqual({
      parentBlocked: true,
      networkBlocked: true,
      bridge: "undefined",
      node: "undefined",
      require: "undefined",
    });
    const editor = page.getByRole("textbox", { name: "MDX source editor" });
    async function replace(text) {
      await editor.click();
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.insertText(text);
    }
    await replace(source + "\n\nSaved 中文");
    await page.locator("#save").click();
    await expect.poll(() => fs.readFile(file, "utf8")).toContain("Saved 中文");
    await fs.writeFile(file, "external version");
    await replace(source + "\n\nconflicting");
    await page.locator("#save").click();
    await expect(page.locator("#notice")).toContainText("changed on disk");
    expect(await fs.readFile(file, "utf8")).toBe("external version");
    await replace("import Nope from './missing.jsx'\n\n<Nope />");
    await expect(page.locator("#preview-error")).toBeVisible();
    await expect(editor).toContainText("missing.jsx");
    await replace(source);
    await expect(
      frame.getByRole("button", { name: "Project component: 0" }),
    ).toBeVisible();
    await page.locator("#project-revoke").click();
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator("#project-status")).toContainText(
      "No trusted workspace",
    );
    expect(
      await page.evaluate(async () => {
        try {
          await window.inkstoneDesktop.compile("# test");
          return false;
        } catch {
          return true;
        }
      }),
    ).toBe(true);
    await page.getByRole("button", { name: "Run preview" }).click();
    await expect(page.locator("#preview-error")).toBeVisible();
  } finally {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
    await fs.rm(userData, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});
