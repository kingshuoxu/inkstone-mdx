import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { bundleProject } from "../desktop/bundle.mjs";
import { atomicSave, checkedPath } from "../desktop/files.mjs";
const root = path.resolve("examples/project");
const file = path.join(root, "index.mdx");
test("bundles a real relative JSX component and installed npm dependency", async () => {
  const r = await bundleProject({
    root,
    file,
    source: await fs.readFile(file, "utf8"),
  });
  assert.ok(r.js.includes("Project component:"));
  assert.ok(r.modules >= 10);
  console.log(
    JSON.stringify({
      projectBundleBytes: r.js.length,
      compileMs: r.ms,
      modules: r.modules,
    }),
  );
});
test("project import errors, Node builtins and invalid JSX are actionable", async () => {
  for (const source of [
    "import x from './missing.jsx'\n\n{x}",
    "import x from 'node:fs'\n\n{x}",
    "<Broken>",
  ])
    await assert.rejects(bundleProject({ root, file, source }));
});
test("rejects relative and symlink imports escaping the trusted root", async () => {
  await assert.rejects(
    bundleProject({
      root,
      file,
      source: "import x from '../../package.json'\n\n{x.name}",
    }),
    /escapes/,
  );
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ink-path-"));
  try {
    await fs.symlink(path.resolve("package.json"), path.join(dir, "escape"));
    await assert.rejects(checkedPath(dir, path.join(dir, "escape")), /escapes/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("atomic save preserves Unicode, detects conflict, and leaves no temporary files", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ink-save-"));
  const target = path.join(dir, "中文.mdx");
  try {
    await atomicSave(target, "# 中文 🌱", null);
    await atomicSave(target, "# saved", "# 中文 🌱");
    await fs.writeFile(target, "external");
    await assert.rejects(atomicSave(target, "lost", "# saved"), /changed/);
    assert.equal(await fs.readFile(target, "utf8"), "external");
    assert.deepEqual(await fs.readdir(dir), ["中文.mdx"]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
