# Complete large-file previews

This change compiles the entire MDX document up to the existing 5 MiB file limit, rather than refusing everything above 512,000 UTF-8 bytes. It never splits source at arbitrary lines or shows a truncated prefix as a complete document. JSX, expressions, reference definitions, footnotes and project scope retain their compiler semantics.

## Execution and limits

- Explicit document/project trust is unchanged. MDX is executable JavaScript.
- Source compilation runs off the editor thread. Large standalone compiler workers are released after each result so their peak WASM linear memory is not retained while the full preview renders. Obsolete results are never displayed. Pausing or opening a different file cancels work immediately.
- The last successful preview stays visible while a replacement compiles and renders. The status distinguishes compilation from full React-tree readiness.
- Large previews use CSS content-visibility to defer offscreen layout, not component execution or DOM creation. The entire document remains present; large React trees still consume memory.
- Standalone source above 512,000 bytes gets a 120-second compile budget, smaller inputs 5 seconds. Project compilation gets 120 seconds. A new render reports readiness within 60 seconds or is rejected.
- Source is limited to 5 MiB, compiled output to 64 MiB, desktop preview HTML to 80 MiB. These are guards, not guarantees that arbitrary MDX is fast or safe. Errors preserve source and the last good preview.
- Runtime JavaScript can still freeze its renderer; the iframe sandbox prevents app access, not arbitrary CPU/memory use.

## Compiler work

The Rust production JSX rewrite used to request line locations for every tag even though production output never uses those reference locations. The upstream line lookup scans from line one, causing superlinear work on documents with many lines and tags. This revision skips only that unused production-stage mapping; parsing and prior transforms retain source locations. A Rust test compares generated code byte-for-byte with the previous location-enabled path, including Unicode, component references and project ESM.

## Validation

Code snapshot `cea179ea4247bfa4863548546746da19797a1832` passed [Verify run 44262522045](https://github.com/kingshuoxu/inkstone-mdx/actions/runs/44262522045): 39 JS tests, project Rust tests, 62 active browser cases (two expected skips), 8 performance comparisons, 178 upstream Markdown tests and 36 identical parser-output hashes. [Desktop run 44262521948](https://github.com/kingshuoxu/inkstone-mdx/actions/runs/44262521948) passed source and packaged-app interaction on Windows, macOS and Linux, including exact-5-MiB trusted projects.

The parser now uses an indexed edit map to avoid repeatedly scanning all preceding edits. The regression checks compare the patched parser with pinned upstream, including source positions and complete output hashes. No grammar or renderer semantics are intentionally changed.

Measured once per fixture on that GitHub Actions Linux runner in Chromium with a production build, not a repeated-run median or device-independent guarantee:

| Fixture                      | UTF-8 bytes |   Lines | React-ready after compile start | Observed after enabling preview | DOM elements |
| ---------------------------- | ----------: | ------: | ------------------------------: | ------------------------------: | -----------: |
| Long paragraphs              |   5,231,639 |   2,762 |                         1.504 s |                         3.384 s |        1,391 |
| Rich headings/emphasis/links |   5,234,634 | 303,462 |                        13.741 s |                        15.768 s |      455,193 |

Both cases scroll to the unique final heading, click the final Counter and verify a new final heading after editing. Tests also cover references, Unicode, footnotes and obsolete compile/render cancellation. These timings include compilation and React readiness, not just parsing. The rich case remains expensive: source byte count alone cannot predict rendering cost.

Screenshots and their checksums are documented in [screenshot provenance](screenshots/README.md). The browser artifact contains `full-preview-*.json` for the timing observations and `parser-regression/` for upstream and differential results.
