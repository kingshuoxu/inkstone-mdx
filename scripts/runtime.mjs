import { build } from "esbuild";
await build({
  entryPoints: ["src/preview.jsx"],
  bundle: true,
  format: "iife",
  outfile: "src/runtime.generated.txt",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
