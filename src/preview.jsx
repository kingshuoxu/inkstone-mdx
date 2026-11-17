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
try {
  const code = JSON.parse(document.getElementById("payload").textContent);
  const MDX = new Function(code)(runtime).default;
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
