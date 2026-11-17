# Extended validation

The extended browser and Electron suites exercise near-5 MiB ASCII/Chinese documents, sustained input, exact downloaded/native saved bytes, save-a-copy and recovery. Recovery is conditional on localStorage quota: a 5 MiB source can exceed quota after JSON escaping. The UI must report unavailable recovery and retain the previous draft; a successful file save remains separate. Recovery is debounced and does not guarantee recovery after an abrupt process crash.

Files are decoded strictly as UTF-8. Invalid bytes are rejected before replacing the current document. UTF-8 BOM and uniform CRLF are preserved on edit/save. Mixed newline styles normalize to the first style when edited.

Documents above 1,000,000 logical UTF-16 units pause Markdown syntax parsing/highlighting to keep input responsive. The footer announces this mode in both languages. Editing, undo, search and file operations remain available. Shrinking below the threshold restores syntax support. The 5 MiB file and 512,000 byte preview limits remain unchanged.

A cloud Linux headless Electron CPU profile on the same near-5 MiB ASCII fixture, 20 insertions with preview paused, found Markdown parseInline/finishLeaf dominating before optimization. Input-to-next-frame samples were 305–457 ms before and 6–24 ms after disabling large-document syntax parsing. These are single-run profiling observations, not a universal latency guarantee. CI logs LARGE_FILE metrics (20 samples, median/p95 and renderer JS heap only); heap is not whole-process memory.

Chromium CDP composition tests simulate candidate updates, commit, cancel and undo/redo. They are not human/system IME tests. The separate Linux IBus/libpinyin job sends X11 key events through the actual system input method and checks committed Chinese text. Windows/macOS real system IMEs and human candidate-window interactions are not covered.

Rust/reference rendered-output tests include JSX, expressions, ESM layouts/imports, GFM, Chinese, malformed syntax and recovery, relative TSX/nested MDX and installed npm components. GFM autolinks containing ampersands use the reference compiler because Rust double-escapes their href. Routing conservatively falls back for URL/ampersand combinations and uses linear scans for adversarial long lines. Footnotes and aligned tables also use the reference path. This corpus does not establish compatibility with all npm packages or arbitrary MDX.

Reproduce with `npm ci`, `npm run build:core`, `npm test`, `npm run build`, `npm run test:worker`, `npm run test:e2e`, and `npm run test:desktop`. On Linux use Xvfb for Electron and `dbus-run-session -- xvfb-run -a bash scripts/test-system-ime.sh` with ibus-libpinyin/xdotool installed. CI builds and launches packaged applications on Linux, Windows and macOS; this does not test interactive installer wizard clicks, signing/notarization or all hardware.
