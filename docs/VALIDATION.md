# Validation — updated 2026-11-17

## Completed

- `npm test`: 7/7 tests pass (MDX/GFM, import/export refusal, syntax/size errors, recovery, conflicting saves, write/close/abort semantics, script-payload escaping and CSP).
- Production Vite build passes. Initial output: host JS 849.24 kB / 284.76 kB gzip, compiler worker 500.85 kB, CSS 6.39 kB / 2.14 kB gzip. The host includes the bundled React preview runtime as a string. Vite's chunk-size warning is acknowledged; startup bundle optimization remains future work.
- Actual Node compiler benchmark: Linux, Node v24.22.1, Intel Xeon Platinum 8573C. One warmup, 10 measurements per size. Repeated MDX headings, emphasis, JS expressions and Badge components.

| UTF-8 bytes |     Median |        p90 |
| ----------: | ---------: | ---------: |
|       9,940 |    94.6 ms |   151.5 ms |
|      99,968 |   600.1 ms |   670.3 ms |
|     299,975 | 1,647.9 ms | 1,697.8 ms |

These measure compiler work, not full browser latency. Worker startup, debounce, frame construction and React rendering are additional costs. Compilation does not run in the editor's main thread; full-source draft serialization and word counts still run there and need profiling for large documents. No claim of universally low typing latency is made.

## Original authoring environment limitations

The original six Playwright browser scenarios were attempted but the browser failed **before any test body**: Chromium could not create its process-singleton socket (`Operation not permitted`) in this execution environment. A second review tried the installed Chromium and the supported escalated execution path; both encountered the same socket restriction. A seventh regression now checks default-paused file opening and explicit trust confirmation, but it has not run in a functioning browser. The cloud browser could not connect to the local Vite URL (`ERR_CONNECTION_REFUSED`). Therefore browser integration, sandbox enforcement, input-to-frame timings, native save UI behavior, download behavior and visual screenshots remain unverified. Tests are committed for a normal local/CI environment; this is an implementation awaiting browser qualification, not a fully validated release.

Manual review still required at desktop and narrow mobile widths, plus keyboard and screen-reader checks. Browsers other than Chromium have not been exercised. File System Access behavior varies by browser.

## Security reasoning checked in source

The sole `new Function` call lives in the bundled iframe runtime. Parent code does not install a message listener. File handles remain lexical variables in the parent module. The iframe sandbox does not grant same-origin, popup, navigation or download capabilities. Browser enforcement of these properties has not been verified in this restricted environment. Runtime CPU/memory isolation is explicitly not guaranteed.

## Follow-up security review

Opened local documents and recovered drafts no longer auto-execute. Preview starts paused and requires an explicit trust confirmation; cancellation leaves the iframe absent. The bundled sample remains auto-previewed. Updated browser regressions cover recovery and file-open trust, but remain unexecuted due to the environment restriction. Core tests (7/7), production build and formatting were re-run successfully after this change. The updated host JavaScript is approximately 850.00 kB (285.00 kB gzip).

## Browser qualification on GitHub Actions — 2026-11-17

[Verify run 44006580311](https://github.com/kingshuoxu/inkstone-mdx/actions/runs/44006580311) passed core tests (7/7), production build, formatting, the actual built-worker smoke check, and browser tests (14/14: seven scenarios each against Vite development and production preview servers).

The original CI failure had three causes: the entity decoder's browser export accessed `document` while initializing inside a DOM-free Worker; the large contenteditable `fill()` timed out; and the recovery assertion matched multiple headings in the intentionally retained old preview. The fix resolves the decoder's DOM-free entry, opens a large file fixture before measuring real keyboard input, and targets level-one headings so assertions can wait for the replacement preview.

Browser coverage includes real React state, mode switching, syntax/runtime errors and recovery, parent DOM/storage/fetch restrictions, Unicode file download, native-write failure via a mocked file handle, and explicit trust confirmation before running opened documents. Native OS picker dialogs themselves remain outside automation coverage. Firefox, Safari and assistive-technology behavior have not been qualified.

Screenshots at 1440×960 and 390×844 were inspected. The stacked mobile panes fit without horizontal page overflow. Visual review found duplicate gutter padding shifting line numbers by 26 px; the padding was removed and a bounding-box assertion now checks line-number alignment. CI keeps desktop/mobile images, failure screenshots and failure traces in its `browser-evidence` artifact.

Input measurements from the passing run (Chromium on GitHub-hosted Ubuntu, 105,600-byte document, 20 keyboard insertions, preview paused):

| Build       | Median beforeinput → next frame |     p95 |
| ----------- | ------------------------------: | ------: |
| Development |                         10.7 ms | 16.1 ms |
| Production  |                         10.1 ms | 17.5 ms |

These are sampled event-to-frame measurements, not end-to-end hardware typing latency, INP, or performance guarantees. With the DOM-free entity table bundled, the compiler worker is 529.48 kB uncompressed; the host remains approximately 850 kB / 285 kB gzip. Startup bundle reduction and runtime CPU/memory isolation remain future work.
