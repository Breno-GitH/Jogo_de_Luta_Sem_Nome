import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/online",
  testMatch: "**/*.pw.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  reporter: "list",
  outputDir: "test-results/online",
  use: { baseURL: "http://127.0.0.1:5175" },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    env: { ONLINE_PROXY_TARGET: "http://127.0.0.1:3101", PLAYWRIGHT_NO_HMR: "1" },
  },
});
