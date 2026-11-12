import { defineConfig } from "@playwright/test";
const preview = process.env.BEN_LAN_TEST_URL;
const port = preview ? Number(new URL(preview).port) : 0;
const backendPort = Number(process.env.BEN_LAN_BACKEND_PORT ?? 3188);

export default defineConfig({
  testDir: "./e2e/lan",
  testMatch: "**/*.pw.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  reporter: "list",
  outputDir: "test-results/lan",
  webServer: preview ? {
    command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: preview,
    env: { ONLINE_PROXY_TARGET: `http://127.0.0.1:${backendPort}` },
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
