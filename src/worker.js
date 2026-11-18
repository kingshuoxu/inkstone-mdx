import { compileWithEngine } from "./compiler.js";
self.onmessage = async ({ data }) => {
  const start = performance.now();
  try {
    const result = await compileWithEngine(data.source, {
      engine: import.meta.env?.VITE_COMPILER_ENGINE || "auto",
    });
    if (new TextEncoder().encode(result.code).length > 64 * 1024 * 1024)
      throw Error(
        "Compiled preview exceeds 64 MiB. No partial preview was shown.",
      );
    postMessage({
      id: data.id,
      ...result,
      ms: performance.now() - start,
    });
  } catch (e) {
    postMessage({ id: data.id, error: e.message });
  }
};
