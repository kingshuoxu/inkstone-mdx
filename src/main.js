import {
  searchPanelOpen,
  closeSearchPanel,
  openSearchPanel,
} from "@codemirror/search";
import { Compartment, EditorState, Text } from "@codemirror/state";
import {
  LANGUAGE_KEY,
  initialLanguage,
  translate,
  createUITranslations,
  editorPhrases,
} from "./i18n.js";
import { EditorView, basicSetup } from "codemirror";
import {
  backgroundHighlight,
  backgroundHighlightTheme,
  resetHighlight,
} from "./background-highlight.js";
import { markdown } from "@codemirror/lang-markdown";
import { sample } from "./sample.js";
import { readDraft, writeDraft, saveHandle, fileText } from "./storage.js";
import {
  previewBytes,
  previewTimeout,
  LARGE_PREVIEW_BYTES,
} from "./preview-limits.js";
import { previewDocument } from "./sandbox.js";
import runtime from "./runtime.generated.txt?raw";
import "./style.css";
const desktop = window.inkstoneDesktop;
let preferenceStorage;
try {
  preferenceStorage = localStorage;
} catch {}
let language = initialLanguage(preferenceStorage, navigator.language);
const t = (key, values) => translate(language, key, values);
const languageConfig = new Compartment();
const lineEndingConfig = new Compartment();
const syntaxConfig = new Compartment();
const syntaxForLength = (length) =>
  length > 1000000
    ? [backgroundHighlight, backgroundHighlightTheme]
    : [markdown()];
const lineEnding = (text) => text.match(/\r\n|\r|\n/)?.[0] || "\n";
const translations = createUITranslations(document.body, () => language);
const ui = (selector, key, values) =>
  translations.text($(selector), key, values);
let project = null;
const $ = (s) => document.querySelector(s);
let draft;
try {
  draft = readDraft(localStorage);
} catch {}
let source = draft?.source ?? sample,
  name = draft?.name ?? "welcome.mdx",
  baseline = source,
  dirty = !!draft,
  handle = null,
  busy = false,
  worker,
  workerBusy = false,
  timer,
  timeout,
  revision = 0;
let compileBusy = false,
  activeCompileId = -1,
  queuedReady = false;
let pendingFrame = null,
  renderTimer = null,
  previewStarted = 0;
function discardPendingPreview() {
  clearTimeout(renderTimer);
  pendingFrame?.frame.remove();
  pendingFrame = null;
}
$("#app").innerHTML =
  `<aside class="sidebar"><a class="brand" href="#" aria-label="Inkstone home"><span class="brand-mark">i.</span>inkstone<span class="beta">MDX</span></a><div class="section-label">WORKSPACE</div><div class="file-item"><span>◈</span><span id="side-name"></span><i id="dirty-dot"></i></div><button id="open-side" class="sidebar-button">＋ Open a document</button><div class="sidebar-bottom"><div class="leaf">❧</div><strong>A place for your next idea.</strong><p>Plain text. Live components.<br>A little room to think.</p><button id="help">Components & help ↗</button><div class="local"><span></span> Local workspace</div></div></aside><main class="workspace"><header><div class="breadcrumb">Workspace <span>/</span> <strong id="file-name"></strong></div><div class="actions"><button id="open">Open <kbd>⌘ O</kbd></button><button id="copy">Save a copy</button><button id="save" class="primary">Save <kbd>⌘ S</kbd></button></div></header><section class="workspace-title"><div><div class="eyebrow">MAKE ROOM FOR YOUR IDEAS</div><h1>Your words, with possibility.</h1></div><div class="view-toggle" role="group" aria-label="Workspace view"><button data-view="source">Source</button><button data-view="split" aria-pressed="true">Split</button><button data-view="preview">Preview</button></div></section><div id="notice" role="status" hidden></div><div class="panes" data-mode="split"><section class="source-pane"><div class="pane-head"><span><b>◧</b> SOURCE</span><span>MDX <i>·</i> UTF-8</span></div><div id="editor"></div></section><section class="preview-pane"><div class="pane-head"><span><b>◉</b> LIVE PREVIEW</span><span id="compile-status">Preparing…</span><button id="pause">Pause</button></div><div id="preview-error" role="alert" hidden></div><div id="preview"></div></section></div><footer><span id="stats"></span><span id="syntax-status" hidden></span><span id="draft-status"></span><span>Sandboxed preview <b>◇</b></span></footer></main><input type="file" id="file-input" accept=".mdx,.md,.markdown,text/plain" hidden><dialog><button id="close-help" aria-label="Close help">×</button><div class="eyebrow">A LITTLE MORE POSSIBILITY</div><h2>Markdown meets components.</h2><p>Use Markdown, GFM tables, JSX, and JavaScript expressions. Built-in components require no imports:</p><pre>&lt;Callout title="Note" tone="warning"&gt;Text&lt;/Callout&gt;\n&lt;Badge&gt;New&lt;/Badge&gt;\n&lt;Card title="Idea"&gt;Content&lt;/Card&gt;\n&lt;Counter /&gt;</pre><p>Browser mode rejects imports and exports. Desktop mode supports local components and installed browser-compatible dependencies after workspace trust. Preview resets component state after each compile. Remote assets are blocked; data images work.</p><p>The preview has an opaque origin with no file handles or app bridge. Executable MDX can still hang its browser tab or navigate its own frame: only run code you trust. Pause stops previews while you edit.</p><p>Save overwrites only a file you selected, with a conflict check. Unsupported browsers download a copy. Recovery drafts are stored in this browser; they are not a backup. Avoid simultaneous editing in multiple tabs.</p></dialog>`;
const languageLabel = document.createElement("label");
languageLabel.className = "language-control";
languageLabel.innerHTML =
  '<span>Interface language</span><select id="language" aria-label="Interface language"><option value="zh-CN">简体中文</option><option value="en">English</option></select>';
$(".actions").prepend(languageLabel);
translations.register();
function notice(text, values) {
  $("#notice").hidden = !text;
  ui("#notice", text, values);
}
let draftTimer, statsTimer;
function refreshStats() {
  clearTimeout(statsTimer);
  ui("#stats", "{words} words  ·  {lines} lines", {
    words: source.trim().split(/\s+/).filter(Boolean).length,
    lines: source.split("\n").length,
  });
}
function refresh() {
  const large = editor.state.doc.length > 1000000;
  $("#syntax-status").hidden = !large;
  if (large)
    ui("#syntax-status", "Large file · background syntax highlighting");
  $("#file-name").textContent = name;
  $("#side-name").textContent = name;
  $("#dirty-dot").style.visibility = dirty ? "visible" : "hidden";
  clearTimeout(statsTimer);
  if (source.length > 200000) statsTimer = setTimeout(refreshStats, 100);
  else refreshStats();
  document.title = `${dirty ? "• " : ""}${name} — Inkstone`;
}
function backup() {
  clearTimeout(draftTimer);
  draftTimer = null;
  try {
    writeDraft(localStorage, source, name);
    ui("#draft-status", "Recovery draft saved locally");
    return true;
  } catch {
    ui("#draft-status", "Recovery unavailable — save your file");
    notice(
      "Browser storage is unavailable or full. Save a copy now to protect your work.",
    );
    return false;
  }
}
let paused = !!draft;
let requiresTrust = !!draft;
function pauseUntrustedPreview() {
  paused = true;
  requiresTrust = true;
  schedule();
  $("#preview").replaceChildren();
  const placeholder = document.createElement("p");
  placeholder.className = "preview-placeholder";
  placeholder.textContent = t(
    "Preview is paused for safety. Review the source, then choose Run preview to render the complete document.",
  );
  $("#preview").append(placeholder);
  desktop?.clearPreview();
  ui("#pause", "Run preview");
  ui("#compile-status", "Paused · untrusted document");
}
function finishCompile(id) {
  if (activeCompileId !== id) return false;
  clearTimeout(timeout);
  workerBusy = false;
  compileBusy = false;
  activeCompileId = -1;
  if (queuedReady && !paused) {
    queuedReady = false;
    queueMicrotask(run);
  }
  return id === revision && !paused;
}
function schedule() {
  clearTimeout(timer);
  discardPendingPreview();
  revision++;
  queuedReady = false;
  const large =
    source.length > LARGE_PREVIEW_BYTES ||
    previewBytes(source) > LARGE_PREVIEW_BYTES;
  // Large-file edits are coalesced. Let one already-running compile settle,
  // then compile only the latest revision after the quiet period.
  // Pause/file changes and transitions to small documents cancel immediately.
  if (paused || !large) {
    desktop?.cancelCompile?.().catch(() => {});
    if (
      workerBusy ||
      paused ||
      import.meta.env.VITE_COMPILER_ENGINE === "javascript"
    ) {
      worker?.terminate();
      worker = null;
    }
    clearTimeout(timeout);
    workerBusy = false;
    compileBusy = false;
    activeCompileId = -1;
  }
  if (paused) {
    $("#compile-status").dataset.state = "paused";
    return;
  }
  $("#compile-status").dataset.state = "waiting";
  ui(
    "#compile-status",
    large ? "Changes queued · refreshing after typing stops…" : "Waiting…",
  );
  timer = setTimeout(
    () => {
      if (compileBusy) queuedReady = true;
      else run();
    },
    large ? 1500 : 250,
  );
}
async function showPreview(previewRuntime, code, id, ms) {
  const token = crypto.randomUUID();
  const html = previewDocument(previewRuntime, code, language, {
    token,
    large: previewBytes(source) > LARGE_PREVIEW_BYTES,
  });
  const url = desktop ? await desktop.preview(html) : null;
  if (id !== revision || paused) return;
  discardPendingPreview();
  const frame = document.createElement("iframe");
  frame.title = t("MDX preview");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("referrerpolicy", "no-referrer");
  // Keep the last successful view until the new full document commits.
  // visibility:hidden (not display:none) keeps the same viewport/layout.
  frame.style.cssText = "position:absolute;inset:0;visibility:hidden";
  frame.dataset.pending = "true";
  pendingFrame = { frame, token, id, ms };
  ui("#compile-status", "Rendering full document…");
  $("#compile-status").dataset.state = "rendering";
  if (url) frame.src = url;
  else frame.srcdoc = html;
  $("#preview").append(frame);
  renderTimer = setTimeout(() => {
    if (pendingFrame?.id !== id) return;
    discardPendingPreview();
    showError(
      "Rendering timed out. Last successful preview is preserved; source is safe.",
    );
  }, 60000);
}
window.addEventListener("message", (event) => {
  const pending = pendingFrame;
  if (
    !pending ||
    event.source !== pending.frame.contentWindow ||
    event.data?.type !== "inkstone-preview" ||
    event.data.token !== pending.token ||
    pending.id !== revision ||
    paused
  )
    return;
  if (event.data.state === "error") {
    discardPendingPreview();
    showError(String(event.data.message));
    return;
  }
  if (event.data.state !== "ready") return;
  clearTimeout(renderTimer);
  pendingFrame = null;
  pending.frame.style.cssText = "";
  delete pending.frame.dataset.pending;
  $("#preview").replaceChildren(pending.frame);
  $("#preview-error").hidden = true;
  $("#compile-status").dataset.state = "ready";
  $("#compile-status").dataset.previewMs = String(
    Math.round(performance.now() - previewStarted),
  );
  ui("#compile-status", "{ms} ms compile", { ms: Math.round(pending.ms) });
});
async function run() {
  if (paused) return;
  if (compileBusy) {
    queuedReady = true;
    return;
  }
  const id = revision;
  compileBusy = true;
  activeCompileId = id;
  previewStarted = performance.now();
  $("#compile-status").dataset.state = "compiling";
  $("#preview-error").hidden = true;
  ui(
    "#compile-status",
    previewBytes(source) > LARGE_PREVIEW_BYTES
      ? "Compiling full document · up to 120 s…"
      : "Compiling…",
  );
  if (desktop && project) {
    try {
      const result = await desktop.compile(source);
      if (!finishCompile(id)) return;
      const cssSetup = `const style=document.createElement('style');style.textContent=${JSON.stringify(result.css)};document.head.append(style);`;
      await showPreview(cssSetup + result.js, "", id, result.ms);
    } catch (error) {
      finishCompile(id);
      if (id === revision && !paused) showError(error.message);
    }
    return;
  }
  worker ||= new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  const active = worker;
  workerBusy = true;
  timeout = setTimeout(() => {
    if (active !== worker || activeCompileId !== id) return;
    active.terminate();
    worker = null;
    if (!finishCompile(id)) return;
    showError(
      "Compilation timed out. Source is safe; shorten the document or pause preview.",
    );
  }, previewTimeout(source));
  active.onmessage = ({ data }) => {
    if (active !== worker || !finishCompile(data.id)) return;
    $("#compile-status").dataset.engine = data.engine || "error";
    if (data.error) {
      showError(data.error);
      return;
    }
    showPreview(runtime, data.code, id, data.ms).catch((error) => {
      if (id === revision) showError(error.message);
    });
  };
  active.onerror = () => {
    if (active !== worker || activeCompileId !== id) return;
    active.terminate();
    worker = null;
    if (!finishCompile(id)) return;
    showError("Compiler failed. Edit to retry; source is safe.");
  };
  active.postMessage({ id, source });
}
function showError(error) {
  $("#compile-status").dataset.state = "error";
  $("#preview-error").hidden = false;
  ui("#preview-error", "Preview error: {error}", {
    error: error,
  });
  ui("#compile-status", "Preview error · last good view");
}
const editor = new EditorView({
  doc: Text.of(source.split(/\r\n|\r|\n/)),
  parent: $("#editor"),
  extensions: [
    basicSetup,
    lineEndingConfig.of(EditorState.lineSeparator.of(lineEnding(source))),
    syntaxConfig.of(syntaxForLength(source.length)),
    EditorState.transactionExtender.of((tr) => {
      if (!tr.docChanged) return null;
      const wantsSyntax = tr.newDoc.length <= 1000000;
      if (tr.startState.doc.length <= 1000000 === wantsSyntax) return null;
      return {
        effects: syntaxConfig.reconfigure(syntaxForLength(tr.newDoc.length)),
      };
    }),
    EditorView.lineWrapping,
    languageConfig.of([
      EditorState.phrases.of(language === "zh-CN" ? editorPhrases : {}),
      EditorView.contentAttributes.of({ "aria-label": t("MDX source editor") }),
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        source = update.state.sliceDoc();
        dirty = source !== baseline;
        refresh();
        clearTimeout(draftTimer);
        if (source.length > 200000) {
          ui("#draft-status", "Recovery pending…");
          draftTimer = setTimeout(backup, 200);
        } else backup();
        schedule();
      }
    }),
  ],
});
$("#editor").addEventListener("highlight-error", () =>
  notice(
    t(
      "Background highlighting failed. Reopen the document to retry; editing and saving are unaffected.",
    ),
  ),
);
function canReplace() {
  return (
    !dirty ||
    confirm(
      t(
        "Replace this document? Save a copy first if you need to keep your current changes.",
      ),
    )
  );
}
async function load(file, newHandle = null) {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Files larger than 5 MB are not supported.");
  let text;
  try {
    text = file.arrayBuffer
      ? new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          await file.arrayBuffer(),
        )
      : await file.text();
  } catch {
    throw Error("File is not valid UTF-8. Source was not replaced.");
  }
  if (!canReplace()) return;
  pauseUntrustedPreview();
  handle = newHandle;
  name = file.name;
  baseline = text;
  editor.dispatch({
    effects: [
      lineEndingConfig.reconfigure(
        EditorState.lineSeparator.of(lineEnding(text)),
      ),
      resetHighlight.of(null),
    ],
    changes: {
      from: 0,
      to: editor.state.doc.length,
      insert: Text.of(text.split(/\r\n|\r|\n/)),
    },
  });
  source = text;
  dirty = false;
  backup();
  refresh();
  notice(
    "Opened locally. Preview is paused: MDX can execute JavaScript. Inspect the source before choosing Run preview.",
  );
}
async function open() {
  if (busy) return;
  try {
    if (desktop) {
      if (!canReplace()) return;
      const file = await desktop.open();
      if (file) {
        dirty = false;
        await load({
          name: file.name,
          size: new TextEncoder().encode(file.source).length,
          text: async () => file.source,
        });
      }
    } else if ("showOpenFilePicker" in window) {
      const [h] = await showOpenFilePicker({
        types: [
          {
            description: t("MDX documents"),
            accept: { "text/plain": [".mdx", ".md", ".markdown"] },
          },
        ],
        multiple: false,
      });
      await load(await h.getFile(), h);
    } else $("#file-input").click();
  } catch (e) {
    if (e.name !== "AbortError")
      notice("Could not open: {error}", { error: e.message });
  }
}
$("#file-input").onchange = async (e) => {
  try {
    if (e.target.files[0]) await load(e.target.files[0]);
  } catch (e) {
    notice(e.message);
  } finally {
    e.target.value = "";
  }
};
async function save(copy = false) {
  if (busy) return;
  busy = true;
  $("#save").disabled = true;
  const snapshot = source;
  try {
    if (desktop) {
      const result = await desktop.save(snapshot, copy);
      if (!result) return;
      name = result.name;
      baseline = snapshot;
      dirty = source !== baseline;
      backup();
      refresh();
      notice(
        dirty
          ? "Saved snapshot; newer edits still need saving."
          : "Saved to disk.",
      );
      return;
    }
    let target = copy ? null : handle;
    if (!target && "showSaveFilePicker" in window) {
      target = await showSaveFilePicker({
        suggestedName: name,
        types: [
          {
            description: t("MDX document"),
            accept: { "text/plain": [".mdx"] },
          },
        ],
      });
      const file = await target.getFile();
      await saveHandle(target, snapshot, await fileText(file));
    } else if (target) await saveHandle(target, snapshot, baseline);
    else {
      const url = URL.createObjectURL(
        new Blob([snapshot], { type: "text/plain;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      notice("Download requested. Verify the downloaded copy before closing.");
      return;
    }
    handle = target;
    name = target.name;
    baseline = snapshot;
    dirty = source !== baseline;
    backup();
    refresh();
    notice(
      dirty
        ? "Saved snapshot; newer edits still need saving."
        : "Saved to disk.",
    );
  } catch (e) {
    if (e.name !== "AbortError")
      notice("Save failed: {error} Your source remains in the editor.", {
        error: e.message,
      });
  } finally {
    busy = false;
    $("#save").disabled = false;
  }
}
$("#save").onclick = () => save();
$("#copy").onclick = () => save(true);
$("#open").onclick = $("#open-side").onclick = open;
$("#help").onclick = () => $("dialog").showModal();
$("#close-help").onclick = () => $("dialog").close();
$("#pause").onclick = () => {
  if (paused && requiresTrust) {
    if (
      !confirm(
        t(
          "Run this document's JavaScript? Only continue for trusted MDX. The sandbox blocks app access but cannot prevent the document from freezing this tab or navigating its own frame.",
        ),
      )
    )
      return;
    requiresTrust = false;
  }
  paused = !paused;
  ui("#pause", paused ? "Resume" : "Pause");
  if (!paused)
    notice(
      "Preview is running trusted JavaScript. Pause to stop subsequent execution.",
    );
  schedule();
  if (paused) {
    $("#preview").replaceChildren();
    ui("#compile-status", "Paused");
    desktop?.clearPreview();
  }
};
for (const b of document.querySelectorAll("[data-view]"))
  b.onclick = () => {
    $(".panes").dataset.mode = b.dataset.view;
    for (const other of document.querySelectorAll("[data-view]"))
      other.setAttribute("aria-pressed", String(other === b));
    editor.requestMeasure();
  };
window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save(e.shiftKey);
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
    e.preventDefault();
    open();
  }
});
window.addEventListener("pagehide", () => {
  if (dirty || draftTimer) backup();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && (dirty || draftTimer)) backup();
});
window.addEventListener("beforeunload", (e) => {
  if (dirty || draftTimer) backup();
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === "inkstone.draft.v1") {
    const incoming = readDraft({ getItem: () => e.newValue });
    // A reload may receive a queued flush from the outgoing document.
    if (incoming?.source === source && incoming.name === name) return;
    notice(
      "Another tab changed the recovery draft. Save your document to disk to keep this version.",
    );
  }
});
if (desktop) {
  const controls = document.createElement("div");
  controls.className = "desktop-controls";
  controls.innerHTML =
    '<button id="project-open">Open project</button><button id="project-rebuild" hidden>Rebuild</button><button id="project-revoke" hidden>Revoke trust</button><span id="project-status">No trusted workspace</span>';
  $(".workspace").insertBefore(controls, $(".workspace-title"));
  translations.register(controls);
  $("#project-open").onclick = async () => {
    try {
      if (!canReplace()) return;
      const result = await desktop.project();
      if (!result) return;
      project = result.project;
      pauseUntrustedPreview();
      ui("#project-status", "Trusted this session: {project}", { project });
      $("#project-revoke").hidden = false;
      $("#project-rebuild").hidden = false;
      notice(
        "Workspace trusted for this session. Open an MDX file inside it, then choose Run preview. Installed browser dependencies are supported; no install scripts are run.",
      );
    } catch (e) {
      notice(e.message);
    }
  };
  $("#project-revoke").onclick = async () => {
    await desktop.revoke();
    project = null;
    pauseUntrustedPreview();
    ui("#project-status", "No trusted workspace");
    $("#project-revoke").hidden = true;
    $("#project-rebuild").hidden = true;
    notice(
      "Workspace trust revoked. Source is preserved; project imports no longer compile.",
    );
  };
  $("#project-rebuild").onclick = () => {
    if (!paused) schedule();
    else notice("Choose Run preview to compile this trusted document.");
  };
}
function applyLanguage() {
  document.documentElement.lang = language;
  $("#language").value = language;
  translations.render();
  const searchWasOpen = searchPanelOpen(editor.state);
  if (searchWasOpen) closeSearchPanel(editor);
  editor.dispatch({
    effects: languageConfig.reconfigure([
      EditorState.phrases.of(language === "zh-CN" ? editorPhrases : {}),
      EditorView.contentAttributes.of({ "aria-label": t("MDX source editor") }),
    ]),
  });
  if (searchWasOpen) openSearchPanel(editor);
  desktop?.setLanguage(language).catch((error) => notice(error.message));
  refresh();
}
$("#language").onchange = () => {
  language = $("#language").value;
  applyLanguage();
  try {
    if (!preferenceStorage) throw Error("Storage unavailable");
    preferenceStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    notice(
      "Language preference could not be saved. This selection applies until reload.",
    );
  }
  if (!paused) schedule();
};
applyLanguage();
refresh();
if (draft) pauseUntrustedPreview();
else schedule();
if (draft)
  notice(
    "Recovered your last browser draft. Preview is paused until you choose Run preview. Save a copy to reconnect it to a file.",
  );
