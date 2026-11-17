import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { compileWithEngine } from "../src/compiler.js";
import { transform } from "esbuild";
const components = {
  Badge: ({ children }) => React.createElement("b", null, children),
  Parts: {
    Note: ({ children }) => React.createElement("aside", null, children),
  },
};
const fixtures = [
  "# 中文 🌱 &amp; entities\n\n**bold** *italic* ~~strike~~",
  '<Badge title="x">{[1,2].map(x => <i key={x}>{x * 2}</i>)}</Badge>',
  '<Parts.Note {...{title: "中文"}}>nested</Parts.Note>\n\n<>fragment {3}</>',
  "| a | b |\n| - | - |\n| 中文 | 2 |\n\n- [x] done\n- [ ] pending",
  "> quote\n\n```jsx\n<div>code</div>\n```\n\nwww.example.com",
  "Text[^1]\n\n[^1]: A footnote",
  "{/* comment */}\n\n{(() => {const x = {a: 3}; return x?.a ?? 4})()}",
];
for (const [index, source] of fixtures.entries())
  test(`Rust/JS rendered compatibility ${index}`, async () => {
    const outputs = [];
    for (const engine of ["javascript", "rust"]) {
      const { code, engine: used } = await compileWithEngine(source, {
        engine,
      });
      assert.equal(used, source.includes("[^") ? "javascript" : engine);
      const C = new Function(code)(runtime).default;
      outputs.push(
        renderToStaticMarkup(React.createElement(C, { components })),
      );
    }
    assert.equal(outputs[1], outputs[0]);
  });
test("Rust project ESM default layout, named exports and component imports", async () => {
  const source =
    'import {Badge} from "fixture"\n\nexport const value = 7\n\nexport default function Layout({children}) {return <article>{children}</article>}\n\n<Badge>{value}</Badge>';
  const outputs = [];
  for (const engine of ["javascript", "rust"]) {
    const { code } = await compileWithEngine(source, { engine, program: true });
    const cjs = await transform(code, { format: "cjs" });
    const module = { exports: {} };
    new Function("require", "module", "exports", cjs.code)(
      (id) => (id === "fixture" ? components : runtime),
      module,
      module.exports,
    );
    assert.equal(module.exports.value, 7);
    outputs.push(
      renderToStaticMarkup(React.createElement(module.exports.default)),
    );
  }
  assert.equal(outputs[1], outputs[0]);
});
test("Both engines reject source ESM in standalone mode; fallback retains diagnostics", async () => {
  for (const source of [
    'import {jsx} from "react/jsx-runtime"\n\n# X',
    "export default () => null",
    "<Broken>",
    "{1 +}",
  ]) {
    for (const engine of ["rust", "javascript", "auto"])
      await assert.rejects(compileWithEngine(source, { engine }));
  }
  let a, b;
  try {
    await compileWithEngine("<Broken>", { engine: "javascript" });
  } catch (e) {
    a = e.message;
  }
  try {
    await compileWithEngine("<Broken>");
  } catch (e) {
    b = e.message;
  }
  assert.equal(b, a);
});
