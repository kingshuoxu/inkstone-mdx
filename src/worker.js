import { compileWithEngine } from "./compiler.js";
self.onmessage = async ({ data }) => {
  const start = performance.now();
  try {
    const result = await compileWithEngine(data.source, {
      engine: import.meta.env?.VITE_COMPILER_ENGINE || "auto",
    });
    postMessage({
      id: data.id,
      ...result,
      ms: performance.now() - start,
    });
  } catch (e) {
    postMessage({ id: data.id, error: e.message });
  }
};
