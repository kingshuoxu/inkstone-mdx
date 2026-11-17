# Usage and safety reference

[Back to README](../README.md)

## Interface language

Choose **简体中文 / English** in the top toolbar. The initial language follows the browser/system language (Chinese locales use Simplified Chinese); an explicit choice is saved locally and restored on reload. The choice changes application text, accessibility labels, CodeMirror search controls, built-in preview labels and desktop dialogs/menus. It does not translate your document or discard undo history. An active preview recompiles on a language change, resetting component state; a paused document stays paused. If preference storage is unavailable, the choice works for the current session and a warning appears.

On minimal Linux systems, install a Chinese system font such as `fonts-noto-cjk`; see the [desktop font requirements](DESKTOP.md#chinese-display-fonts).

Third-party compiler/OS error details are retained verbatim after the localized application message. Native browser/OS file-picker chrome follows the operating system; it cannot all be controlled by the app. Chinese input-method composition across OS/IME combinations has not been exhaustively tested.

简体中文：顶部可切换界面语言并保存偏好。切换不会翻译或覆盖文档内容；正在运行的预览会重新编译，已暂停的文档不会自动执行。

## Use

- **Open** / Ctrl or Cmd + O opens `.mdx`, `.md`, or `.markdown` files. This is an MDX editor: `.md` files also use MDX syntax, so literal braces and angle brackets may need escaping.
- **Save** / Ctrl or Cmd + S writes to a user-selected file in browsers supporting File System Access (normally desktop Chromium, secure context or localhost).
- **Save a copy** / Ctrl or Cmd + Shift + S selects a new destination. Browsers without the API download a copy; a requested download is not marked as a confirmed disk save.
- Switch between Source, Split and Preview. CodeMirror includes undo/redo, find, line numbers, bracket completion and keyboard navigation. Syntax highlighting is Markdown-oriented, not a full MDX language service.
- Preview waits 250 ms after the last edit. Superseded compiler workers are terminated; standalone compilation is stopped after 5 seconds (desktop project bundling has a 15-second limit). The last good preview remains visible on compilation errors. Runtime errors appear inside the preview.
- **Pause** removes the preview and stops compilation. **Resume** recompiles the current source. Opening a local file or restoring a recovery draft always pauses preview. Inspect the source, then select **Run preview** and explicitly confirm you trust its JavaScript. Trust is not persisted across reloads or files. The bundled welcome example runs automatically.
- A recovery draft is written to browser localStorage after edits. For buffers above 200,000 JavaScript string units, draft writes wait for a 200 ms editing pause and word/line counts wait 100 ms, keeping full-document work out of the immediate input path. Pending recovery writes are flushed when hiding/leaving the page; an abrupt process crash can still lose the most recent pending draft. Reload restores it, without restoring file permissions. Save a copy to reconnect it to disk. Clearing browser data removes it; recovery is not a durable backup. Multiple tabs share one draft and display a conflict notice.

A dot in the file row and browser title indicates unsaved edits. Replacing dirty text requires confirmation. A failed save preserves the source, and changes made while a save is running remain dirty. Existing file contents are checked before writing; external modifications cause a refusal and a suggestion to save a copy. File System Access commits on stream close; failed writes are aborted when possible. The conflict check is best effort, not an OS-level lock: another process can write between check and commit. Keep backups for valuable work.

## MDX support

Supports Markdown, GFM tables/task lists/strikethrough, inline JSX, JavaScript expressions, standard HTML elements and these built-ins:

```text
<Callout title="A note" tone="warning">
  Content
</Callout>
<Badge>New</Badge>
<Card title="An idea">Content</Card>
<Counter />

The answer is {6 * 7}.
```

`Counter` demonstrates real React state, not a static JSX approximation. Component state resets after successful compilation. In the browser-only edition, imports and exports are explicitly rejected; arbitrary project components, package installation, relative assets, TypeScript, frontmatter and project resolution are not implemented. Built-ins are compiled into the preview runtime. Remote images/fonts/media are blocked; data images work. The preview limit is 500 KB (512,000 UTF-8 bytes), and opening files is limited to 5 MiB. Browser-only buffers larger than the open limit may be downloaded; desktop saves remain subject to the 5 MiB IPC guard.

See [size-limit rationale and measurements](LIMITS.md) for why the 5 MiB file and 512,000-byte preview guards are retained. These are resource protections, not MDX format limits.

## Browser security model and limits

This section describes the browser-only edition. The desktop host has a narrow preload API, while its preview does not; it loads a dedicated preview protocol rather than `srcdoc`. See [desktop trust and isolation](DESKTOP.md#trust-and-isolation) for that implementation.

MDX is executable JavaScript. Parsing/compilation happens in a Web Worker; document code is never evaluated by the editor or compiler worker. Evaluation occurs only in a fresh `srcdoc` iframe with `sandbox="allow-scripts"` and **without** `allow-same-origin`. Its opaque origin cannot read the editor DOM or localStorage. The parent passes generated code only through a JSON-escaped payload. There is no message listener, RPC bridge, filesystem API bridge, Electron preload, Node integration, or passed file handle.

The preview CSP denies fetch/connect, remote scripts, frames, objects, forms, fonts and media; only inline runtime/evaluation, inline styles and data images are enabled. This is defense in depth, not a guarantee that every form of network traffic is impossible: frame self-navigation can still occur and CSP navigation restrictions are not universally enforced. The iframe cannot navigate the top-level page, open permitted popups, or access host file permissions via an application bridge. It does not get the user's GitHub or browser credentials.

**Only execute documents you trust.** An infinite loop or memory exhaustion can freeze/crash the tab; iframe execution is not a process/resource isolation guarantee. Compile timeout does not limit runtime execution. A hostile preview can spoof UI inside its own frame or navigate that frame. No claim is made that arbitrary project components or untrusted code are safe to run. Pause prevents subsequent execution, but cannot rescue a tab already blocked by an infinite loop. A future hardened edition needs a dedicated cross-site execution origin, resource controls and independent security review.

Recovery drafts are plaintext in the browser profile. Avoid opening sensitive documents on shared machines. Serve the host from a dedicated origin; do not cohost it with unrelated untrusted applications.
