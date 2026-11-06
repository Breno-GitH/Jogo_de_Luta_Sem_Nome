import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/menu",
  testMatch: "**/*.pw.mjs",
  workers: 1,
  timeout: 120000,
  reporter: "list",
  outputDir: "test-results/menu",
  use: {
    channel: "chrome",
    headless: true,
    baseURL: process.env.MENU_URL || "http://127.0.0.1:5191/",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
});
