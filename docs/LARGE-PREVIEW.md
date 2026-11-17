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

The [140c845 browser run](https://github.com/kingshuoxu/inkstone-mdx/actions/runs/44097478902) passed all 62 active end-to-end cases (two production-only duplicates skipped). It verified full document markers, bottom-of-document interactive components and subsequent edits, whole-document references/Unicode/footnotes, obsolete compile/render cancellation, and live updates. Native tests and all three desktop platforms passed, including exact-5-MiB trusted projects. The subsequent memory-release change is still being validated.

Measured on that CI runner, not a device-independent guarantee:

| Fixture                      | UTF-8 bytes |   Lines | React-ready after compile start | Observed run-to-ready | DOM elements |
| ---------------------------- | ----------: | ------: | ------------------------------: | --------------------: | -----------: |
| Long paragraphs              |   5,231,639 |   2,762 |                         1.106 s |               2.787 s |        1,391 |
| Rich headings/emphasis/links |   5,234,634 | 303,462 |                        51.253 s |              53.135 s |      455,193 |

Both tests scrolled to the unique final heading, clicked the final Counter and verified a new final heading after editing. The rich case is complete but remains expensive; a source-byte limit alone cannot predict rendering cost. These timings include compilation and React readiness, not just compiler execution. The earlier README editing-only benchmarks are not full-preview timings. The run's later legacy performance comparison failed because its selector did not distinguish the retained preview from a pending replacement; that selector is being corrected separately.
