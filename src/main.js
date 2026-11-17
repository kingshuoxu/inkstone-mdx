import { EditorView, basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { sample } from "./sample.js";
import { readDraft, writeDraft, saveHandle } from "./storage.js";
import { previewDocument } from "./sandbox.js";
import runtime from "./runtime.generated.txt?raw";
import "./style.css";
const desktop = window.inkstoneDesktop;
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
  timer,
  timeout,
  revision = 0;
$("#app").innerHTML =
  `<aside class="sidebar"><a class="brand" href="#" aria-label="Inkstone home"><span class="brand-mark">i.</span>inkstone<span class="beta">MDX</span></a><div class="section-label">WORKSPACE</div><div class="file-item"><span>◈</span><span id="side-name"></span><i id="dirty-dot"></i></div><button id="open-side" class="sidebar-button">＋ Open a document</button><div class="sidebar-bottom"><div class="leaf">❧</div><strong>A place for your next idea.</strong><p>Plain text. Live components.<br>A little room to think.</p><button id="help">Components & help ↗</button><div class="local"><span></span> Local workspace</div></div></aside><main class="workspace"><header><div class="breadcrumb">Workspace <span>/</span> <strong id="file-name"></strong></div><div class="actions"><button id="open">Open <kbd>⌘ O</kbd></button><button id="copy">Save a copy</button><button id="save" class="primary">Save <kbd>⌘ S</kbd></button></div></header><section class="workspace-title"><div><div class="eyebrow">MAKE ROOM FOR YOUR IDEAS</div><h1>Your words, with possibility.</h1></div><div class="view-toggle" role="group" aria-label="Workspace view"><button data-view="source">Source</button><button data-view="split" aria-pressed="true">Split</button><button data-view="preview">Preview</button></div></section><div id="notice" role="status" hidden></div><div class="panes" data-mode="split"><section class="source-pane"><div class="pane-head"><span><b>◧</b> SOURCE</span><span>MDX <i>·</i> UTF-8</span></div><div id="editor"></div></section><section class="preview-pane"><div class="pane-head"><span><b>◉</b> LIVE PREVIEW</span><span id="compile-status">Preparing…</span><button id="pause">Pause</button></div><div id="preview-error" role="alert" hidden></div><div id="preview"></div></section></div><footer><span id="stats"></span><span id="draft-status"></span><span>Sandboxed preview <b>◇</b></span></footer></main><input type="file" id="file-input" accept=".mdx,.md,.markdown,text/plain" hidden><dialog><button id="close-help" aria-label="Close help">×</button><div class="eyebrow">A LITTLE MORE POSSIBILITY</div><h2>Markdown meets components.</h2><p>Use Markdown, GFM tables, JSX, and JavaScript expressions. Built-in components require no imports:</p><pre>&lt;Callout title="Note" tone="warning"&gt;Text&lt;/Callout&gt;\n&lt;Badge&gt;New&lt;/Badge&gt;\n&lt;Card title="Idea"&gt;Content&lt;/Card&gt;\n&lt;Counter /&gt;</pre><p>Imports and exports are unsupported. Preview resets component state after each compile. Remote assets are blocked; data images work.</p><p>The preview has an opaque origin with no file handles or app bridge. Executable MDX can still hang its browser tab or navigate its own frame: only run code you trust. Pause stops previews while you edit.</p><p>Save overwrites only a file you selected, with a conflict check. Unsupported browsers download a copy. Recovery drafts are stored in this browser; they are not a backup. Avoid simultaneous editing in multiple tabs.</p></dialog>`;
function notice(text) {
  $("#notice").hidden = !text;
  $("#notice").textContent = text;
}
function refresh() {
  $("#file-name").textContent = name;
  $("#side-name").textContent = name;
  $("#dirty-dot").style.visibility = dirty ? "visible" : "hidden";
  $("#stats").textContent =
    `${source.trim().split(/\s+/).filter(Boolean).length} words  ·  ${source.split("\n").length} lines`;
  document.title = `${dirty ? "• " : ""}${name} — Inkstone`;
}
function backup() {
  try {
    writeDraft(localStorage, source, name);
    $("#draft-status").textContent = "Recovery draft saved locally";
    return true;
  } catch {
    $("#draft-status").textContent = "Recovery unavailable — save your file";
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
  desktop?.clearPreview();
  $("#pause").textContent = "Run preview";
  $("#compile-status").textContent = "Paused · untrusted document";
}
function schedule() {
  clearTimeout(timer);
  worker?.terminate();
  clearTimeout(timeout);
  revision++;
  if (paused) return;
  $("#compile-status").textContent = "Waiting…";
  timer = setTimeout(run, 250);
}
async function showPreview(html, id, ms) {
  const url = desktop ? await desktop.preview(html) : null;
  if (id !== revision || paused) return;
  $("#preview-error").hidden = true;
  const frame = document.createElement("iframe");
  frame.title = "MDX preview";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("referrerpolicy", "no-referrer");
  if (url) frame.src = url;
  else frame.srcdoc = html;
  $("#preview").replaceChildren(frame);
  $("#compile-status").textContent = `${Math.round(ms)} ms compile`;
}
async function run() {
  const id = revision;
  $("#compile-status").textContent = "Compiling…";
  if (desktop && project) {
    try {
      const result = await desktop.compile(source);
      if (id !== revision || paused) return;
      const cssSetup = `const style=document.createElement('style');style.textContent=${JSON.stringify(result.css)};document.head.append(style);`;
      await showPreview(
        previewDocument(cssSetup + result.js, ""),
        id,
        result.ms,
      );
    } catch (error) {
      if (id === revision && !paused) showError(error.message);
    }
    return;
  }
  worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  const active = worker;
  timeout = setTimeout(() => {
    active.terminate();
    showError(
      "Compilation timed out. Source is safe; shorten the document or pause preview.",
    );
  }, 5000);
  active.onmessage = ({ data }) => {
    if (data.id !== revision) return;
    clearTimeout(timeout);
    active.terminate();
    if (data.error) {
      showError(data.error);
      return;
    }
    showPreview(previewDocument(runtime, data.code), id, data.ms).catch(
      (error) => {
        if (id === revision) showError(error.message);
      },
    );
  };
  active.onerror = () => {
    clearTimeout(timeout);
    active.terminate();
    showError("Compiler failed. Edit to retry; source is safe.");
  };
  active.postMessage({ id, source });
}
function showError(error) {
  $("#preview-error").hidden = false;
  $("#preview-error").textContent = error;
  $("#compile-status").textContent = "Preview error · last good view";
}
const editor = new EditorView({
  doc: source,
  parent: $("#editor"),
  extensions: [
    basicSetup,
    markdown(),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ "aria-label": "MDX source editor" }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        source = update.state.doc.toString();
        dirty = source !== baseline;
        refresh();
        backup();
        schedule();
      }
    }),
  ],
});
function canReplace() {
  return (
    !dirty ||
    confirm(
      "Replace this document? Save a copy first if you need to keep your current changes.",
    )
  );
}
async function load(file, newHandle = null) {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Files larger than 5 MB are not supported.");
  const text = await file.text();
  if (!canReplace()) return;
  pauseUntrustedPreview();
  handle = newHandle;
  name = file.name;
  baseline = text;
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: text },
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
            description: "MDX documents",
            accept: { "text/plain": [".mdx", ".md", ".markdown"] },
          },
        ],
        multiple: false,
      });
      await load(await h.getFile(), h);
    } else $("#file-input").click();
  } catch (e) {
    if (e.name !== "AbortError") notice("Could not open: " + e.message);
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
          { description: "MDX document", accept: { "text/plain": [".mdx"] } },
        ],
      });
      const file = await target.getFile();
      await saveHandle(target, snapshot, await file.text());
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
      notice(
        "Save failed: " + e.message + " Your source remains in the editor.",
      );
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
        "Run this document's JavaScript? Only continue for trusted MDX. The sandbox blocks app access but cannot prevent the document from freezing this tab or navigating its own frame.",
      )
    )
      return;
    requiresTrust = false;
  }
  paused = !paused;
  $("#pause").textContent = paused ? "Resume" : "Pause";
  if (!paused)
    notice(
      "Preview is running trusted JavaScript. Pause to stop subsequent execution.",
    );
  schedule();
  if (paused) {
    $("#preview").replaceChildren();
    $("#compile-status").textContent = "Paused";
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
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === "inkstone.draft.v1")
    notice(
      "Another tab changed the recovery draft. Save your document to disk to keep this version.",
    );
});
if (desktop) {
  const controls = document.createElement("div");
  controls.className = "desktop-controls";
  controls.innerHTML =
    '<button id="project-open">Open project</button><button id="project-rebuild" hidden>Rebuild</button><button id="project-revoke" hidden>Revoke trust</button><span id="project-status">No trusted workspace</span>';
  $(".workspace").insertBefore(controls, $(".workspace-title"));
  $("#project-open").onclick = async () => {
    try {
      if (!canReplace()) return;
      const result = await desktop.project();
      if (!result) return;
      project = result.project;
      pauseUntrustedPreview();
      $("#project-status").textContent = `Trusted this session: ${project}`;
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
    $("#project-status").textContent = "No trusted workspace";
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
refresh();
if (draft) pauseUntrustedPreview();
else schedule();
if (draft)
  notice(
    "Recovered your last browser draft. Preview is paused until you choose Run preview. Save a copy to reconnect it to a file.",
  );
