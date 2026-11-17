import { defaultHighlightStyle } from "@codemirror/language";
import { tagHighlighter } from "@lezer/highlight";

// Use the editor's existing default theme, with stable class names across the
// worker and renderer realms. This retains strikethrough and separator styles
// that Lezer's generic classHighlighter does not include.
export const highlightRules = defaultHighlightStyle.specs.map(
  ({ tag, ...style }, index) => ({ tag, style, class: `ink-token-${index}` }),
);
export const workerHighlighter = tagHighlighter(highlightRules);
export const highlightTheme = Object.fromEntries(
  highlightRules.map((rule) => [`.${rule.class}`, rule.style]),
);
