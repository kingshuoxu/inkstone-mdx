// Diagnostic benchmark deliberately bypasses the app preview guard in isolated Node children.
import { spawnSync } from "node:child_process";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import os from "node:os";
if (process.argv[2] === "--case") {
  const kind = process.argv[3],
    bytes = Number(process.argv[4]);
  const unit =
    kind === "dense"
      ? "# H\n\n**bold** {1+2} <Badge>x</Badge>\n\n"
      : "A calm paragraph. ".repeat(60) + "\n\n";
  const source = unit.repeat(Math.floor(bytes / unit.length));
  const start = performance.now();
  await compile(source, {
    outputFormat: "function-body",
    remarkPlugins: [remarkGfm],
  });
  console.log(
    JSON.stringify({
      bytes: Buffer.byteLength(source),
      ms: +(performance.now() - start).toFixed(1),
      maxRSSKiB: process.resourceUsage().maxRSS,
    }),
  );
} else {
  console.log(
    JSON.stringify({
      node: process.version,
      platform: os.platform(),
      cpu: os.cpus()[0].model,
      notes:
        "Cold Node compile only; excludes browser render, app input and runtime JS. RSS is process high-water, not compiler-only allocation.",
    }),
  );
  for (const kind of ["plain", "dense"])
    for (const bytes of [128000, 512000, 1048576]) {
      const samples = [];
      let failure;
      for (let i = 0; i < 3; i++) {
        const r = spawnSync(
          process.execPath,
          [
            "--max-old-space-size=768",
            import.meta.filename,
            "--case",
            kind,
            String(bytes),
          ],
          { encoding: "utf8", timeout: 20000 },
        );
        if (r.status !== 0) {
          failure = r.error?.message || "child failed";
          break;
        }
        samples.push(JSON.parse(r.stdout));
      }
      console.log(
        JSON.stringify({ kind, targetBytes: bytes, samples, failure }),
      );
    }
  for (const bytes of [1048576, 5242880, 10485760]) {
    const source = "x".repeat(bytes);
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      JSON.stringify({ source, name: "benchmark.mdx" });
      source.split("\n");
      source.split(/\s+/);
      times.push(+(performance.now() - start).toFixed(2));
    }
    console.log(
      JSON.stringify({
        operation:
          "JSON draft serialization + line/word scan; excludes localStorage/editor/IPC",
        bytes,
        timesMs: times,
      }),
    );
  }
}
