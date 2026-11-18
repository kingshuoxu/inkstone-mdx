# File and preview limits: rationale and measurements

These are conservative implementation guardrails, not MDX format limits or experimentally determined universal thresholds. This revision supports complete previews up to the existing 5 MiB file limit; it does not truncate the document or silently substitute static Markdown.

- **Open: 5 MiB (5,242,880 bytes)**. Browser loading reads the whole file; desktop `readDocument` checks size before reading UTF-8. The desktop IPC also caps source sent for save/compile at 5 MiB. This bounds whole-document reads/copies and IPC. Editing still rebuilds a string on each change. For buffers over 200,000 JavaScript string units, word/line scans wait 100 ms and draft serialization/storage waits for a 200 ms editing pause. Pending drafts flush on page hide/unload, but sudden process termination can lose a pending draft. Browser localStorage quota is independent and may be exhausted below this limit, because browser quota accounting differs from UTF-8 file size. The app warns when recovery fails. Browser downloads can save larger editor buffers; native desktop save rejects a source above its IPC cap. Neither path provides streaming editing.
- **Preview source: 5 MiB (5,242,880 UTF-8 bytes)** in browser and project compilers. This bounds parser work and the input to executable preview, but bytes alone do not bound AST size, React/DOM nodes or arbitrary JS behavior. Standalone compilation times out after 5 seconds for inputs at or below 512,000 bytes, or 120 seconds for larger inputs; desktop project bundling always has a 120-second budget because small entry files can import large MDX. A new render must report readiness within 60 seconds; running preview JS has no time/memory budget. Even a small trusted document can be expensive.
- **Compiled standalone / project output: 64 MiB**; desktop preview IPC accepts at most 80 MiB of UTF-8 HTML. Project workers have a 2 GiB V8 old-generation heap limit (not a total-process or WASM memory cap). These are additional guards, not promises that every bundle below them runs smoothly.

## Reproduce

```sh
node scripts/bench-limits.mjs
```

The diagnostic intentionally bypasses the application preview-source guard only in isolated Node children. Each case has a 20-second timeout and a 768 MiB V8 old-space limit (this does not cap total process RSS). Three fresh processes per case run one cold MDX+GFM compilation. Plain input has long paragraphs; dense input repeats headings, emphasis, expressions and JSX components.

Cloud Linux, Node 24.22.1, Intel Xeon Platinum 8573C:

| Input     | Approx. UTF-8 bytes | Compile range (3 samples) | Maximum observed process RSS |
| --------- | ------------------: | ------------------------: | ---------------------------: |
| Plain     |             128,000 |                116–139 ms |                       70 MiB |
| Plain     |             512,000 |                345–412 ms |                       94 MiB |
| Plain     |           1,048,576 |                562–644 ms |                      114 MiB |
| Dense MDX |             128,000 |            1,609–1,676 ms |                      309 MiB |
| Dense MDX |             512,000 |            4,274–5,499 ms |                      647 MiB |
| Dense MDX |           1,048,576 |          10,765–17,132 ms |                      939 MiB |

RSS includes the entire Node process and compiler dependencies. It is not compiler-only allocation. These samples exclude browser input, DOM/React rendering, localStorage, Electron IPC, and preview JavaScript execution. They do not establish a hard performance boundary. Actual byte counts are slightly lower because fixtures use complete repeated units.

A separate five-sample Node probe of JSON draft serialization plus word/line scans took 3.5–6.9 ms for 1 MiB, 9.2–80.9 ms for 5 MiB, and 15.4–27.3 ms for 10 MiB. These noisy figures exclude CodeMirror and synchronous localStorage writes and cannot justify raising the editor limit. The browser input tests cover 105.6 KB and 1,056 KB with preview paused, not arbitrary multi-megabyte or executing documents.

## Full-document preview behavior

The entire source is parsed together, preserving JSX, JavaScript scope, references and footnotes. The last successful preview stays visible during recompilation and until the new React tree commits. Large previews use CSS content-visibility for offscreen layout only: all React components and DOM nodes still exist, so this does not bound allocation or stop component effects. Compilation can be cancelled by editing, pausing or opening another file; no partial prefix is labelled a complete preview.

Imported/recovered documents still require explicit trust before executing MDX. The previous blank paused panel is now an explanatory prompt. A malformed, resource-heavy or non-terminating document can fail or hang despite being below the byte limit; the application does not claim a secure CPU/memory sandbox for arbitrary document JavaScript.

The historical measurements above explain the former smaller cap, not the new implementation's measured performance. New full-preview test evidence is recorded separately in LARGE-PREVIEW.md.

## Boundary regression coverage

Tests accept exactly 5 MiB and reject an extra byte for native source IPC, round-trip a 5 MiB Unicode file and copy, reject oversized opens, and exercise actual Electron save/copy rejection before a save dialog or write. Both compiler paths accept 5 MiB UTF-8 bytes and reject one extra byte. Recovery quota failures preserve source and still allow downloading a copy. These boundary tests establish correctness, not a large-file responsiveness claim.
