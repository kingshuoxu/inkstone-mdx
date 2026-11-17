# Validation — 2026-11-16

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

## Blocked / not passed

The original six Playwright browser scenarios were attempted but the browser failed **before any test body**: Chromium could not create its process-singleton socket (`Operation not permitted`) in this execution environment. A second review tried the installed Chromium and the supported escalated execution path; both encountered the same socket restriction. A seventh regression now checks default-paused file opening and explicit trust confirmation, but it has not run in a functioning browser. The cloud browser could not connect to the local Vite URL (`ERR_CONNECTION_REFUSED`). Therefore browser integration, sandbox enforcement, input-to-frame timings, native save UI behavior, download behavior and visual screenshots remain unverified. Tests are committed for a normal local/CI environment; this is an implementation awaiting browser qualification, not a fully validated release.

Manual review still required at desktop and narrow mobile widths, plus keyboard and screen-reader checks. Browsers other than Chromium have not been exercised. File System Access behavior varies by browser.

## Security reasoning checked in source

The sole `new Function` call lives in the bundled iframe runtime. Parent code does not install a message listener. File handles remain lexical variables in the parent module. The iframe sandbox does not grant same-origin, popup, navigation or download capabilities. Browser enforcement of these properties has not been verified in this restricted environment. Runtime CPU/memory isolation is explicitly not guaranteed.

## Follow-up security review

Opened local documents and recovered drafts no longer auto-execute. Preview starts paused and requires an explicit trust confirmation; cancellation leaves the iframe absent. The bundled sample remains auto-previewed. Updated browser regressions cover recovery and file-open trust, but remain unexecuted due to the environment restriction. Core tests (7/7), production build and formatting were re-run successfully after this change. The updated host JavaScript is approximately 850.00 kB (285.00 kB gzip).
