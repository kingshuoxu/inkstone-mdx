import test from "node:test";
import assert from "node:assert/strict";
import {
  createUpdateController,
  RELEASES_URL,
} from "../desktop/update-controller.mjs";
function setup(overrides = {}) {
  const log = [],
    responses = [1, 1];
  const ui = createUpdateController({
    getVersion: () => "0.1.0",
    platform: "linux",
    arch: "x64",
    check: async () => ({
      status: "available",
      version: "0.2.0",
      asset: { name: "installer.AppImage" },
    }),
    message: async (o) => {
      log.push(["message", o]);
      return { response: responses.shift() ?? 0 };
    },
    save: async () => ({ filePath: "/chosen/installer", canceled: false }),
    download: async (_a, p) => {
      log.push(["download", p]);
      return { path: p };
    },
    reveal: (p) => log.push(["reveal", p]),
    openReleases: (u) => log.push(["open", u]),
    ...overrides,
  });
  return { ui, log, responses };
}
test("native update requires approval, saves then reveals without executing", async () => {
  const { ui, log } = setup();
  await ui.run();
  assert.equal(ui.phase, "idle");
  assert.deepEqual(
    log.filter((x) => x[0] !== "message"),
    [
      ["download", "/chosen/installer"],
      ["reveal", "/chosen/installer"],
    ],
  );
  assert.match(log[0][1].detail, /not publisher authenticity/);
});
test("cancel and cancelled save do not download", async () => {
  for (const saveCancel of [false, true]) {
    const { ui, log, responses } = setup({
      save: async () => ({ canceled: true }),
    });
    if (!saveCancel) responses[0] = 0;
    await ui.run();
    assert.equal(log.filter((x) => x[0] === "download").length, 0);
  }
});
test("current and unsupported results never auto-open browser", async () => {
  for (const status of ["current", "unsupported"]) {
    const { ui, log, responses } = setup({ check: async () => ({ status }) });
    responses[0] = 0;
    await ui.run();
    assert.equal(log.filter((x) => x[0] !== "message").length, 0);
  }
});
test("concurrent checks coalesce; cancellation settles and retries", async () => {
  let calls = 0;
  const { ui } = setup({
    check: ({ signal }) => {
      calls++;
      return new Promise((_r, reject) =>
        signal.addEventListener("abort", () => reject(Error("abort")), {
          once: true,
        }),
      );
    },
  });
  const first = ui.run();
  await ui.run();
  assert.equal(calls, 1);
  ui.cancel();
  await first;
  assert.equal(ui.phase, "idle");
  const second = ui.run();
  assert.equal(calls, 2);
  ui.dispose();
  await second;
  await ui.run();
  assert.equal(calls, 2);
});
test("failure offers only the fixed releases URL with explicit approval", async () => {
  const { ui, log } = setup({
    check: async () => {
      throw Error("untrusted failure");
    },
  });
  await ui.run();
  assert.deepEqual(
    log.filter((x) => x[0] === "open"),
    [["open", RELEASES_URL]],
  );
  assert.equal(JSON.stringify(log).includes("untrusted failure"), false);
});
