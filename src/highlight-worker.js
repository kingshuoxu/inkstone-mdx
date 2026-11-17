import { markdown } from "@codemirror/lang-markdown";
import { Text } from "@codemirror/state";
import { DocInput } from "@codemirror/language";
import { TreeFragment } from "@lezer/common";
import { highlightTree } from "@lezer/highlight";
import { workerHighlighter } from "./highlight-style.js";

const parser = markdown().language.parser;
let doc = Text.empty,
  fragments = [],
  tree = null,
  request = 0;
let ranges = [],
  generation = 0;
function publish() {
  if (!tree) return;
  const spans = [];
  for (const range of ranges)
    highlightTree(
      tree,
      workerHighlighter,
      (from, to, cls) => {
        spans.push([from, to, cls]);
      },
      range.from,
      range.to,
    );
  postMessage({ request, spans });
}
function parse() {
  const token = ++generation;
  const input = new DocInput(doc);
  const pending = parser.startParse(input, fragments);
  function step() {
    if (token !== generation) return;
    const end = performance.now() + 15;
    do {
      const result = pending.advance();
      if (result) {
        tree = result;
        fragments = TreeFragment.addTree(tree);
        publish();
        return;
      }
    } while (performance.now() < end);
    setTimeout(step, 0);
  }
  setTimeout(step, 0);
}
onmessage = ({ data }) => {
  ranges = data.ranges;
  request = data.request;
  if (data.doc !== undefined) {
    doc = Text.of(data.doc.split("\n"));
    fragments = [];
    tree = null;
    parse();
  } else if (data.changes) {
    // Changes are expressed in the old document; apply from the end.
    for (let i = data.changes.length - 1; i >= 0; i--) {
      const c = data.changes[i];
      doc = doc.replace(c.fromA, c.toA, Text.of(c.insert.split("\n")));
    }
    fragments = TreeFragment.applyChanges(fragments, data.changes);
    tree = null;
    parse();
  } else publish();
};
