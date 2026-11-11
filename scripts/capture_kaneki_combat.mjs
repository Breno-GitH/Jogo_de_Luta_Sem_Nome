import { chromium } from "@playwright/test";
import { mkdir, mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const specials = process.argv.includes("--especiais");
const chain = process.argv.includes("--chain");
const stage5 = process.argv.includes("--stage5");
const centipede = process.argv.includes("--centipede");
const base = process.argv.slice(2).find(arg => !arg.startsWith("--"))
  ?? "http://localhost/2025/Jogo_de_Luta_Sem_Nome/";
const scenes = centipede ? [["kaneki-combat","superCentipede",560,"kaneki/centipede"]] : stage5 ? ["centipedeDrop","redCatapult","centipedeMeteor","swordsRise","rushCrossover","rushSlam","stage5Escape"].map(id =>
  ["kaneki-combat", id, id === "centipedeDrop" || id === "centipedeMeteor" ? 180 : 150, "kaneki/stage5-" + id]) : chain ? ["throw","embrace","pendulum","centipede","lasso","spin","meteor"].map(id =>
  ["kaneki-combat", id, 150, "kaneki/chain-" + id]) : specials ? ["fourSwords", "rinkakuRush"].flatMap((family) =>
  ["light", "medium", "heavy"].map((strength, i) =>
    ["kaneki-combat", `${family}_${strength}`, 105, `kaneki/${family}-${"jkl"[i]}`])) : [
  ["kaneki-combat", "pull", 70, "kaneki/puxar"],
  ["kaneki-combat", "throw", 70, "kaneki/arremessar"],
  ["kaneki-combat", "launch", 70, "kaneki/lancar"],
  ["sasuke", "taunt", 47, "sasuke-final/provocacao"],
  ["sasuke", "powered:taunt", 47, "sasuke-final/provocacao-marca-ii"],
];
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage();
  for (const [lab, mode, ticks, filename] of scenes) {
    await page.goto(new URL("art/" + lab + ".html", base).href, {
      waitUntil: "domcontentloaded",
    });
    await page.locator("#arena[data-loaded=true]").waitFor({ timeout: 30000 });
    await page.selectOption("#scenario", mode);
    const { frames, poses } = await page.evaluate(({ticks, centipede}) => {
      const seek = document.getElementById("seek");
      seek.value = "0";
      seek.dispatchEvent(new Event("input"));
      const arena = document.getElementById("arena");
      const step = document.getElementById("step");
      const preview = document.createElement("canvas");
      preview.width = 768;
      preview.height = 432;
      const ctx = preview.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      const frames = [], poses = {};
      for (let tick = 0; tick < ticks; tick++) {
        if (tick % 3 === 0) {
          ctx.drawImage(arena, 0, 0, 768, 432);
          frames.push(preview.toDataURL().split(",")[1]);
        }
        const beat = Number(arena.dataset.centipedeTick);
        if (centipede && [16,58,82,143,226,275,313,336,354,367,411].includes(beat) && !poses[beat])
          poses[beat] = arena.toDataURL().split(",")[1];
        if (centipede && tick === 549) poses[549] = arena.toDataURL().split(",")[1];
        step.click();
      }
      return {frames,poses};
    }, {ticks,centipede});

    const temp = await mkdtemp(join(tmpdir(), "rinkaku-"));
    const folder = join(temp, "frames");
    await mkdir(folder);
    const written = [];
    try {
      for (const [i, bytes] of frames.entries()) {
        const path = join(folder, String(i).padStart(3, "0") + ".png");
        await writeFile(path, Buffer.from(bytes, "base64"));
        written.push(path);
      }
      const output = resolve("public/previews", filename + ".webp");
      const result = spawnSync(
        process.execPath,
        [
          "scripts/run_art.mjs",
          "scripts/compose_sasuke_kirin.py",
          temp,
          output,
        ],
        { stdio: "inherit", windowsHide: true },
      );
      if (result.status !== 0) throw Error("Falha ao exportar " + output);
      if (centipede) {
        for (const [tick,bytes] of Object.entries(poses)) {
          const path = join(temp, tick + ".png");
          await writeFile(path, Buffer.from(bytes,"base64"));
          written.push(path);
        }
        const sheets = spawnSync(process.execPath,["scripts/run_art.mjs",
          "scripts/compose_kaneki_centipede.py",temp],{stdio:"inherit",windowsHide:true});
        if (sheets.status !== 0) throw Error("Falha ao montar a prancha Centipede");
      }
      console.log(filename + ": " + frames.length + " quadros capturados");
    } finally {
      await Promise.all(written.map((path) => unlink(path)));
      await rmdir(folder);
      await rmdir(temp);
    }
  }
} finally {
  await browser.close();
}
