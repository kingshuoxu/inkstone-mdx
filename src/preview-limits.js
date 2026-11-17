export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;
export const LARGE_PREVIEW_BYTES = 512000;
export function previewBytes(source) {
  return new TextEncoder().encode(source).length;
}
export function checkPreviewSource(source) {
  if (previewBytes(source) > MAX_PREVIEW_BYTES)
    throw Error(
      "Preview source exceeds 5 MiB. Source can still be edited and saved.",
    );
}
export function previewTimeout(source) {
  return previewBytes(source) > LARGE_PREVIEW_BYTES ? 120000 : 5000;
}
