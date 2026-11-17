import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// MDX's entity decoder selects a DOM implementation under Vite's browser
// condition. Compilation runs in a Worker, where document does not exist.
// Resolve the package's DOM-free default entry in both dev and worker builds.
export default defineConfig({
  worker: { format: "es" },
  resolve: {
    alias: [
      {
        find: /^decode-named-character-reference$/,
        replacement: fileURLToPath(
          import.meta.resolve("decode-named-character-reference"),
        ),
      },
    ],
  },
});
