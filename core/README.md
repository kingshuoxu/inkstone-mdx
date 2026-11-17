# Inkstone Rust compilation core

The core parses MDX/GFM, builds the HTML and SWC trees, rewrites JSX/components, and emits JavaScript. It uses `mdxjs` 1.0.4 and compiles to WebAssembly shared by browser and Electron workers. It does not execute document code or resolve files/modules. The surrounding JavaScript app still owns editing, storage, IPC, esbuild project resolution, rendering, and isolation.

Build from the repository root:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.105 --locked
npm ci
npm run build:core
npm run build
npm test
cargo test --manifest-path core/Cargo.toml --locked
```

Generated WASM/bindings are build artifacts, not committed binaries. CI builds them on Linux, Windows and macOS before packaging. Cargo.lock and wasm-bindgen version are pinned. The old SWC version used by mdxjs requires serde 1.0.219; upgrading it independently breaks compilation.

`compile_mdx(source, program)` returns either a complete module (trusted project bundler) or a function body (standalone preview). Standalone source ESM is rejected by its parsed MDX node type; generated runtime bindings are converted using SWC AST nodes, never source regexes. GFM table whitespace is normalized to avoid invalid React table children. There are no host filesystem/network/plugin callbacks. Emitted document code still executes only in the existing opaque preview sandbox.

## Compatibility and fallback

Automatic mode keeps documents at or below 16,000 JavaScript string units on the JS compiler to avoid WASM cold overhead. Larger documents load Rust lazily. Sources with aligned-table separator lines or containing `[^` conservatively use JS because upstream Rust alignment props and footnote IDs/backlinks differ; this intentionally includes false positives in code/text. Rust parse/transform errors or WASM load failures retry the original compiler and preserve its diagnostics. This is a finite tested compatibility corpus, not proof of complete MDX equivalence. The Rust compiler has no remark/rehype plugin support. Existing project imports/npm packages are still resolved by esbuild under the same root/symlink restrictions; no npm install or project config execution is added.

A syntax failure can incur both compilers' costs. Cancellation/timeouts still terminate the worker. Completed idle browser workers are reused to amortize initialization; typing while compiling terminates stale work. Desktop project workers remain fresh per bundle. Rust does not bound the CPU/memory of emitted JavaScript. Both file and full-preview source limits are 5 MiB. See docs/LARGE-PREVIEW.md for the full-preview behavior and validation.
