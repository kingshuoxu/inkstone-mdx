import test from "node:test";
import assert from "node:assert/strict";
import {
  initialLanguage,
  translate,
  translateError,
  zhCN,
} from "../src/i18n.js";
import { previewDocument } from "../src/sandbox.js";
test("language choice uses persisted valid preference, system fallback and safe storage failure", () => {
  assert.equal(initialLanguage({ getItem: () => "en" }, "zh-CN"), "en");
  assert.equal(initialLanguage({ getItem: () => "zh-CN" }, "en-US"), "zh-CN");
  assert.equal(initialLanguage({ getItem: () => "invalid" }, "zh-TW"), "zh-CN");
  assert.equal(
    initialLanguage(
      {
        getItem: () => {
          throw Error("denied");
        },
      },
      "en",
    ),
    "en",
  );
});
test("translations preserve interpolation placeholders and diagnostic details", () => {
  for (const [en, zh] of Object.entries(zhCN)) {
    assert.ok(zh.trim());
    assert.deepEqual(
      [...en.matchAll(/\{\w+\}/g)].map((x) => x[0]).sort(),
      [...zh.matchAll(/\{\w+\}/g)].map((x) => x[0]).sort(),
    );
  }
  assert.equal(
    translate("zh-CN", "Trusted this session: {project}", {
      project: "my-project",
    }),
    "本次会话已信任：my-project",
  );
  const raw =
    "Error invoking remote method 'document:save': File changed on disk. Use Save a copy to preserve both versions.";
  const chinese = translateError("zh-CN", raw);
  assert.match(chinese, /文件已被其他程序修改/);
  assert.equal(translateError("en", chinese), raw);
  assert.equal(
    translateError("zh-CN", "unexpected token at example.mdx:12"),
    "unexpected token at example.mdx:12",
  );
});
test("preview language is restricted to the supported fixed tags", () => {
  assert.match(previewDocument("", "", "zh-CN"), /<html lang="zh-CN">/);
  assert.match(previewDocument("", "", '\" onload=bad'), /<html lang="en">/);
});
