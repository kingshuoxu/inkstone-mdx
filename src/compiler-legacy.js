import { checkPreviewSource } from "./preview-limits.js";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
function noModules() {
  return (tree) => {
    for (const node of tree.children)
      if (node.type === "mdxjsEsm")
        throw new Error(
          "Imports and exports are not supported. Use built-in components or inline JSX.",
        );
  };
}
export async function compileSource(source) {
  checkPreviewSource(source);
  return String(
    await compile(source, {
      outputFormat: "function-body",
      remarkPlugins: [remarkGfm, noModules],
      development: false,
    }),
  );
}
