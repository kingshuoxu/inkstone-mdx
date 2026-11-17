import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { compileWithEngine, needsReference } from "../src/compiler.js";
import { transform } from "esbuild";
const components = {
  Badge: ({ children }) => React.createElement("b", null, children),
  Parts: {
    Note: ({ children }) => React.createElement("aside", null, children),
  },
};
const fixtures = [
  "| left | center | right |\n| :-- | :-: | --: |\n| a | b | c |",
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
      assert.equal(
        used,
        source.includes("[^") || source.includes(":--") ? "javascript" : engine,
      );
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

test("module expressions and malformed large sources fall back to reference semantics", async () => {
  const padding = "\n\n" + "ordinary text ".repeat(1500);
  for (const source of [
    "{import.meta.url}",
    '{import("./component.js")}',
    "<Broken>",
  ]) {
    let expected;
    try {
      expected = await compileWithEngine(source + padding, {
        engine: "javascript",
      });
    } catch (error) {
      expected = error.message;
    }
    try {
      const result = await compileWithEngine(source + padding);
      assert.equal(result.engine, "javascript");
      assert.equal(result.code, expected.code);
    } catch (error) {
      assert.equal(error.message, expected);
    }
  }
});

test("extended real-world syntax corpus matches reference output with automatic fallback", async () => {
  const corpus = [
    "\uFEFF# BOM and 中文 🌿\r\n\r\nEscaped \\{braces\\} &copy; &#x1f331;",
    '<section aria-label="中文" style={{color:"red",padding:2}}><input disabled /><span>{`value ${3}`}</span></section>',
    '1. first\n   - nested\n   - **strong**\n2. second\n\n---\n\n[ref][id]\n\n[id]: https://example.com "Title"',
    "Email foo@example.com, https://example.com/?q=a&b=c and www.example.com.",
    '```tsx\nexport const x: number = 1\n```\n\n![alt](data:image/png;base64,AA== "caption")',
    "{[1,2,3].filter(n=>n>1).map(n=><Badge key={n}>{n}</Badge>)}",
  ];
  for (const base of corpus) {
    const source = base + "\n\n" + "padding text ".repeat(1500);
    const outputs = [];
    for (const engine of ["javascript", "auto"]) {
      const { code } = await compileWithEngine(source, { engine });
      outputs.push(
        renderToStaticMarkup(
          React.createElement(new Function(code)(runtime).default, {
            components,
          }),
        ),
      );
    }
    assert.equal(outputs[1], outputs[0]);
  }
});
test("malformed large JSX/ESM retains reference diagnostic and next valid compile works", async () => {
  for (const base of [
    "<div a={}>x</div>",
    "{const x = 1}",
    "<A></B>",
    "export const x = ;",
    "export default 1\nexport default 2",
  ]) {
    const source = base + "\n\n" + "padding ".repeat(3000);
    let expected;
    try {
      await compileWithEngine(source, { engine: "javascript", program: true });
      assert.fail("must fail");
    } catch (e) {
      expected = e.message;
    }
    await assert.rejects(
      compileWithEngine(source, { program: true }),
      (e) => e.message === expected,
    );
  }
  assert.equal(
    (await compileWithEngine("# Works\n\n" + "text ".repeat(4000))).engine,
    "rust",
  );
});

test("compatibility routing handles near-limit adversarial long lines", () => {
  const start = performance.now();
  assert.equal(needsReference(":".repeat(500000) + "x"), false);
  assert.equal(needsReference("www.".repeat(125000)), false);
  assert.equal(needsReference("www.example.com?q=a&b=c"), true);
  assert.equal(needsReference("| :-- | --: |"), true);
  console.log("COMPATIBILITY_SCAN_MS", performance.now() - start);
});
