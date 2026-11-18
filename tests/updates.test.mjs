import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { checkForUpdate, downloadUpdate } from "../desktop/updates.mjs";
const bytes = Buffer.alloc(1024 * 1024, 42);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const version = "0.2.0";
const name = `Inkstone-MDX-${version}-linux-x86_64.AppImage`;
const url = `https://github.com/kingshuoxu/inkstone-mdx/releases/download/v${version}/${name}`;
const asset = { version, name, url, size: bytes.length, sha256 };
function release(overrides = {}) {
  return {
    tag_name: `v${version}`,
    draft: false,
    prerelease: false,
    assets: [
      {
        name,
        size: bytes.length,
        digest: `sha256:${sha256}`,
        browser_download_url: url,
      },
    ],
    ...overrides,
  };
}
const check = (data, options = {}) =>
  checkForUpdate({
    currentVersion: "0.1.0",
    platform: "linux",
    arch: "x64",
    fetchImpl: async () => Response.json(data),
    ...options,
  });
async function sandbox(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "inkstone-updater-"));
  try {
    await fn(dir, path.join(dir, "installer.AppImage"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("manual update check uses fixed public API and validated installer", async () => {
  let requested;
  const result = await check(release(), {
    fetchImpl: async (url, options) => {
      requested = { url, options };
      return Response.json(release());
    },
  });
  assert.equal(result.status, "available");
  assert.deepEqual(result.asset, asset);
  assert.equal(
    requested.url,
    "https://api.github.com/repos/kingshuoxu/inkstone-mdx/releases/latest",
  );
  assert.equal(requested.options.redirect, "error");
  assert.equal(requested.options.credentials, "omit");
  assert.equal(requested.options.headers.Authorization, undefined);
});

test("equal or older releases never offer a downgrade; semver is numeric", async () => {
  for (const currentVersion of ["0.2.0", "0.3.0", "1.0.0", "0.10.0"])
    assert.equal(
      (await check(release(), { currentVersion })).status,
      "current",
    );
  assert.equal(
    (await check(release(), { currentVersion: "0.0.99" })).status,
    "available",
  );
  assert.equal(
    (
      await check(release({ tag_name: "v0.10.0", assets: [] }), {
        currentVersion: "0.9.0",
      })
    ).status,
    "unsupported",
  );
});

test("rejects nonstable, draft, invalid or missing version metadata", async () => {
  for (const data of [
    release({ prerelease: true }),
    release({ draft: true }),
    release({ draft: undefined }),
    release({ tag_name: "v0.2.0-beta.1" }),
    release({ tag_name: "v01.2.0" }),
    release({ tag_name: "0.2.0" }),
    release({ tag_name: "v0.2" }),
    null,
  ])
    await assert.rejects(check(data), /Invalid stable/);
  await assert.rejects(
    check(release(), { currentVersion: "1.0.0-beta" }),
    /Invalid stable/,
  );
});

test("selects exact native macOS and Windows packages and rejects unsupported architecture", async () => {
  for (const [platform, arch, suffix] of [
    ["darwin", "arm64", "mac-arm64.dmg"],
    ["darwin", "x64", "mac-x64.dmg"],
    ["win32", "x64", "win-x64.exe"],
  ]) {
    const chosen = `Inkstone-MDX-${version}-${suffix}`;
    const data = release({
      assets: [
        {
          name: chosen,
          size: bytes.length,
          digest: `sha256:${sha256}`,
          browser_download_url: `https://github.com/kingshuoxu/inkstone-mdx/releases/download/v${version}/${chosen}`,
        },
      ],
    });
    assert.equal((await check(data, { platform, arch })).asset.name, chosen);
  }
  for (const [platform, arch] of [
    ["linux", "arm64"],
    ["win32", "ia32"],
    ["freebsd", "x64"],
  ])
    assert.equal(
      (await check(release(), { platform, arch })).status,
      "unsupported",
    );
  assert.equal((await check(release({ assets: [] }))).status, "unsupported");
  assert.equal(
    (
      await check(
        release({ assets: [...release().assets, ...release().assets] }),
      )
    ).status,
    "unsupported",
  );
});

test("rejects spoofed asset hosts, paths, query strings, digests and sizes", async () => {
  const mutations = [
    { browser_download_url: url.replace("github.com", "github.com.evil.test") },
    { browser_download_url: url.replace("kingshuoxu", "attacker") },
    { browser_download_url: url + "?x=1" },
    { browser_download_url: url.replace("https:", "http:") },
    { digest: null },
    { digest: "sha256:" + "z".repeat(64) },
    { size: 1 },
    { size: 513 * 1024 * 1024 },
    { size: 1024 * 1024 + 0.1 },
  ];
  for (const mutation of mutations)
    await assert.rejects(
      check(release({ assets: [{ ...release().assets[0], ...mutation }] })),
      /Invalid|checksum/,
    );
});

test("handles HTTP errors, offline, malformed and oversized metadata", async () => {
  for (const status of [403, 404, 429, 500])
    await assert.rejects(
      check(null, {
        fetchImpl: async () => new Response("failure", { status }),
      }),
      /failed|rate limit/,
    );
  await assert.rejects(
    check(null, {
      fetchImpl: async () => {
        throw Error("offline");
      },
    }),
    /offline/,
  );
  await assert.rejects(
    check(null, { fetchImpl: async () => new Response("not json") }),
    SyntaxError,
  );
  await assert.rejects(
    check(null, {
      fetchImpl: async () => new Response("x".repeat(256 * 1024 + 1)),
    }),
    /too large/,
  );
  await assert.rejects(
    check(null, {
      fetchImpl: async () =>
        new Response("{}", { headers: { "content-length": "9999999" } }),
    }),
    /too large/,
  );
});

test("already-cancelled checks do not access the network", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    check(null, {
      signal: controller.signal,
      fetchImpl: async () => {
        calls++;
        return Response.json(release());
      },
    }),
    /abort/i,
  );
  assert.equal(calls, 0);
});

test("downloads, verifies and atomically replaces only a complete installer", async () =>
  sandbox(async (dir, destination) => {
    await fs.writeFile(destination, "previous installer");
    const result = await downloadUpdate(asset, destination, {
      fetchImpl: async () =>
        new Response(bytes, {
          headers: { "content-length": String(bytes.length) },
        }),
    });
    assert.equal(result.sha256, sha256);
    assert.deepEqual(await fs.readFile(destination), bytes);
    assert.deepEqual(await fs.readdir(dir), ["installer.AppImage"]);
  }));

test("permits only GitHub's HTTPS release CDN redirect", async () =>
  sandbox(async (dir, destination) => {
    const calls = [];
    await downloadUpdate(asset, destination, {
      fetchImpl: async (url, options) => {
        calls.push(url);
        assert.equal(options.redirect, "manual");
        return calls.length === 1
          ? new Response(null, {
              status: 302,
              headers: {
                location:
                  "https://release-assets.githubusercontent.com/example?signature=public",
              },
            })
          : new Response(bytes);
      },
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(await fs.readFile(destination), bytes);
  }));

test("rejects redirects to untrusted hosts, userinfo, ports and insecure schemes", async () =>
  sandbox(async (dir, destination) => {
    for (const location of [
      "https://evil.test/file",
      "http://release-assets.githubusercontent.com/file",
      "https://release-assets.githubusercontent.com.evil.test/file",
      "https://user:password@release-assets.githubusercontent.com/file",
      "https://release-assets.githubusercontent.com:444/file",
      "https://github.com/attacker/release",
      "https://release-assets.githubusercontent.com/file#fragment",
    ]) {
      await assert.rejects(
        downloadUpdate(asset, destination, {
          fetchImpl: async () =>
            new Response(null, { status: 302, headers: { location } }),
        }),
        /Untrusted/,
      );
      assert.deepEqual(await fs.readdir(dir), []);
    }
  }));

test("redirect loops and HTTP partial/error responses fail closed", async () =>
  sandbox(async (dir, destination) => {
    let count = 0;
    await assert.rejects(
      downloadUpdate(asset, destination, {
        fetchImpl: async () => {
          count++;
          return new Response(null, {
            status: 302,
            headers: { location: url },
          });
        },
      }),
      /redirect/,
    );
    assert.equal(count, 4);
    for (const status of [206, 403, 404, 500])
      await assert.rejects(
        downloadUpdate(asset, destination, {
          fetchImpl: async () => new Response("error", { status }),
        }),
        /failed/,
      );
    assert.deepEqual(await fs.readdir(dir), []);
  }));

test("corrupt, truncated, oversized or wrong-length installers leave prior file untouched", async () =>
  sandbox(async (dir, destination) => {
    await fs.writeFile(destination, "keep");
    for (const response of [
      new Response(Buffer.alloc(bytes.length, 43)),
      new Response(bytes.subarray(0, bytes.length - 1)),
      new Response(Buffer.concat([bytes, Buffer.from([1])])),
      new Response(bytes, { headers: { "content-length": "10" } }),
    ]) {
      await assert.rejects(
        downloadUpdate(asset, destination, { fetchImpl: async () => response }),
        /checksum|size|exceeds/,
      );
      assert.equal(await fs.readFile(destination, "utf8"), "keep");
      assert.deepEqual(await fs.readdir(dir), ["installer.AppImage"]);
    }
  }));

test("download cancellation or stream failure cleans partial files without replacing destination", async () =>
  sandbox(async (dir, destination) => {
    await fs.writeFile(destination, "keep");
    const controller = new AbortController();
    const stream = new ReadableStream({
      pull(c) {
        c.enqueue(bytes.subarray(0, 100));
        controller.abort();
      },
    });
    await assert.rejects(
      downloadUpdate(asset, destination, {
        signal: controller.signal,
        fetchImpl: async () => new Response(stream),
      }),
      /abort/i,
    );
    const broken = new ReadableStream({
      start(c) {
        c.error(Error("disconnected"));
      },
    });
    await assert.rejects(
      downloadUpdate(asset, destination, {
        fetchImpl: async () => new Response(broken),
      }),
      /disconnected/,
    );
    assert.equal(await fs.readFile(destination, "utf8"), "keep");
    assert.deepEqual(await fs.readdir(dir), ["installer.AppImage"]);
  }));

test("download revalidates asset metadata and rejects relative destinations before network access", async () =>
  sandbox(async (dir, destination) => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return new Response(bytes);
    };
    for (const bad of [
      { ...asset, url: "https://evil.test" },
      { ...asset, sha256: "" },
      { ...asset, name: "../evil" },
    ])
      await assert.rejects(
        downloadUpdate(bad, destination, { fetchImpl }),
        /Invalid/,
      );
    await assert.rejects(
      downloadUpdate(asset, "relative.exe", { fetchImpl }),
      /destination/,
    );
    assert.equal(calls, 0);
    assert.deepEqual(await fs.readdir(dir), []);
  }));

test("metadata deadline aborts a stalled request", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const promise = check(null, { fetchImpl: () => new Promise(() => {}) });
  const rejected = assert.rejects(promise, /timed out/);
  t.mock.timers.tick(12000);
  await rejected;
});

test("download deadline aborts a stalled request without creating a file", async (t) =>
  sandbox(async (dir, destination) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const promise = downloadUpdate(asset, destination, {
      fetchImpl: () => new Promise(() => {}),
    });
    const rejected = assert.rejects(promise, /timed out/);
    t.mock.timers.tick(10 * 60 * 1000);
    await rejected;
    assert.deepEqual(await fs.readdir(dir), []);
  }));

test("abort interrupts a stalled stream and removes the partial installer", async () =>
  sandbox(async (dir, destination) => {
    const controller = new AbortController();
    let pulled;
    const ready = new Promise((resolve) => {
      pulled = resolve;
    });
    const stream = new ReadableStream({
      pull() {
        pulled();
      },
    });
    const promise = downloadUpdate(asset, destination, {
      signal: controller.signal,
      fetchImpl: async () => new Response(stream),
    });
    const rejected = assert.rejects(promise, /abort/i);
    await ready;
    controller.abort();
    await rejected;
    assert.deepEqual(await fs.readdir(dir), []);
  }));
