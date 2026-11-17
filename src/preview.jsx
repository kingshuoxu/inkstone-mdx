import React from "react";
import { createRoot } from "react-dom/client";
import * as runtime from "react/jsx-runtime";
import {
  components,
  previewText,
  Boundary,
  installErrorReporting,
} from "./preview-shared.jsx";
try {
  const code = JSON.parse(document.getElementById("payload").textContent);
  const MDX = new Function(code)(runtime).default;
  createRoot(document.getElementById("root")).render(
    <Boundary>
      <MDX components={components} />
    </Boundary>,
  );
} catch (e) {
  document.getElementById("root").textContent =
    previewText("Runtime error: ", "运行时错误：") + e.message;
}

installErrorReporting();
