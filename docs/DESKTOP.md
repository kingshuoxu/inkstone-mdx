# Desktop workspaces (draft)

This edition is under active validation. It is not merged into `main`. Browser-only mode still rejects imports. Do not use this application as a hostile-code execution service.

## Start and build

```sh
npm ci
npm ci --prefix examples/project --ignore-scripts
npm run desktop
```

`npm run desktop:dist` builds the current operating system's installer in `release/`: Linux AppImage and deb, Windows NSIS exe, macOS dmg and zip. The Desktop GitHub Actions workflow builds each on its own OS and uploads artifacts. Builds are unsigned and macOS builds are not notarized. OS security prompts are expected; no claim of signed distribution is made. CI artifacts require GitHub access and expire; there is no auto-updater or release publishing.

## Use a project

1. Choose **Open project**, select the narrowest folder containing your MDX, components and installed dependencies, and review the native trust prompt.
2. Choose **Open**, select an MDX file inside that folder, inspect it, and choose **Run preview**.
3. Imports such as `./Welcome.jsx` and installed browser-compatible packages such as `clsx` are bundled. The included `examples/project` demonstrates a stateful local component importing `clsx`.
4. Edit and save normally. **Rebuild** picks up changes to imported files. Dependency files are not watched automatically.
5. **Revoke trust** clears the preview and stops project compilation. Trust expires when the app exits. Source text is retained.

Install dependencies yourself after reviewing them. Inkstone never runs npm, installation hooks, project esbuild/Vite plugins or project configuration scripts. The example install command deliberately disables scripts. Dependencies must physically reside within the selected workspace: pnpm stores and monorepo symlinks outside it are rejected. Choose a suitable common root only if you trust everything inside it.

## Supported boundaries

Relative JS/JSX/TS/TSX, MD/MDX, JSON, CSS and common image assets can be bundled. TypeScript is transpiled without typechecking. React, React DOM and scheduler use Inkstone's runtime versions. Browser-compatible npm packages work when their dependencies resolve inside the workspace. Imports can expose any readable file inside that root to preview code; do not select a broad home folder or a project containing secrets you cannot trust its code with.

Node built-ins, native addons, server-only packages, remote imports, external filesystem paths, escaping symlinks, arbitrary build plugins, framework routing, CSS preprocessors, tsconfig aliases, frontmatter configuration, non-static dynamic imports and arbitrary project runtime equivalence are not supported. Remote resources are blocked; fonts/media remain blocked by preview CSP. Some packages rely on unavailable browser APIs or network access and will fail. Missing imports and syntax errors leave the source intact and show an error.

## Trust and isolation

Only the application main frame has a narrow Electron preload API. The main process validates both sender and frame before every operation. File dialogs select paths; the renderer cannot pass arbitrary filesystem paths to read or write. The bundler runs in a Node worker thread, parses source without evaluating it, and terminates after 15 seconds. It ignores project configuration and checks real resolved paths against the trusted root.

Document/component code executes in an opaque-origin `sandbox="allow-scripts"` iframe loaded from a dedicated preview protocol. It has no Node, preload API or host DOM access. Electron enables context isolation, renderer sandboxing and web security. The application session rejects network requests outside its internal protocols, denies permissions, downloads and new windows, and rejects external frame requests. A frame navigation attempt can replace its content with a blocked/error page; Rebuild restores the preview. Preview CSP also denies network connections and nested frames. The CI launch uses `--no-sandbox` on Linux runners only to accommodate their container; the installed application does not add that flag. A passing CI test is not proof of OS sandbox enforcement.

This is defense in depth for **trusted** projects, not a guarantee for arbitrary hostile JavaScript. CPU/memory denial of service can freeze or crash the app. Native compiler/parser vulnerabilities, browser vulnerabilities and races with another process modifying files are outside the guarantees. There is no runtime time/memory budget or independent security audit. If the preview hangs, quit/relaunch; the recovery draft is restored with execution paused.

## Save semantics

Native saves compare the on-disk source with the open/save baseline, write a same-directory temporary file, flush and close it, recheck the baseline, then rename into place. Conflicts and failures preserve editor text; use **Save a copy** to keep both versions. Symbolic-link save targets are rejected. This is best-effort conflict detection, not an OS-wide file lock or a power-loss guarantee. Metadata beyond mode bits and the old inode are not preserved. Plaintext recovery is stored in the Electron user profile and is not a backup.

## Verification

`npm test` covers actual component/npm bundling, rejected imports, root/symlink boundaries and native save conflicts. `npm run test:desktop` launches Electron with real preload, main process and preview; only native dialog selections are stubbed. It tests component state, isolation, native save/conflicts, error recovery and trust revocation and writes `docs/desktop-project.png`. The workflow builds installers after interaction tests; installer creation alone does not prove an installed app launches. See the PR and CI results for current status.
