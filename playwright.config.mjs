import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.mjs",
  testIgnore: "**/online/**",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
  },
  webServer: {
    env: { PLAYWRIGHT_NO_HMR: "1" },
    command: `node node_modules/vite/bin/vite.js ${process.env.SAMURAI_TEST_BUILD === "1" ? "preview" : ""} --host 127.0.0.1 --port 5173 --strictPort`,
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
