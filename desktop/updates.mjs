import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const REPOSITORY = "kingshuoxu/inkstone-mdx";
const API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const METADATA_LIMIT = 256 * 1024;
const MIN_ASSET = 1024 * 1024;
const MAX_ASSET = 512 * 1024 * 1024;
const DOWNLOAD_TIMEOUT = 10 * 60 * 1000;

function versionParts(value) {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)
  )
    throw Error("Invalid stable release version.");
  return value.split(".").map(BigInt);
}
function newer(a, b) {
  const left = versionParts(a),
    right = versionParts(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i];
  }
  return false;
}
function requestScope(signal, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(Error("Update request timed out.")),
    timeout,
  );
  timer.unref?.();
  return {
    signal: signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal,
    close() {
      clearTimeout(timer);
    },
  };
}
async function withAbort(promise, signal) {
  signal.throwIfAborted();
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
async function readBounded(response, limit, signal) {
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    await response.body?.cancel();
    throw Error("Update response is too large.");
  }
  if (!response.body) throw Error("Empty update response.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await withAbort(reader.read(), signal);
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw Error("Update response is too large.");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
function assetName(version, platform, arch) {
  const suffix = {
    "darwin:arm64": "mac-arm64.dmg",
    "darwin:x64": "mac-x64.dmg",
    "win32:x64": "win-x64.exe",
    "linux:x64": "linux-x86_64.AppImage",
  }[`${platform}:${arch}`];
  return suffix ? `Inkstone-MDX-${version}-${suffix}` : null;
}
function checkedAsset(asset) {
  if (!asset || typeof asset !== "object") throw Error("Invalid update asset.");
  versionParts(asset.version);
  const names = [
    "mac-arm64.dmg",
    "mac-x64.dmg",
    "win-x64.exe",
    "linux-x86_64.AppImage",
  ];
  if (
    !names.some(
      (suffix) => asset.name === `Inkstone-MDX-${asset.version}-${suffix}`,
    )
  )
    throw Error("Invalid update asset name.");
  const expected = `https://github.com/${REPOSITORY}/releases/download/v${asset.version}/${asset.name}`;
  if (
    asset.url !== expected ||
    !/^[a-f0-9]{64}$/.test(asset.sha256) ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < MIN_ASSET ||
    asset.size > MAX_ASSET
  )
    throw Error("Invalid update asset metadata or checksum.");
  return {
    version: asset.version,
    name: asset.name,
    url: expected,
    size: asset.size,
    sha256: asset.sha256,
  };
}

/** A manual check only. No document, path, account or credential data is sent. */
export async function checkForUpdate({
  currentVersion,
  platform = process.platform,
  arch = process.arch,
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  versionParts(currentVersion);
  const scope = requestScope(signal, 12000);
  try {
    scope.signal.throwIfAborted();
    const response = await withAbort(
      fetchImpl(API, {
        redirect: "error",
        credentials: "omit",
        signal: scope.signal,
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Inkstone-MDX-update-check",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }),
      scope.signal,
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw Error(
        response.status === 403 || response.status === 429
          ? "GitHub update rate limit reached. Try again later."
          : `Update check failed (HTTP ${response.status}).`,
      );
    }
    const release = JSON.parse(
      await readBounded(response, METADATA_LIMIT, scope.signal),
    );
    if (
      !release ||
      release.draft !== false ||
      release.prerelease !== false ||
      typeof release.tag_name !== "string" ||
      !release.tag_name.startsWith("v")
    )
      throw Error("Invalid stable release metadata.");
    const version = release.tag_name.slice(1);
    versionParts(version);
    const releaseUrl = `https://github.com/${REPOSITORY}/releases/tag/v${version}`;
    if (!newer(version, currentVersion))
      return { status: "current", version, releaseUrl };
    const name = assetName(version, platform, arch);
    if (!name) return { status: "unsupported", version, releaseUrl };
    if (!Array.isArray(release.assets)) throw Error("Invalid release assets.");
    const matches = release.assets.filter((a) => a?.name === name);
    if (matches.length !== 1)
      return { status: "unsupported", version, releaseUrl };
    const candidate = matches[0];
    if (
      typeof candidate.digest !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(candidate.digest)
    )
      throw Error("The release has no valid SHA-256 checksum.");
    const asset = checkedAsset({
      version,
      name,
      url: candidate.browser_download_url,
      size: candidate.size,
      sha256: candidate.digest.slice(7),
    });
    return { status: "available", version, releaseUrl, asset };
  } finally {
    scope.close();
  }
}

async function downloadResponse(url, fetchImpl, signal) {
  let current = url;
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    const response = await withAbort(
      fetchImpl(current, {
        redirect: "manual",
        credentials: "omit",
        signal,
        headers: {
          "User-Agent": "Inkstone-MDX-update-download",
          "Accept-Encoding": "identity",
        },
      }),
      signal,
    );
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === 3)
        throw Error("Invalid update download redirect.");
      const next = new URL(location, current);
      if (
        next.protocol !== "https:" ||
        next.username ||
        next.password ||
        next.port ||
        next.hash ||
        !(
          next.href === url ||
          next.hostname === "release-assets.githubusercontent.com"
        )
      )
        throw Error("Untrusted update download redirect.");
      current = next.href;
      continue;
    }
    if (response.status !== 200) {
      await response.body?.cancel();
      throw Error(`Update download failed (HTTP ${response.status}).`);
    }
    return response;
  }
  throw Error("Too many update download redirects.");
}

/** Saves a verified installer only. Never executes it or replaces the running app. */
export async function downloadUpdate(
  asset,
  destination,
  { fetchImpl = globalThis.fetch, signal } = {},
) {
  const verified = checkedAsset(asset);
  if (typeof destination !== "string" || !path.isAbsolute(destination))
    throw Error("Invalid installer destination.");
  const scope = requestScope(signal, DOWNLOAD_TIMEOUT);
  const temporary = `${destination}.partial-${randomUUID()}`;
  let file, reader;
  try {
    scope.signal.throwIfAborted();
    const response = await downloadResponse(
      verified.url,
      fetchImpl,
      scope.signal,
    );
    const declared = response.headers.get("content-length");
    if (
      declared &&
      (!/^\d+$/.test(declared) || Number(declared) !== verified.size)
    ) {
      await response.body?.cancel();
      throw Error("Installer size does not match release metadata.");
    }
    if (!response.body) throw Error("Empty installer response.");
    reader = response.body.getReader();
    file = await fs.open(temporary, "wx", 0o600);
    const hash = createHash("sha256");
    let size = 0;
    while (true) {
      scope.signal.throwIfAborted();
      const { done, value } = await withAbort(reader.read(), scope.signal);
      scope.signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > verified.size)
        throw Error("Installer exceeds its declared size.");
      hash.update(value);
      await file.writeFile(value);
    }
    if (size !== verified.size || hash.digest("hex") !== verified.sha256)
      throw Error("Installer checksum or size verification failed.");
    await file.sync();
    await file.close();
    file = null;
    scope.signal.throwIfAborted();
    await fs.rename(temporary, destination);
    return { path: destination, bytes: size, sha256: verified.sha256 };
  } finally {
    scope.close();
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
    await file?.close().catch(() => {});
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}
