import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/lan",
  testMatch: "**/*.pw.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  reporter: "list",
  outputDir: "test-results/lan",
  use: {
    channel: "chrome",
    headless: true,
    baseURL: "http://localhost/jogo-luta/",
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
  },
});
