import { compileSource } from "./compiler.js";
self.onmessage = async ({ data }) => {
  const start = performance.now();
  try {
    postMessage({
      id: data.id,
      code: await compileSource(data.source),
      ms: performance.now() - start,
    });
  } catch (e) {
    postMessage({ id: data.id, error: e.message });
  }
};
