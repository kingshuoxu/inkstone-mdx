import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
execFileSync(
  "cargo",
  [
    "build",
    "--manifest-path",
    "core/Cargo.toml",
    "--locked",
    "--release",
    "--target",
    "wasm32-unknown-unknown",
  ],
  { stdio: "inherit" },
);
execFileSync(
  "wasm-bindgen",
  [
    "--target",
    "web",
    "--out-dir",
    "core/pkg",
    "core/target/wasm32-unknown-unknown/release/inkstone_core.wasm",
  ],
  { stdio: "inherit" },
);
const binding = await readFile("core/pkg/inkstone_core.js", "utf8");
const bytes = await readFile("core/pkg/inkstone_core_bg.wasm");
// Embed the compiler bytes so app workers need no filesystem/network capability.
await writeFile(
  "src/core.generated.js",
  binding +
    `\nexport function initializeCore() { return initSync({module: decodeCore()}); }\n`,
);
console.log(`Rust core: ${bytes.length} WASM bytes`);

await writeFile(
  "src/core.generated.js",
  (await readFile("src/core.generated.js", "utf8")) +
    `\nfunction decodeCore() { const text=atob(${JSON.stringify(bytes.toString("base64"))}); const out=new Uint8Array(text.length); for(let i=0;i<text.length;i++) out[i]=text.charCodeAt(i); return out; }\n`,
);
