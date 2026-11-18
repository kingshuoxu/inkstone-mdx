import { checkForUpdate, downloadUpdate } from "./updates.mjs";
import { PROJECT_LINKS } from "../src/project-links.js";
export const RELEASES_URL = PROJECT_LINKS.releases;

// Native-menu only: no update IPC, renderer fetch permission or installer execution.
export function createUpdateController({
  getVersion,
  platform,
  arch,
  translate = (s) => s,
  message,
  save,
  reveal,
  openReleases,
  stateChanged = () => {},
  check = checkForUpdate,
  download = downloadUpdate,
}) {
  let phase = "idle",
    controller = null,
    disposed = false;
  const setPhase = (next) => {
    phase = next;
    stateChanged(next);
  };
  return {
    get phase() {
      return phase;
    },
    cancel() {
      controller?.abort();
    },
    dispose() {
      disposed = true;
      controller?.abort();
    },
    async run() {
      if (phase !== "idle" || disposed) return;
      controller = new AbortController();
      const signal = controller.signal;
      const t = translate;
      const show = (options) =>
        message({ title: t("Software update"), noLink: true, ...options });
      setPhase("checking");
      try {
        const result = await check({
          currentVersion: getVersion(),
          platform,
          arch,
          signal,
        });
        if (signal.aborted || disposed) return;
        if (result.status === "current") {
          await show({
            type: "info",
            message: t("You are up to date."),
            buttons: [t("OK")],
          });
          return;
        }
        if (result.status !== "available" || !result.asset) {
          const answer = await show({
            type: "info",
            message: t("No verified installer is available for this platform."),
            buttons: [t("Cancel"), t("Open releases page")],
            defaultId: 0,
            cancelId: 0,
          });
          if (answer.response === 1 && !signal.aborted && !disposed)
            await openReleases(RELEASES_URL);
          return;
        }
        const answer = await show({
          type: "info",
          message: t("An update is available.") + " " + result.version,
          detail: t(
            "Download the installer from GitHub. SHA-256 checks file integrity, not publisher authenticity. Packages may be unsigned. Save your work and install manually; the app will not quit or install anything automatically.",
          ),
          buttons: [t("Cancel"), t("Download installer")],
          defaultId: 0,
          cancelId: 0,
        });
        if (answer.response !== 1 || signal.aborted || disposed) return;
        const choice = await save({
          title: t("Save update installer"),
          defaultPath: result.asset.name,
          buttonLabel: t("Download installer"),
          properties: ["showOverwriteConfirmation", "createDirectory"],
        });
        if (choice.canceled || !choice.filePath || signal.aborted || disposed)
          return;
        setPhase("downloading");
        const completed = await download(result.asset, choice.filePath, {
          signal,
        });
        if (signal.aborted || disposed) return;
        const done = await show({
          type: "info",
          message: t("Installer downloaded and checksum verified."),
          detail: t(
            "Save your work, then install manually. Nothing has been installed automatically.",
          ),
          buttons: [t("Close"), t("Show in folder")],
          defaultId: 0,
          cancelId: 0,
        });
        if (done.response === 1 && !signal.aborted && !disposed)
          reveal(completed.path);
      } catch {
        if (!signal.aborted && !disposed) {
          const answer = await show({
            type: "error",
            message: t(
              "Update check or download failed. Nothing was installed. Please try again.",
            ),
            buttons: [t("Close"), t("Open releases page")],
            defaultId: 0,
            cancelId: 0,
          });
          if (answer.response === 1 && !signal.aborted && !disposed)
            await openReleases(RELEASES_URL);
        }
      } finally {
        controller = null;
        setPhase("idle");
      }
    },
  };
}
