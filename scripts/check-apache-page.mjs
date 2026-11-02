import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [],
  failures = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() });
});
mkdirSync("deployment/audit/lan", { recursive: true });
try {
  for (const prefix of [
    "http://localhost/2025/Jogo_de_Luta_Sem_Nome/",
    "http://localhost/jogo-luta/",
  ]) {
    const response = await page.goto(prefix + "?apache=production");
    await page.locator("#online").waitFor({ state: "visible" });
    const scripts = await page
      .locator("script[src]")
      .evaluateAll((nodes) => nodes.map((n) => n.src));
    if (
      scripts.some((s) => s.includes("/src/")) ||
      !scripts.some((s) => s.includes("/assets/"))
    )
      throw Error("Development HTML was served");
    results.push({
      url: page.url(),
      status: response.status(),
      scripts,
      cache: response.headers()["cache-control"],
    });
    if (prefix.includes("/2025/"))
      await page.screenshot({
        path: "deployment/audit/lan/apache-menu.png",
        fullPage: true,
      });
  }
  if (errors.length || failures.length)
    throw Error(JSON.stringify({ errors, failures }));
  writeFileSync(
    "deployment/audit/lan/apache-menu.json",
    JSON.stringify({ results, errors, failures }, null, 2),
  );
  console.log(JSON.stringify({ results, errors, failures }, null, 2));
} finally {
  await browser.close();
}
