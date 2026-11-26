# Desktop updates / 桌面更新

## User flow

Choose **Help → Check for updates** (帮助 → 检查更新) in the desktop application. This is the only action that starts a check; there is no startup/background polling. The main process contacts the public GitHub API for `kingshuoxu/inkstone-mdx`, without sending document contents, file paths, credentials or analytics. GitHub still sees normal network metadata such as the client IP address.

A newer stable release offers the platform's installer. Confirm **Download installer**, choose a destination, and wait for **Installer downloaded and checksum verified**. The Help menu offers cancellation while checking or downloading. On failure/cancellation the partial file is removed and an existing destination is preserved. A successful download replaces the chosen destination only after integrity verification. No installer is executed, and the application does not close or discard your work. Save your work and install manually. Linux AppImage downloads require executable permission before launching; a Debian package can instead be obtained from the Releases page.

Published v0.1.0 has no update-check UI. Install the [latest stable release](https://github.com/kingshuoxu/inkstone-mdx/releases/latest) manually once to gain this feature. Existing v0.1.0 assets remain unchanged.

## Safety and limits

- Native menu/main-process only. No new IPC method is exposed to the renderer or MDX preview, and their network/CSP restrictions remain unchanged.
- Fixed repository, stable `vMAJOR.MINOR.PATCH` tags, exact installer names and HTTPS URLs. No downgrades or prerelease selection.
- macOS arm64/x64 DMG, Windows x64 EXE and Linux x64 AppImage are supported. Other targets or missing assets offer the fixed Releases page, only after confirmation.
- The API response is limited to 256 KiB and 12 seconds. Downloads are streamed to a unique temporary file, capped at 512 MiB and ten minutes, and checked against the release asset's size and SHA-256 digest before rename.
- HTTPS download redirects are restricted to the selected GitHub asset URL and GitHub's `release-assets.githubusercontent.com` CDN. No cookies, auth tokens or arbitrary renderer-supplied URL are used.
- The checksum is obtained from the same GitHub service. It detects file corruption; it is **not a digital signature or proof of publisher authenticity**. Current releases are unsigned and macOS builds are not notarized. Follow your organization's software policy; do not disable OS security globally.
- Network failures/rate limits, invalid metadata or missing checksums fail closed. Users can explicitly open the fixed Releases page to inspect available downloads.

## Future release contract

Future stable releases must use a matching package version and `vX.Y.Z` tag. Installer names follow `Inkstone-MDX-X.Y.Z-mac-arm64.dmg`, `mac-x64.dmg`, `win-x64.exe`, and `linux-x86_64.AppImage`; GitHub must expose a `sha256:` asset digest. Installer size must be 1–512 MiB. Test release metadata and downloads before announcing availability.

The release publisher derives the stable version/tag from package.json, requires matching release notes and exact asset names, and waits for Verify and Desktop on the same commit. Its permissions remain contents-write/actions-read for publication; no actions-write permission is used. An existing public release is never overwritten.

## Repository and issue shortcuts

Desktop **Help → GitHub repository / Report an issue…** opens the fixed project page or new-Issue form in the system browser. Browser users find the same links in **Components & help**. Labels follow the selected interface language.

No Issue is submitted automatically. These links do not include document contents, file paths, logs or diagnostics in query parameters. Review anything you choose to paste into a public Issue. The desktop shortcut adds no renderer/preview IPC or arbitrary-URL opener.
