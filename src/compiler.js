import { checkPreviewSource } from "./preview-limits.js";
import { compileSource as legacySource } from "./compiler-legacy.js";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
let bindings;
let unavailable = false;
export async function rustCompile(source, program = false) {
  if (!bindings) {
    const module = await import("./core.generated.js");
    module.initializeCore();
    bindings = module;
  }
  return bindings.compile_mdx(source, program);
}
// Conservative linear scans: avoid nested backtracking on hostile long lines.
export function needsReference(source) {
  if (source.includes("[^")) return true;
  if (source.includes("&") && /https?:\/\/|www\./.test(source)) return true;
  return source
    .split(/\r\n|\r|\n/)
    .some((line) => line.includes(":") && /^[ \t|:-]+$/.test(line));
}
export async function compileWithEngine(
  source,
  { program = false, engine = "auto" } = {},
) {
  checkPreviewSource(source);
  if (
    engine !== "javascript" &&
    (engine === "rust" || source.length > 16000) &&
    !needsReference(source) &&
    !unavailable
  ) {
    try {
      return { code: await rustCompile(source, program), engine: "rust" };
    } catch (error) {
      if (engine === "rust") throw Error(String(error));
      // Preserve legacy syntax support and positioned diagnostics; never evaluate code.
      // A trapped/missing WASM instance is not reused in this worker.
      if (
        typeof WebAssembly === "undefined" ||
        error instanceof WebAssembly.RuntimeError ||
        error instanceof WebAssembly.CompileError
      )
        unavailable = true;
    }
  }
  const code = program
    ? String(
        await compile(source, {
          remarkPlugins: [remarkGfm],
          development: false,
        }),
      )
    : await legacySource(source);
  return { code, engine: "javascript" };
}
export async function compileSource(source) {
  return (await compileWithEngine(source)).code;
}
