import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost/2025/Jogo_de_Luta_Sem_Nome/";
const out = "deployment/audit/sasuke-specials";
const clips = {
  senbon: 15, eiso: 15, chidori: 16, gokakyu: 20,
  hosenka: 24, goryuka: 29, serpents: 16, nagashi: 12,
};
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(new URL("art/sasuke.html", base).href);
  await page.locator("#arena[data-loaded=true]").waitFor();
  const save = (name, url) =>
    writeFile(join(out, name), Buffer.from(url.split(",")[1], "base64"));
  for (const [id, hitTick] of Object.entries(clips)) {
    await page.selectOption("#scenario", id);
    const frames = await page.evaluate((hitTick) => {
      const canvas = document.getElementById("arena");
      const seek = document.getElementById("seek");
      const step = document.getElementById("step");
      seek.value = "0";
      seek.dispatchEvent(new Event("input"));
      const crop = document.createElement("canvas");
      crop.width = 460;
      crop.height = 178;
      const context = crop.getContext("2d");
      const frames = [];
      let full;
      for (let i = 0; i <= 69; i++) {
        if (i === hitTick) full = canvas.toDataURL();
        if (i % 3 === 0) {
          context.drawImage(canvas, 520, 417, 460, 178, 0, 0, 460, 178);
          frames.push(crop.toDataURL());
        }
        step.click();
      }
      return { frames, full };
    }, hitTick);
    await save(id + ".png", frames.full);
    const cels = join(out, "frames", id);
    await mkdir(cels, { recursive: true });
    await Promise.all(frames.frames.map((url, i) =>
      writeFile(join(cels, i + ".png"), Buffer.from(url.split(",")[1], "base64")),
    ));
  }
} finally {
  await browser.close();
}
