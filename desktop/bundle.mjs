import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { compileWithEngine } from "../src/compiler.js";
import { checkedPath, checkedSource, isInside } from "./files.mjs";
import { MAX_BUNDLE_BYTES } from "./preview-limits.mjs";
const require = createRequire(import.meta.url);
const shared = fileURLToPath(
  new URL("../src/preview-shared.jsx", import.meta.url),
);
const reactRoot = path.dirname(require.resolve("react/package.json"));
const domRoot = path.dirname(require.resolve("react-dom/package.json"));
const schedulerRoot = path.dirname(require.resolve("scheduler/package.json"));
export async function bundleProject({ root, file, source }) {
  root = await fs.realpath(root);
  file = await checkedPath(root, file);
  checkedSource(source);
  const start = performance.now();
  const engines = new Set();
  async function compileDocument(text) {
    checkedSource(text);
    const result = await compileWithEngine(text, { program: true });
    engines.add(result.engine);
    return result.code;
  }
  const result = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {components,Boundary,Ready,reportPreview,installErrorReporting} from ${JSON.stringify(shared)};import MDX from 'inkstone:document';installErrorReporting();try{createRoot(document.getElementById('root')).render(React.createElement(Boundary,null,React.createElement(Ready,null,React.createElement(MDX,{components}))));}catch(error){reportPreview('error',error.message);}`,
      resolveDir: path.dirname(file),
      sourcefile: "inkstone-entry.jsx",
      loader: "jsx",
    },
    bundle: true,
    write: false,
    outdir: "out",
    format: "iife",
    platform: "browser",
    target: "chrome120",
    jsx: "automatic",
    minify: true,
    metafile: true,
    logLevel: "silent",
    tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
    define: { "process.env.NODE_ENV": '"production"' },
    loader: {
      ".png": "dataurl",
      ".jpg": "dataurl",
      ".jpeg": "dataurl",
      ".gif": "dataurl",
      ".svg": "dataurl",
      ".woff2": "dataurl",
    },
    plugins: [
      {
        name: "trusted-workspace",
        setup(b) {
          b.onResolve({ filter: /^inkstone:document$/ }, () => ({
            path: file,
            namespace: "document",
          }));
          b.onLoad({ filter: /.*/, namespace: "document" }, async () => ({
            contents: await compileDocument(source),
            loader: "js",
            resolveDir: path.dirname(file),
          }));
          b.onResolve({ filter: /.*/ }, async (args) => {
            if (args.pluginData?.resolving) return;
            if (/^(https?:|file:|data:|node:)/.test(args.path))
              throw Error(
                "Remote URLs and Node built-ins are unsupported in project previews.",
              );
            let spec = args.path;
            if (
              /^react(?:\/|$)|^react-dom(?:\/|$)|^scheduler(?:\/|$)/.test(spec)
            )
              spec = require.resolve(spec);
            const r = await b.resolve(spec, {
              resolveDir: args.resolveDir || root,
              kind: args.kind,
              pluginData: { resolving: true },
            });
            if (r.errors.length) return r;
            if (r.external)
              throw Error(
                "External modules are unsupported; install browser-compatible dependencies inside the workspace.",
              );
            const real = await fs.realpath(r.path);
            const appRuntime =
              real === shared ||
              [reactRoot, domRoot, schedulerRoot].some((p) =>
                isInside(p, real),
              );
            if (!isInside(root, real) && !appRuntime)
              throw Error(
                "Import escapes the trusted workspace (including symlinks).",
              );
            return { path: real };
          });
          b.onLoad({ filter: /\.mdx?$/ }, async (args) => ({
            contents: await compileDocument(
              await fs.readFile(args.path, "utf8"),
            ),
            loader: "js",
            resolveDir: path.dirname(args.path),
          }));
        },
      },
    ],
  });
  const js = result.outputFiles.find((f) => f.path.endsWith(".js"))?.text;
  const css =
    result.outputFiles.find((f) => f.path.endsWith(".css"))?.text || "";
  if (!js) throw Error("Bundler produced no preview.");
  if (Buffer.byteLength(js) + Buffer.byteLength(css) > MAX_BUNDLE_BYTES)
    throw Error(
      "Preview bundle exceeds 64 MiB. Source is safe; no partial preview was shown.",
    );
  return {
    js,
    css,
    ms: performance.now() - start,
    modules: Object.keys(result.metafile.inputs).length,
    engines: [...engines],
  };
}
