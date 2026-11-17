import { spawnSync } from "node:child_process";
import os from "node:os";
const [engine, kind, size] = process.argv.slice(2);
if (engine) {
  const source =
    kind === "dense"
      ? "# Heading\n\n**bold** and {1+2}\n\n<Badge>中文</Badge>\n\n"
      : "# Heading\n\n" + "ordinary text ".repeat(70) + "\n\n";
  const input = source.repeat(
    Math.floor(Number(size) / Buffer.byteLength(source)),
  );
  const start = performance.now();
  const fn =
    engine === "javascript"
      ? (await import("../src/compiler-legacy.js")).compileSource
      : (
          (module) => async (s) =>
            (await module.compileWithEngine(s, { engine: "rust" })).code
        )(await import("../src/compiler.js"));
  const loaded = performance.now();
  await fn(input);
  const cold = performance.now();
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await fn(input);
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      engine,
      kind,
      bytes: Buffer.byteLength(input),
      loadMs: loaded - start,
      coldMs: cold - loaded,
      warmMedianMs: samples[2],
      warmMaxMs: samples[4],
      maxRssKiB: process.resourceUsage().maxRSS,
    }),
  );
} else {
  console.log(
    JSON.stringify({
      node: process.version,
      cpu: os.cpus()[0].model,
      platform: os.platform(),
      samples: 5,
      method:
        "Fresh process per engine/case; one cold + five warm compilations; no rendering",
    }),
  );
  for (const kind of ["plain", "dense"])
    for (const size of [10000, 100000, 500000])
      for (const engine of ["javascript", "rust"]) {
        const r = spawnSync(
          process.execPath,
          [import.meta.filename, engine, kind, size],
          { encoding: "utf8", timeout: 90000 },
        );
        if (r.status !== 0) throw Error(r.stderr || String(r.error));
        process.stdout.write(r.stdout);
      }
}
