import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/perf",
  workers: 1,
  timeout: 120000,
  use: {
    viewport: { width: 1440, height: 960 },
    launchOptions: { args: ["--no-sandbox"] },
  },
  projects: [
    { name: "baseline", use: { baseURL: "http://127.0.0.1:4175" } },
    { name: "rust", use: { baseURL: "http://127.0.0.1:4174" } },
  ],
  webServer: [
    {
      command: "npx vite preview --host 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174",
    },
    {
      command: "cd baseline && npx vite preview --host 127.0.0.1 --port 4175",
      url: "http://127.0.0.1:4175",
    },
  ],
  reporter: "list",
});
