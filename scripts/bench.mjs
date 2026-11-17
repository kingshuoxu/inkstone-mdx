import { compileSource } from "../src/compiler.js";
import os from "node:os";
console.log(
  JSON.stringify({
    node: process.version,
    platform: os.platform(),
    cpu: os.cpus()[0].model,
  }),
);
for (const bytes of [10000, 100000, 300000]) {
  const paragraph =
    "# A heading\n\nText with **emphasis** and {1 + 2}.\n\n<Badge>Note</Badge>\n\n";
  const source = paragraph.repeat(Math.floor(bytes / paragraph.length));
  await compileSource(source);
  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    await compileSource(source);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      bytes: source.length,
      samples: 10,
      medianMs: +times[5].toFixed(1),
      p90Ms: +times[8].toFixed(1),
    }),
  );
}
