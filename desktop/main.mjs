import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  session,
  Menu,
} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import {
  atomicSave,
  readDocument,
  checkedPath,
  isInside,
  checkedSource,
} from "./files.mjs";
import { normalizeLanguage, translate, translateError } from "../src/i18n.js";
let language = "en";
const t = (key) => translate(language, key);
function updateMenu() {
  const role = (label, role) => ({ label: t(label), role });
  const template = [
    {
      label: t("File"),
      submenu: [role("Close window", "close"), role("Quit", "quit")],
    },
    {
      label: t("Edit"),
      submenu: [
        role("Undo", "undo"),
        role("Redo", "redo"),
        { type: "separator" },
        role("Cut", "cut"),
        role("Copy", "copy"),
        role("Paste", "paste"),
        role("Select all", "selectAll"),
      ],
    },
    {
      label: t("View"),
      submenu: [
        role("Reload", "reload"),
        role("Reset zoom", "resetZoom"),
        role("Zoom in", "zoomIn"),
        role("Zoom out", "zoomOut"),
        role("Toggle fullscreen", "togglefullscreen"),
      ],
    },
    {
      label: t("Window"),
      submenu: [role("Minimize", "minimize"), role("Close window", "close")],
    },
  ];
  if (process.platform === "darwin")
    template.unshift({
      label: "Inkstone MDX",
      submenu: [
        role("About Inkstone MDX", "about"),
        role("Hide Inkstone MDX", "hide"),
        role("Hide others", "hideOthers"),
        role("Show all", "unhide"),
        role("Quit", "quit"),
      ],
    });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const HOST = "inkstone://app/index.html";
let window,
  workspace = null,
  document = null,
  preview = null,
  compiling = null,
  epoch = 0;
protocol.registerSchemesAsPrivileged([
  {
    scheme: "inkstone",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  { scheme: "inkstone-preview", privileges: { standard: true, secure: true } },
]);
function validate(event) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    event.senderFrame.url.split("#")[0] !== HOST
  )
    throw Error("Only the application main frame may use this operation.");
}
function cancelCompile() {
  epoch++;
  compiling?.terminate();
  compiling = null;
  preview = null;
}
function register(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    validate(event);
    try {
      return await fn(...args);
    } catch (error) {
      throw Error(translateError(language, error.message));
    }
  });
}
async function pickDocument() {
  const r = await dialog.showOpenDialog(window, {
    properties: ["openFile"],
    title: t("Open"),
    buttonLabel: t("Open"),
    defaultPath: workspace || undefined,
    filters: [
      { name: t("MDX documents"), extensions: ["mdx", "md", "markdown"] },
    ],
  });
  if (r.canceled) return null;
  const next = await readDocument(r.filePaths[0]);
  if (workspace) await checkedPath(workspace, next.path);
  cancelCompile();
  document = next;
  return {
    name: next.name,
    source: next.source,
    project: workspace ? path.basename(workspace) : null,
  };
}
async function boot() {
  await app.whenReady();
  language = normalizeLanguage(app.getLocale());
  updateMenu();
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  );
  ses.setPermissionCheckHandler(() => false);
  ses.on("will-download", (event) => event.preventDefault());
  ses.webRequest.onBeforeRequest((details, callback) => {
    const u = new URL(details.url);
    callback({
      cancel: !["inkstone:", "inkstone-preview:", "devtools:"].includes(
        u.protocol,
      ),
    });
  });
  protocol.handle("inkstone", async (request) => {
    const u = new URL(request.url);
    if (u.host !== "app") return new Response("Not found", { status: 404 });
    const target = path.resolve(
      appRoot,
      "dist",
      "." + decodeURIComponent(u.pathname),
    );
    if (!isInside(path.join(appRoot, "dist"), target))
      return new Response("Forbidden", { status: 403 });
    const mime =
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
      }[path.extname(target)] || "application/octet-stream";
    let bytes;
    try {
      bytes = await fs.readFile(target);
    } catch {
      return new Response("Not found", { status: 404 });
    }
    const response = new Response(bytes, { headers: { "Content-Type": mime } });
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; frame-src inkstone-preview:; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'",
    );
    return response;
  });
  protocol.handle("inkstone-preview", (request) => {
    if (!preview || request.url !== preview.url)
      return new Response("Preview expired", { status: 404 });
    return new Response(preview.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  });
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 760,
    minHeight: 540,
    title: "Inkstone MDX",
    backgroundColor: "#f7f5f0",
    webPreferences: {
      preload: path.join(appRoot, "desktop/preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webviewTag: false,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-frame-navigate", (event) => {
    if (event.isMainFrame || event.url !== preview?.url) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.on("did-navigate", () => {
    cancelCompile();
    workspace = null;
    document = null;
  });
  window.webContents.on("will-prevent-unload", (event) => {
    const response = dialog.showMessageBoxSync(window, {
      type: "warning",
      buttons: [t("Keep editing"), t("Discard and continue")],
      defaultId: 0,
      cancelId: 0,
      message: t("This document has unsaved changes."),
      detail: t(
        "Save your file or keep editing. A browser recovery draft is not a backup.",
      ),
    });
    if (response === 1) event.preventDefault();
  });
  register("settings:language", (value) => {
    if (!["en", "zh-CN"].includes(value)) throw Error("Invalid language");
    language = value;
    updateMenu();
    return language;
  });
  register("document:open", pickDocument);
  register("workspace:open", async () => {
    const r = await dialog.showOpenDialog(window, {
      properties: ["openDirectory"],
      title: t("Open project"),
      buttonLabel: t("Open project"),
    });
    if (r.canceled) return null;
    const root = await fs.realpath(r.filePaths[0]);
    const trust = await dialog.showMessageBox(window, {
      type: "warning",
      buttons: [t("Cancel"), t("Trust for this session")],
      defaultId: 0,
      cancelId: 0,
      message: t("Trust this workspace and its dependencies?"),
      detail:
        root +
        "\n\nImports may read files anywhere inside this folder, including installed dependencies, and execute JavaScript in the preview. Only trust code you reviewed. No install scripts or project build plugins are run. Preview code may consume CPU/memory. Trust ends when you revoke it or close the app.",
    });
    if (trust.response !== 1) return null;
    cancelCompile();
    workspace = root;
    document = null;
    return { project: path.basename(root) };
  });
  register("workspace:revoke", () => {
    cancelCompile();
    workspace = null;
    return true;
  });
  register("document:save", async ({ source, copy }) => {
    checkedSource(source);
    let target = document?.path,
      baseline = document?.source ?? null;
    if (copy || !target) {
      const r = await dialog.showSaveDialog(window, {
        defaultPath: target || "untitled.mdx",
        title: t(copy ? "Save a copy" : "Save"),
        buttonLabel: t("Save"),
        filters: [{ name: t("MDX document"), extensions: ["mdx"] }],
      });
      if (r.canceled) return null;
      target = r.filePath;
      try {
        baseline = await fs.readFile(target, "utf8");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
        baseline = null;
      }
    }
    await atomicSave(target, source, baseline);
    document = { path: target, name: path.basename(target), source };
    return { name: document.name };
  });
  register("workspace:compile", async (source) => {
    checkedSource(source);
    if (!workspace || !document)
      throw Error("Trust a workspace and open its MDX file first.");
    const file = await checkedPath(workspace, document.path);
    cancelCompile();
    const id = epoch;
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("./bundle-worker.mjs", import.meta.url),
        { workerData: { root: workspace, file, source } },
      );
      compiling = worker;
      const timer = setTimeout(() => {
        worker.terminate();
        reject(Error("Project compilation timed out after 15 seconds."));
      }, 15000);
      worker.once("message", (message) => {
        clearTimeout(timer);
        if (id !== epoch)
          return reject(
            Error("Compilation was superseded or workspace trust was revoked."),
          );
        compiling = null;
        message.error ? reject(Error(message.error)) : resolve(message.result);
      });
      worker.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      worker.once("exit", (code) => {
        clearTimeout(timer);
        if (compiling === worker) compiling = null;
        if (code !== 0) reject(Error("Project compilation cancelled."));
      });
    });
  });
  register("preview:prepare", (html) => {
    if (typeof html !== "string" || html.length > 12 * 1024 * 1024)
      throw Error("Invalid preview");
    const url = "inkstone-preview://document/" + randomUUID();
    preview = { url, html };
    return url;
  });
  register("preview:clear", () => {
    cancelCompile();
    return true;
  });
  await window.loadURL(HOST);
}
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => cancelCompile());
boot();
