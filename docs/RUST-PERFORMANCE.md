> Historical report: the full-preview change now allows 5 MiB source. Earlier 512,000-byte preview limits below describe the tested historical revision. See [full-preview validation](LARGE-PREVIEW.md).

# Rust migration measurements

This is a migration of MDX parsing, AST transforms and JavaScript generation, not a Rust rewrite of the UI, file layer, esbuild bundler or React renderer. See [core build and compatibility notes](../core/README.md).

## Compiler-only comparison

`node scripts/bench-core.mjs` runs the original JavaScript compiler and the Rust/WASM adapter in fresh Node processes, with identical UTF-8 inputs, one cold call and five warm calls. Module load time is separate; Rust's cold call includes lazy WASM load/compile/init. RSS is peak whole-process memory across the calls, including both JS fallback dependencies and WASM in Rust mode. No garbage collection is forced. Shared cloud execution is noisy; these are observations, not guaranteed speedups. Pure compiler samples exclude DOM, rendering, IPC, storage and untrusted JS execution.

Cloud Linux, Node 24.22.1, Xeon Platinum 8573C:

| Input           | JS warm median | Rust warm median | JS/Rust peak process RSS |
| --------------- | -------------: | ---------------: | -----------------------: |
| Plain 9,930 B   |         6.1 ms |           2.3 ms |              72 / 93 MiB |
| Plain 99,300 B  |        45.8 ms |          20.8 ms |             107 / 98 MiB |
| Plain 499,479 B |       295.4 ms |          97.6 ms |            254 / 104 MiB |
| Dense 9,990 B   |        73.6 ms |          15.3 ms |            199 / 107 MiB |
| Dense 99,954 B  |       651.8 ms |         198.3 ms |            466 / 125 MiB |
| Dense 499,986 B |     3,342.1 ms |       2,994.8 ms |          1,361 / 249 MiB |

Small plain-document cold compile: JS 31.1 ms vs Rust 76.4 ms (plus module loading 152.2/142.1 ms). This motivates retaining the JS path below the conservative 16,000-string-unit routing threshold; the threshold is not a universal optimum. Rust is not uniformly faster and dense half-megabyte documents remain expensive. WASM is approximately 3.48 MB; its lazy embedded-base64 JS chunk is approximately 4.65 MB before HTTP compression. No small-document WASM fetch is required.

## End-to-end comparison

CI checks out the unchanged baseline `19f4d5b2f5bff49ec2de0a146177fafa8d0485d1`, builds both versions on the same runner and serves both production builds. `npx playwright test --config playwright.perf.config.js` opens dense 10 KB/100 KB files, then measures explicit preview startup and subsequent single-character edits through visible React preview (including debounce, worker startup, compilation and frame rendering), followed by typing during compilation and final-source verification. First-run and three subsequent preview samples are reported separately. Page JS heap excludes workers/WASM and is not total browser memory; compiler process RSS is measured separately above. The results are attached to CI artifacts/logs, not conflated with compiler-only speedups.

Compatibility tests render JSX, spread/nested components, expressions, Unicode, entities, GFM tables/tasks/autolinks, footnote fallback and ESM layouts/named exports with both engines and compare output. Browser CI exercises a failed Rust chunk fetch and cancellation. Desktop CI asserts that real standalone and project previews used Rust in source and packaged apps on all three platforms.

Remaining gaps: sustained IME interaction, full hardware/network matrix, total browser process memory, arbitrary project/plugin compatibility and runtime JS resource budgets. Existing 5 MiB file/IPC and 512,000-byte preview guards remain in place.

The initial benchmark used CDP `Input.insertText` to inject a whole 100 KB multiline document. That operation timed out in both baseline and new versions before compilation, so it was not used as evidence of compiler performance. The revised benchmark opens the exact same file and measures ordinary edits; a separate native clipboard-paste regression test checks the normal bulk-input path. This does not establish performance for a 100 KB IME composition.
