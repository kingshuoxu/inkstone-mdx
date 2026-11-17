# Inkstone MDX

**Your words, with possibility.**

A local-first, source-first MDX editor. Write Markdown and React components in a quiet split workspace, then interact with the rendered result. Available as a web app and an Electron desktop app for Windows, macOS and Linux.

[简体中文](README.md) · [MIT License](LICENSE) · [Desktop guide](docs/DESKTOP.md) · [Validation](docs/EXTENDED-VALIDATION.md)

> **Development preview:** this README describes `main`; [PR #3](https://github.com/kingshuoxu/inkstone-mdx/pull/3) has been merged, but no formal release has been published. Desktop packages are unsigned and macOS builds are not notarized. Only run trusted documents and projects.

## Live preview

The normal working view below has preview enabled: source on the left, the rendered document and interactive React components on the right.

![Source editing alongside a live React preview](docs/screenshots/workspace-production.png)

## What it does

- **Markdown meets React:** GFM tables, task lists and strikethrough; JSX and JavaScript expressions; interactive `Callout`, `Badge`, `Card` and `Counter` components.
- **Focused editing:** Source, Split and Preview layouts, line numbers, search, undo/redo, bracket completion and Markdown-oriented syntax highlighting. Not a complete MDX language service.
- **Chinese and English UI:** switch languages and remember the choice locally without translating the document. UTF-8 Chinese filenames and content are supported.
- **Local files:** open `.mdx`, `.md` and `.markdown`; save, save a copy, detect unsaved edits and check for external modifications. Desktop uses native file operations; web direct writes depend on browser support, otherwise a copy is downloaded.
- **Trusted desktop projects:** preview local components and installed browser-compatible npm dependencies. Revoke trust at any time. No automatic dependency installation or execution of project build configuration.
- **Rust/WASM compilation core:** parsing, AST transforms and JavaScript generation for larger documents, with JS fallback for small inputs and compatibility cases. The UI, file layer and React renderer remain JavaScript.
- **Large files keep their colors:** above one million UTF-16 units, a background worker incrementally parses the document and returns only visible-range styling. Input does not wait for full-document highlighting.
- **Local-first:** no account, backend, paid service, app telemetry or document upload. Recovery drafts stay in the local browser/app profile and are not a durable backup.

### Chinese interface with preview enabled

![Simplified Chinese interface](docs/screenshots/chinese-production.png)

### Large-file editing test, not a preview demo

> **Editing performance is not preview capacity.** The roughly 5 MiB fixture below exceeds the current **512,000 UTF-8 byte** preview limit. It tests editing and highlighting only. Preview was paused, so the right pane is empty; clicking “Run preview” cannot bypass the size limit. See the two screenshots above for normal rendered previews.

<details>
<summary>Show the large-file highlighting stress test (preview paused)</summary>

![Worker highlighting in a roughly 5 MiB file only; preview is paused and the right pane is empty](docs/screenshots/highlight-production.png)

The storage warning means the fixture exceeded the browser's recovery-draft quota, not that saving a file to disk failed. Save valuable work to disk.

</details>

These are real Chromium screenshots of production build `4d269a4`, not mockups. [Screenshot provenance](docs/screenshots/README.md).

## Measured performance

Same GitHub Actions Linux runner, Chromium, production builds, approximately **5 MiB**, **preview paused**, 20 automated input samples per case. The metric is `beforeinput` to the next animation frame. Baseline `19f4d5b` uses main-thread highlighting; `4d269a4` keeps highlighting in a worker.

| Document              | Baseline median / p95 | Worker median / p95 |
| --------------------- | --------------------: | ------------------: |
| Long plain paragraphs |      292.5 / 303.9 ms |   **8.4 / 16.2 ms** |
| Richly formatted text |        47.5 / 64.2 ms |   **8.3 / 15.9 ms** |

[Comparison CI](https://github.com/kingshuoxu/inkstone-mdx/actions/runs/44084892798). These are editing-response observations, **not physical keyboard latency, full live-preview performance or a frame-rate guarantee**.

A separate recorded Linux / Node 24 compiler benchmark measured dense ~100 KB MDX warm compilation at 651.8 → 198.3 ms and dense ~500 KB at 3342.1 → 2994.8 ms. Rust is not universally faster. See [the full Rust report](docs/RUST-PERFORMANCE.md) for cold starts, memory and measurement conditions.

### Current boundaries

- Colors can arrive briefly after opening, scrolling or editing. The large-file worker path does not provide syntax-driven folding or indentation.
- Opening files is capped at **5 MiB**, as are desktop save/IPC operations. Preview source is capped at **512,000 UTF-8 bytes**. See [limits](docs/LIMITS.md).
- Recovery depends on local storage quota; save valuable work to disk.
- Web mode rejects project imports. Desktop does not support Node native addons, server-only dependencies or arbitrary project plugins. See [supported project boundaries](docs/DESKTOP.md#supported-boundaries).
- `.md` files are also parsed as MDX, not a plain-Markdown compatibility mode. Literal braces or angle brackets may need escaping.

## Get started

### Desktop test packages

Choose a successful run in the [Desktop workflow](https://github.com/kingshuoxu/inkstone-mdx/actions/workflows/desktop.yml), then download the platform artifact. [This verified snapshot](https://github.com/kingshuoxu/inkstone-mdx/actions/runs/44084892678) builds macOS DMG/ZIP, Windows NSIS and Linux AppImage/DEB packages. Artifacts usually require GitHub login and expire. There is no formal release or auto-updater yet.

Installed apps do not require Node or Rust. Packages are unsigned/not notarized; successful packaging does not verify every installer-wizard interaction.

### Run from source

Requires Node.js **22.12+** (CI uses Node 24), npm, stable Rust and platform build tools. Check out the default main branch:

```sh
git clone https://github.com/kingshuoxu/inkstone-mdx.git
cd inkstone-mdx
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.105 --locked
npm ci
npm run build:core
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` creates `dist/` for a static HTTP server; direct `file://` loading is unsupported.

```sh
npm run desktop       # Build and launch Electron
npm run desktop:dist  # Package the current OS into release/
```

To try project imports, run `npm ci --prefix examples/project --ignore-scripts`, open and trust that folder in the desktop app, then open its MDX file. Use Rebuild after imported components change. See the [desktop guide](docs/DESKTOP.md).

## Trust and safety

**MDX executes JavaScript.** Opened files and recovered drafts start with preview paused until explicit trust confirmation. Preview runs in an opaque-origin sandbox iframe; desktop preview has no Node/preload access. This is defense in depth, not a hostile-code execution service: loops and memory exhaustion can freeze or crash the app. Trust only necessary project folders, not an entire home directory or a directory containing secrets.

File conflict checks are best effort, not OS-level locks. Recovery drafts are plaintext and not backups. See [usage and safety details](docs/USAGE.md) and [desktop isolation](docs/DESKTOP.md#trust-and-isolation).

## Development and verification

Verified snapshot `4d269a4`:

- [Verify CI](https://github.com/kingshuoxu/inkstone-mdx/actions/runs/44084892798): 38 JS tests, 2 Rust tests, 46 browser tests and 8 baseline/current comparisons passed.
- [Desktop CI](https://github.com/kingshuoxu/inkstone-mdx/actions/runs/44084892678): source interaction, packaging and packaged-app interaction passed on Windows, macOS and Linux.
- Coverage includes Chinese text, multiline syntax, rapid edits, scrolling, undo, worker failure recovery and near-5 MiB editing/saving. Linux has real IBus coverage. Real Windows/macOS IMEs, long-duration stress and complete installer wizards remain untested.
- One intermediate Windows automated save check retained the original text; subsequent runs passed, but that failure's root cause remains unproven.

```sh
npm ci --prefix examples/project --ignore-scripts
npm test
cargo test --manifest-path core/Cargo.toml --locked
npm run build
npm run test:worker
npx playwright install chromium
npm run test:e2e
npm run test:desktop   # Use Xvfb for headless Linux
npm run format:check
```

[Extended validation](docs/EXTENDED-VALIDATION.md) · [Historical report](docs/VALIDATION.md) · [Rust core](core/README.md)

## License

[MIT](LICENSE) © 2026 Inkstone MDX contributors. Use, modify and commercially distribute with the copyright and license notice retained. Provided as-is, without warranty. Dependencies retain their own licenses.
