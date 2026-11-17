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
  if (new TextEncoder().encode(source).length > 512000)
    throw new Error(
      "Preview limit is 500 KB. Your source can still be edited and saved.",
    );
  return String(
    await compile(source, {
      outputFormat: "function-body",
      remarkPlugins: [remarkGfm, noModules],
      development: false,
    }),
  );
}
