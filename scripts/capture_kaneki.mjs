import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost/2025/Jogo_de_Luta_Sem_Nome/";
const spriteDir = "public/sprites/kaneki";
const previewDir = "public/previews/kaneki";
await mkdir(previewDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 900 },
  });
  await page.goto(new URL("art/kaneki.html", base).href);
  const arena = page.locator("#arena[data-loaded=true]");
  await arena.waitFor();
  for (const [event, path] of [
    ["kaneki:export-poses", spriteDir + "/kagune-poses.png"],
    ["kaneki:export-contact", previewDir + "/prancha.png"],
    ["kaneki:export-scale", previewDir + "/escala.png"],
  ]) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      arena.dispatchEvent(event),
    ]);
    await download.saveAs(path);
  }
  await page.locator("#scenario").selectOption("idle");
  await page.locator("#seek").evaluate((input) => {
    input.value = "13";
    input.dispatchEvent(new Event("input"));
  });
  await arena.screenshot({ path: previewDir + "/idle-ampliado.png" });
  const stats = await page.evaluate(() => {
    const step = document.getElementById("step");
    const start = performance.now();
    for (let i = 0; i < 216; i++) step.click();
    return {
      ticks: 216,
      millisecondsPerTick: (performance.now() - start) / 216,
    };
  });
  console.log(JSON.stringify(stats));
} finally {
  await browser.close();
}
