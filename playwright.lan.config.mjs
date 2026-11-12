import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/lan",
  testMatch: "**/*.pw.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  reporter: "list",
  outputDir: "test-results/lan",
  webServer: process.env.BEN_LAN_TEST_URL ? {
    command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5188 --strictPort",
    url: process.env.BEN_LAN_TEST_URL,
    env: { ONLINE_PROXY_TARGET: "http://127.0.0.1:3188" },
    reuseExistingServer: false,
  } : undefined,
  use: {
    channel: "chrome",
    headless: true,
    baseURL: "http://localhost/jogo-luta/",
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
  },
});
