import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import http from "node:http";
test("native project preview, npm state, isolation, saves, errors and revoke", async () => {
  let requests = 0;
  const server = http.createServer((_req, res) => {
    requests++;
    res.end("Unexpected external request");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const probeURL = `http://127.0.0.1:${server.address().port}/escape`;
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
        dialog.showMessageBox = async () => ({ response: 0 });
        dialog.showMessageBoxSync = () => 1;
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: file.replace(/index\.mdx$/, "recovered.mdx"),
        });
      },
      { project, file },
    );
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      win.focus();
    });
    const page = await app.firstWindow();
    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await expect(
      page
        .frameLocator("iframe")
        .getByRole("heading", { name: "A little space to think." }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Inkstone home" }).click();
    await page.locator("#project-open").click();
    await expect(page.locator("#project-status")).toContainText(
      "No trusted workspace",
    );
    expect(
      await page.evaluate(async () => {
        try {
          await window.inkstoneDesktop.compile("# denied");
          return false;
        } catch {
          return true;
        }
      }),
    ).toBe(true);
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1 });
    });
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
    await preview.evaluate((url) => {
      const a = document.createElement("a");
      a.href = url;
      a.textContent = "Navigation probe";
      document.body.append(a);
    }, probeURL);
    await frame.getByRole("link", { name: "Navigation probe" }).click();
    expect(page.url().split("#")[0]).toBe("inkstone://app/index.html");
    await page.locator("#project-rebuild").click();
    await expect(
      frame.getByRole("button", { name: "Project component: 0" }),
    ).toBeVisible();
    expect(requests).toBe(0);
    const editor = page.locator(".cm-content");
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
    await page.locator("#copy").click();
    await expect
      .poll(async () => {
        try {
          return await fs.readFile(path.join(project, "recovered.mdx"), "utf8");
        } catch (e) {
          if (e.code === "ENOENT") return "";
          throw e;
        }
      })
      .toContain("conflicting");
    expect(await fs.readFile(file, "utf8")).toBe("external version");
    await replace("import Nope from './missing.jsx'\n\n<Nope />");
    await expect(page.locator("#preview-error")).toBeVisible();
    await expect(editor).toContainText("missing.jsx");
    await replace(source);
    await expect(
      frame.getByRole("button", { name: "Project component: 0" }),
    ).toBeVisible();
    await page.reload();
    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator("#project-status")).toContainText(
      "No trusted workspace",
    );
    await expect(editor).toContainText("Welcome");
    await page.locator("#project-open").click();
    await expect(page.locator("#project-status")).toContainText(
      "Trusted this session",
    );
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
    await page.locator("#language").selectOption("zh-CN");
    await expect(page.locator("#preview-error")).toContainText("网页版不支持");
    await expect
      .poll(() =>
        app.evaluate(({ Menu }) =>
          Menu.getApplicationMenu().items.map((item) => item.label),
        ),
      )
      .toContain("文件");
    await app.evaluate(({ dialog }) => {
      globalThis.lastTrust = null;
      globalThis.lastSave = null;
      dialog.showMessageBox = async (_w, options) => {
        globalThis.lastTrust = options;
        return { response: 1 };
      };
      dialog.showSaveDialog = async (_w, options) => {
        globalThis.lastSave = options;
        return { canceled: true };
      };
    });
    await page.locator("#project-open").click();
    await expect(page.locator("#project-status")).toContainText(
      "本次会话已信任",
    );
    expect(await app.evaluate(() => globalThis.lastTrust.message)).toBe(
      "是否信任此工作区及其依赖？",
    );
    await page.locator("#open").click();
    await replace(source + "\n\n中文保存验证");
    await page.getByRole("button", { name: "运行预览" }).click();
    await expect(
      page
        .frameLocator("iframe")
        .getByRole("button", { name: "Project component: 0" }),
    ).toBeVisible();
    await page.locator("#save").click();
    await expect(page.locator("#notice")).toContainText("已保存到磁盘");
    await page.locator("#copy").click();
    expect(await app.evaluate(() => globalThis.lastSave.title)).toBe("另存为");
    await page.screenshot({ path: "docs/desktop-chinese.png" });
    await page.reload();
    await expect(page.locator("#language")).toHaveValue("zh-CN");
    await expect(page.locator("#notice")).toContainText("已恢复上次的草稿");
    await page.locator("#language").selectOption("en");
    await expect(
      page.getByRole("textbox", { name: "MDX source editor" }),
    ).toContainText("中文保存验证");
  } finally {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(userData, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});
