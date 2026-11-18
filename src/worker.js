import { compileWithEngine } from "./compiler.js";
self.onmessage = async ({ data }) => {
  const start = performance.now();
  globalThis.rustStages=[]; globalThis.stage=(name)=>globalThis.rustStages.push({name,at:performance.now()});
  try {
    const result = await compileWithEngine(data.source, {
      engine: import.meta.env?.VITE_COMPILER_ENGINE || "auto",
    });
    if (new TextEncoder().encode(result.code).length > 64 * 1024 * 1024)
      throw Error(
        "Compiled preview exceeds 64 MiB. No partial preview was shown.",
      );
    const measuredMs=performance.now()-start;
    const codeHash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(result.code))),b=>b.toString(16).padStart(2,"0")).join("");
    postMessage({
      codeHash,
      rustStages: globalThis.rustStages, workerStart:start, workerEnd:performance.now(),
      id: data.id,
      ...result,
      ms: measuredMs,
    });
  } catch (e) {
    postMessage({ id: data.id, error: e.message });
  }
};
