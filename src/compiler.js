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
export async function compileWithEngine(
  source,
  { program = false, engine = "auto" } = {},
) {
  if (new TextEncoder().encode(source).length > 512000)
    throw Error(
      "Preview limit is 500 KB. Your source can still be edited and saved.",
    );
  if (
    engine !== "javascript" &&
    (engine === "rust" || source.length > 16000) &&
    !source.includes("[^") &&
    !unavailable
  ) {
    try {
      return { code: await rustCompile(source, program), engine: "rust" };
    } catch (error) {
      if (engine === "rust") throw Error(String(error));
      // Preserve legacy syntax support and positioned diagnostics; never evaluate code.
      // A trapped/missing WASM instance is not reused in this worker.
      if (
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
