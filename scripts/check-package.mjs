import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
let binary;
if (process.platform === "linux")
  binary = "release/linux-unpacked/inkstone-mdx";
else if (process.platform === "win32")
  binary = "release/win-unpacked/Inkstone MDX.exe";
else {
  const dir = fs
    .readdirSync("release")
    .find(
      (x) =>
        /^mac(?:-|$)/.test(x) &&
        fs.statSync(path.join("release", x)).isDirectory(),
    );
  binary = path.join(
    "release",
    dir,
    "Inkstone MDX.app/Contents/MacOS/Inkstone MDX",
  );
}
if (!fs.existsSync(binary))
  throw Error("Packaged executable missing: " + binary);
const result = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "playwright.desktop.config.js",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, INKSTONE_EXECUTABLE: path.resolve(binary) },
  },
);
process.exit(result.status ?? 1);
