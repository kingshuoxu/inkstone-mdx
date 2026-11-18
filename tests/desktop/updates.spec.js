import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { createHash } from "node:crypto";

test("native update menu checks, cancels, verifies a download without executing it", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "ink-updates-"));
  let requests = 0;
  const server = http.createServer((_req, res) => {
    requests++;
    res.end("main-fetch-ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const probe = `http://127.0.0.1:${server.address().port}/probe`;
  const destination = path.join(profile, "downloaded-installer.bin");
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
    expect(
      await app.evaluate(
        async (_electron, url) => (await fetch(url)).text(),
        probe,
      ),
    ).toBe("main-fetch-ok");
    expect(
      await page.evaluate(async (url) => {
        try {
          await fetch(url);
          return "allowed";
        } catch {
          return "blocked";
        }
      }, probe),
    ).toBe("blocked");
    expect(requests).toBe(1);
    const bytes = Buffer.alloc(1024 * 1024 + 8, 65);
    const digest = createHash("sha256").update(bytes).digest("hex");
    await app.evaluate(
      ({ dialog, shell }, { destination, digest, size }) => {
        globalThis.updateTest = {
          requests: [],
          messages: [],
          response: 0,
          version: "99.0.0",
          revealed: [],
        };
        dialog.showMessageBox = async (_win, options) => {
          globalThis.updateTest.messages.push(options);
          return { response: globalThis.updateTest.response };
        };
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: destination,
        });
        shell.showItemInFolder = (p) => globalThis.updateTest.revealed.push(p);
        shell.openExternal = async () => {
          throw Error("Browser must not open during this test");
        };
        globalThis.fetch = async (url) => {
          const state = globalThis.updateTest;
          state.requests.push(String(url));
          if (
            String(url) ===
            "https://api.github.com/repos/kingshuoxu/inkstone-mdx/releases/latest"
          ) {
            if (state.fail) throw Error("simulated offline");
            const suffix =
              process.platform === "darwin"
                ? `mac-${process.arch}.dmg`
                : process.platform === "win32"
                  ? "win-x64.exe"
                  : "linux-x86_64.AppImage";
            const name = `Inkstone-MDX-${state.version}-${suffix}`;
            return new Response(
              JSON.stringify({
                tag_name: "v" + state.version,
                draft: false,
                prerelease: false,
                html_url: `https://github.com/kingshuoxu/inkstone-mdx/releases/tag/v${state.version}`,
                assets: [
                  {
                    name,
                    size,
                    digest: "sha256:" + digest,
                    browser_download_url: `https://github.com/kingshuoxu/inkstone-mdx/releases/download/v${state.version}/${name}`,
                  },
                ],
              }),
              { headers: { "content-type": "application/json" } },
            );
          }
          return new Response(Buffer.alloc(size, 65), {
            headers: { "content-length": String(size) },
          });
        };
      },
      { destination, digest, size: bytes.length },
    );
    expect(
      await page.evaluate(() =>
        Object.keys(window.inkstoneDesktop).some((k) =>
          /update|download/i.test(k),
        ),
      ),
    ).toBe(false);
    expect(
      await app.evaluate(() => globalThis.updateTest.requests.length),
    ).toBe(0);
    const click = () =>
      app.evaluate(({ Menu }) =>
        Menu.getApplicationMenu().getMenuItemById("check-for-updates").click(),
      );
    const idle = () =>
      expect
        .poll(() =>
          app.evaluate(
            ({ Menu }) =>
              Menu.getApplicationMenu().getMenuItemById("check-for-updates")
                .enabled,
          ),
        )
        .toBe(true);
    await page.locator(".cm-content").click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.insertText("\n\nupdate-quit-cancel-regression");
    await app.evaluate(({ app, dialog }) => {
      dialog.showMessageBoxSync = () => {
        globalThis.quitPromptSeen = true;
        return 0;
      };
      app.quit();
    });
    await expect
      .poll(() => app.evaluate(() => globalThis.quitPromptSeen))
      .toBe(true);
    await expect(page.locator(".cm-content")).toContainText(
      "update-quit-cancel-regression",
    );
    await click();
    await idle();
    expect(
      await app.evaluate(() => globalThis.updateTest.requests.length),
    ).toBe(1);
    expect(await fs.stat(destination).catch(() => null)).toBe(null);
    await app.evaluate(() => {
      globalThis.updateTest.response = 1;
    });
    await click();
    await idle();
    expect(await fs.readFile(destination)).toEqual(bytes);
    expect(await app.evaluate(() => globalThis.updateTest.revealed)).toEqual([
      destination,
    ]);
    expect(
      await app.evaluate(() =>
        globalThis.updateTest.messages.some((x) =>
          /checksum verified/.test(x.message),
        ),
      ),
    ).toBe(true);
    await app.evaluate(() => {
      globalThis.updateTest.response = 0;
      globalThis.updateTest.fail = true;
    });
    await click();
    await idle();
    expect(
      await app.evaluate(() => globalThis.updateTest.messages.at(-1).message),
    ).toContain("failed");
    await expect(page.locator(".cm-content")).toBeVisible();
  } finally {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
    await fs.rm(profile, { recursive: true, force: true });
    await new Promise((resolve) => server.close(resolve));
  }
});
