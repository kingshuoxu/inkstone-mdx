const { contextBridge, ipcRenderer } = require("electron");
// Do not expose ipcRenderer or a generic send/invoke method.
if (process.isMainFrame)
  contextBridge.exposeInMainWorld(
    "inkstoneDesktop",
    Object.freeze({
      open: () => ipcRenderer.invoke("document:open"),
      project: () => ipcRenderer.invoke("workspace:open"),
      revoke: () => ipcRenderer.invoke("workspace:revoke"),
      save: (source, copy) =>
        ipcRenderer.invoke("document:save", { source, copy }),
      compile: (source) => ipcRenderer.invoke("workspace:compile", source),
      preview: (html) => ipcRenderer.invoke("preview:prepare", html),
      clearPreview: () => ipcRenderer.invoke("preview:clear"),
    }),
  );
