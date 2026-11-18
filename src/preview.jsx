import React from "react";
import { createRoot } from "react-dom/client";
import * as runtime from "react/jsx-runtime";
import {
  components,
  Ready,
  reportPreview,
  previewText,
  Boundary,
  installErrorReporting,
} from "./preview-shared.jsx";
window.frameProfile={origin:performance.timeOrigin,start:performance.now(),mdxCalls:0,mdxMs:0};
try {
  const code = JSON.parse(document.getElementById("payload").textContent);
  window.frameProfile.payloadParsed=performance.now();
  const factory = new Function(code);
  window.frameProfile.functionParsed=performance.now();
  const OriginalMDX = factory(runtime).default;
  window.frameProfile.factoryEvaluated=performance.now();
  function MDX(props) { const start=performance.now(); const result=OriginalMDX(props); window.frameProfile.mdxMs+=performance.now()-start;window.frameProfile.mdxCalls++;return result; }
  window.frameProfile.renderScheduled=performance.now();
  createRoot(document.getElementById("root")).render(
    <Boundary>
      <Ready>
        <MDX components={components} />
      </Ready>
    </Boundary>,
  );
} catch (e) {
  reportPreview("error", e.message);
  document.getElementById("root").textContent =
    previewText("Runtime error: ", "运行时错误：") + e.message;
}

installErrorReporting();
