import test from "node:test";
import assert from "node:assert/strict";
import { PROJECT_LINKS, projectURL } from "../src/project-links.js";
import { openProjectLink } from "../desktop/external-links.mjs";

test("project shortcuts open only fixed repository destinations", async () => {
  const opened = [];
  for (const key of ["repository", "issue", "releases"]) {
    await openProjectLink(key, async (url) => opened.push(url));
    assert.equal(projectURL(key), PROJECT_LINKS[key]);
  }
  assert.deepEqual(opened, [
    "https://github.com/kingshuoxu/inkstone-mdx",
    "https://github.com/kingshuoxu/inkstone-mdx/issues/new",
    "https://github.com/kingshuoxu/inkstone-mdx/releases/latest",
  ]);
  for (const url of opened) {
    assert.equal(new URL(url).search, "");
    assert.equal(new URL(url).hash, "");
  }
  assert.equal(Object.isFrozen(PROJECT_LINKS), true);
});

test("arbitrary URLs and inherited keys cannot reach the OS browser", async () => {
  let calls = 0;
  for (const key of [
    "https://evil.example/",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "issue?body=private-document",
    "__proto__",
    "constructor",
    null,
    {},
  ]) {
    await assert.rejects(
      openProjectLink(key, async () => calls++),
      /Unknown project destination/,
    );
  }
  assert.equal(calls, 0);
});

test("OS browser failures are reported to the caller", async () => {
  await assert.rejects(
    openProjectLink("issue", async () => {
      throw Error("browser unavailable");
    }),
    /browser unavailable/,
  );
});
