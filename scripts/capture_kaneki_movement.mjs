import { chromium } from "@playwright/test";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const base = process.argv[2] ?? "http://localhost/2025/Jogo_de_Luta_Sem_Nome/";
const output = "public/previews/kaneki";
const scenes = {
  idle: 72,
  walkForward: 40,
  walkBack: 44,
  dashForward: 30,
  backdash: 30,
  crouch: 50,
  jump: 66,
  jumpForward: 66,
  jumpBack: 66,
};
const temp = await mkdtemp(join(tmpdir(), "kaneki-movement-"));
const saved = [];
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1120, height: 900 },
  });
  await page.goto(new URL("art/kaneki.html", base).href);
  const arena = page.locator("#arena[data-loaded=true]");
  await arena.waitFor();
  const [scale] = await Promise.all([
    page.waitForEvent("download"),
    arena.dispatchEvent("kaneki:export-scale"),
  ]);
  await scale.saveAs(output + "/escala.png");
  for (const [scene, ticks] of Object.entries(scenes)) {
    await page.selectOption("#scenario", scene);
    const result = await page.evaluate((ticks) => {
      const seek = document.getElementById("seek");
      seek.value = "0";
      seek.dispatchEvent(new Event("input"));
      const arena = document.getElementById("arena");
      const step = document.getElementById("step");
      const frames = [];
      for (let i = 0; i < ticks; i++) {
        if (i % 2 === 0)
          frames.push(arena.toDataURL("image/png").split(",")[1]);
        step.click();
      }
      const start = performance.now();
      for (let i = 0; i < 72; i++) step.click();
      return { frames, millisecondsPerTick: (performance.now() - start) / 72 };
    }, ticks);
    for (const [i, bytes] of result.frames.entries()) {
      const path = join(
        temp,
        scene + "-" + String(i).padStart(3, "0") + ".png",
      );
      await writeFile(path, Buffer.from(bytes, "base64"));
      saved.push(path);
    }
    console.log(
      scene,
      result.frames.length,
      result.millisecondsPerTick.toFixed(2) + " ms/tick",
    );
  }
  const result = spawnSync(
    process.execPath,
    ["scripts/run_art.mjs", "scripts/compose_kaneki_movement.py", temp],
    { stdio: "inherit", windowsHide: true },
  );
  if (result.status !== 0) throw Error("Falha ao compor a prévia de Kaneki");
} finally {
  await browser.close();
  await Promise.all(saved.map((path) => unlink(path)));
  await rmdir(temp);
}
