# File and preview limits: rationale and measurements

These are conservative implementation guardrails, not MDX format limits or experimentally determined universal thresholds. This revision retains them.

- **Open: 5 MiB (5,242,880 bytes)**. Browser loading reads the whole file; desktop `readDocument` checks size before reading UTF-8. The desktop IPC also caps source sent for save/compile at 5 MiB. This bounds whole-document reads/copies and IPC. Editing rebuilds a string, scans words/lines and serializes a plaintext recovery draft on each change. Browser localStorage quota is independent and may be exhausted below this limit, because browser quota accounting differs from UTF-8 file size. The app warns when recovery fails. Browser downloads can save larger editor buffers; native desktop save rejects a source above its IPC cap. Neither path provides streaming editing.
- **Preview source: 512,000 UTF-8 bytes (500 KiB)** in browser and project compilers. This bounds parser work and the input to executable preview, but bytes alone do not bound AST size, React/DOM nodes or arbitrary JS behavior. Browser compilation times out after 5 seconds, project bundling after 15 seconds; running preview JS has no time/memory budget. Even a small trusted document can be expensive.
- **Project output: 10 MiB**; preview IPC accepts at most 12 MiB of HTML string. These are additional guards, not promises that every bundle below them runs smoothly.

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

A separate five-sample Node probe of JSON draft serialization plus word/line scans took 3.5–6.9 ms for 1 MiB, 9.2–80.9 ms for 5 MiB, and 15.4–27.3 ms for 10 MiB. These noisy figures exclude CodeMirror and synchronous localStorage writes and cannot justify raising the editor limit. The existing browser input test covers 105.6 KB with preview paused, not multi-megabyte editing.

## Decision

Keep both limits. One-MiB plain text compiling quickly is not evidence that one-MiB MDX is generally safe. Raising the open limit also needs large-document browser/desktop input, IME, recovery quota and save tests, plus less whole-document work per keystroke. Better future options include explicitly paused large-file mode, delayed/incremental recovery, opt-in preview policies and runtime resource controls. No hidden override or automatic execution of oversized documents was added.

## Boundary regression coverage

Tests accept exactly 5 MiB and reject an extra byte for native source IPC, round-trip a 5 MiB Unicode file and copy, reject oversized opens, and exercise actual Electron save/copy rejection before a save dialog or write. Both compiler paths accept 512,000 UTF-8 bytes and reject 512,001. Recovery quota failures preserve source and still allow downloading a copy. These boundary tests establish correctness, not a large-file responsiveness claim.
