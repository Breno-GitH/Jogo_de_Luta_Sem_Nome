import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost/2025/Jogo_de_Luta_Sem_Nome/";
const out = process.argv[4] ?? "deployment/audit/sasuke-kirin";
const scenarios = {
  throw: { end: 58, marks: {} },
  "powered:throw": { end: 58, marks: {} },
  taunt: { end: 45, marks: {} },
  awakening: { end: 112, marks: {} },
  kirinStorm: { end: 255, marks: { 37: "preparacao", 66: "tempestade", 103: "dragao", 143: "comando", 161: "queda", 176: "impacto", 210: "poeira" } },
  "powered:kirinStorm": { end: 255, marks: { 37: "preparacao", 66: "tempestade", 103: "dragao", 143: "comando", 161: "queda", 176: "impacto", 210: "poeira" } },
  goryukaWave: { end: 132, marks: { 37: "inicio", 55: "onda", 85: "trajetoria", 107: "saida" } },
  chidoriFar: { end: 83, marks: { 8: "carga", 18: "investida", 27: "impacto" } },
  "powered:chidoriFar": { end: 83, marks: { 8: "carga", 18: "investida", 27: "impacto" } },
  nagashiField: { end: 69, marks: { 8: "carga", 16: "descarga", 29: "dissipacao" } },
  "powered:nagashiField": { end: 69, marks: { 8: "carga", 16: "descarga", 29: "dissipacao" } },
};
const scenario = process.argv[3] ?? "kirinStorm";
if (!(scenario in scenarios)) throw Error("Cenário de captura desconhecido: " + scenario);
await mkdir(join(out, "frames"), { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(new URL("art/sasuke.html", base).href, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("#arena[data-loaded=true]").waitFor({ timeout: 60000 });
  const save = (name, url) => writeFile(join(out, name), Buffer.from(url.split(",")[1], "base64"));
  await page.selectOption("#scenario", scenario);
  const { frames, stills } = await page.evaluate(({ end, marks }) => {
    const canvas = document.getElementById("arena");
    const seek = document.getElementById("seek");
    const step = document.getElementById("step");
    seek.value = "0";
    seek.dispatchEvent(new Event("input"));
    const preview = document.createElement("canvas");
    preview.width = 960;
    preview.height = 540;
    const c = preview.getContext("2d");
    c.imageSmoothingEnabled = false;
    const frames = [], stills = {};
    for (let tick = 0; tick <= end; tick++) {
      if (marks[tick]) stills[marks[tick]] = canvas.toDataURL();
      if (tick % 3 === 0) {
        c.drawImage(canvas, 0, 0, 960, 540);
        frames.push(preview.toDataURL());
      }
      step.click();
    }
    return { frames, stills };
  }, scenarios[scenario]);
  await Promise.all([
    ...frames.map((frame, i) => save("frames/" + String(i).padStart(3, "0") + ".png", frame)),
    ...Object.entries(stills).map(([name, frame]) => save(name + ".png", frame)),
  ]);
} finally {
  await browser.close();
}
