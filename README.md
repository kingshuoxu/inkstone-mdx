# Inkstone MDX

A quiet, source-first MDX workspace. Open local documents, edit Markdown and JSX, and see real React components in an isolated preview. MIT licensed, with no accounts, backend, telemetry, paid services, or document uploads.

**Status: early implementation. Build and core tests pass. Browser tests and visual QA are supplied but not verified in the authoring environment (Chromium process/socket restrictions). Do not treat this version as a hardened hostile-code execution service.**

## Run locally

Requires Node.js 22.12+ (tested with Node 24) and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` creates `dist/`, which can be served by any static HTTP server. Opening `index.html` directly with `file://` does not work because the compiler is a module worker. No document data is sent to a server; dependencies are bundled locally. Development binds only to loopback.

## Use

- **Open** / Ctrl or Cmd + O opens `.mdx`, `.md`, or `.markdown` files. This is an MDX editor: `.md` files also use MDX syntax, so literal braces and angle brackets may need escaping.
- **Save** / Ctrl or Cmd + S writes to a user-selected file in browsers supporting File System Access (normally desktop Chromium, secure context or localhost).
- **Save a copy** / Ctrl or Cmd + Shift + S selects a new destination. Browsers without the API download a copy; a requested download is not marked as a confirmed disk save.
- Switch between Source, Split and Preview. CodeMirror includes undo/redo, find, line numbers, bracket completion and keyboard navigation. Syntax highlighting is Markdown-oriented, not a full MDX language service.
- Preview waits 250 ms after the last edit. Superseded compiler workers are terminated; compilation is stopped after 5 seconds. The last good preview remains visible on compilation errors. Runtime errors appear inside the preview.
- **Pause** removes the preview and stops compilation. **Resume** recompiles the current source. Opening a local file or restoring a recovery draft always pauses preview. Inspect the source, then select **Run preview** and explicitly confirm you trust its JavaScript. Trust is not persisted across reloads or files. The bundled welcome example runs automatically.
- A recovery draft is written to browser localStorage on every edit. Reload restores it, without restoring file permissions. Save a copy to reconnect it to disk. Clearing browser data removes it; recovery is not a durable backup. Multiple tabs share one draft and display a conflict notice.

A dot in the file row and browser title indicates unsaved edits. Replacing dirty text requires confirmation. A failed save preserves the source, and changes made while a save is running remain dirty. Existing file contents are checked before writing; external modifications cause a refusal and a suggestion to save a copy. File System Access commits on stream close; failed writes are aborted when possible. The conflict check is best effort, not an OS-level lock: another process can write between check and commit. Keep backups for valuable work.

## MDX support

Supports Markdown, GFM tables/task lists/strikethrough, inline JSX, JavaScript expressions, standard HTML elements and these built-ins:

```mdx
<Callout title="A note" tone="warning">
  Content
</Callout>
<Badge>New</Badge>
<Card title="An idea">Content</Card>
<Counter />

The answer is {6 \* 7}.
```

`Counter` demonstrates real React state, not a static JSX approximation. Component state resets after successful compilation. Imports and exports are explicitly rejected; arbitrary project components, package installation, relative assets, TypeScript, frontmatter and project resolution are not implemented. Built-ins are compiled into the preview runtime. Remote images/fonts/media are blocked; data images work. The preview limit is 500 KB (512,000 UTF-8 bytes), and opening files is limited to 5 MiB. Larger editor buffers can still be saved.

## Security model and limits

MDX is executable JavaScript. Parsing/compilation happens in a Web Worker; document code is never evaluated by the editor or compiler worker. Evaluation occurs only in a fresh `srcdoc` iframe with `sandbox="allow-scripts"` and **without** `allow-same-origin`. Its opaque origin cannot read the editor DOM or localStorage. The parent passes generated code only through a JSON-escaped payload. There is no message listener, RPC bridge, filesystem API bridge, Electron preload, Node integration, or passed file handle.

The preview CSP denies fetch/connect, remote scripts, frames, objects, forms, fonts and media; only inline runtime/evaluation, inline styles and data images are enabled. This is defense in depth, not a guarantee that every form of network traffic is impossible: frame self-navigation can still occur and CSP navigation restrictions are not universally enforced. The iframe cannot navigate the top-level page, open permitted popups, or access host file permissions via an application bridge. It does not get the user's GitHub or browser credentials.

**Only execute documents you trust.** An infinite loop or memory exhaustion can freeze/crash the tab; iframe execution is not a process/resource isolation guarantee. Compile timeout does not limit runtime execution. A hostile preview can spoof UI inside its own frame or navigate that frame. No claim is made that arbitrary project components or untrusted code are safe to run. Pause prevents subsequent execution, but cannot rescue a tab already blocked by an infinite loop. A future hardened edition needs a dedicated cross-site execution origin, resource controls and independent security review.

Recovery drafts are plaintext in the browser profile. Avoid opening sensitive documents on shared machines. Serve the host from a dedicated origin; do not cohost it with unrelated untrusted applications.

## Development and verification

```sh
npm test                       # compiler, recovery, save semantics, payload tests
npm run bench                  # repeatable compiler benchmark
npx playwright install chromium
npm run test:e2e                # UI, files, recovery, isolation, screenshots, input probe
npm run build
npm run format:check
```

Set `CHROMIUM_PATH=/path/to/chromium` to use a system Chromium. End-to-end tests produce `docs/workspace.png` and `docs/mobile.png`. The input probe uses synthetic insertion to next animation frame; it is not a hardware typing latency or INP measurement. The included CI runs tests and build on pushes and pull requests; no deployment is configured.

See [validation report](docs/VALIDATION.md) for measured results and outstanding checks.

## Architecture

- `src/main.js`: CodeMirror, document state, file UX, draft recovery and compile scheduling.
- `src/compiler.js`, `src/worker.js`: MDX/GFM compiler and explicit module boundary.
- `src/preview.jsx`, `src/sandbox.js`: bundled React runtime, components, iframe CSP and source transport.
- `src/storage.js`: testable recovery and file-write semantics.

The visual direction takes inspiration from the restraint of [MarkEdit](https://github.com/MarkEdit-app/MarkEdit) and [MarkText](https://github.com/marktext/marktext); no code or assets were copied. Built on [CodeMirror](https://codemirror.net/) and [MDX](https://mdxjs.com/packages/mdx/).

## Repository delivery

Public repository: https://github.com/kingshuoxu/inkstone-mdx

This source snapshot was recovered from the latest saved Library archive (version 1) after the original cloud workspace disappeared. It includes the follow-up fix that pauses opened/recovered documents until explicit trust confirmation. The original Git history and commit `bfb22aa` were not included in that archive and could not be recovered. The public repository therefore starts with a new history; it does not claim to preserve the original commit hash.

Before publication, all 22 archive files were checked for common credential patterns and personal contact information; none were detected. The archive contains no `.git`, `.env`, credential files, or runtime browser data. This check is not a formal security audit.
