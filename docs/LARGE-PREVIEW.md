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

Validation is in progress for the initial implementation. Automated cases cover complete roughly 5 MiB plain and richly formatted documents (including the prior 300,000-line fixture), bottom-of-document markers and interactive components, whole-document references/Unicode/footnotes, stale compilation cancellation, and exact-5-MiB trusted desktop projects. Results and actual timings will be recorded after CI completes. Editing-only benchmark numbers in the README are not full-preview timings.
