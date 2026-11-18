// Expanded full-document previews remain bounded; limits count UTF-8 bytes.
export const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;
export const MAX_PREVIEW_HTML_BYTES = 80 * 1024 * 1024;
// A small entry file may import a large MDX document, so all project compiles
// receive the large-document budget. Cancellation remains immediate.
export const PROJECT_COMPILE_TIMEOUT_MS = 120000;
export function checkedPreviewHTML(html) {
  if (
    typeof html !== "string" ||
    Buffer.byteLength(html) > MAX_PREVIEW_HTML_BYTES
  )
    throw Error(
      "Preview exceeds the 80 MiB output limit or is invalid. Source is safe; no partial preview was shown.",
    );
  return html;
}
