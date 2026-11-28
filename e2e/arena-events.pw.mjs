import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const ids = ["enies", "anteiku", "godvalley", "cairo", "uchiha", "dojo", "budokai", "undertown", "clover"];
const out = "docs/arenas/evidencias/eventos";
async function capture(page, path) {
  const bytes = await page.locator("canvas").first().screenshot();
  for (let attempt = 0; ; attempt++) {
    try { await writeFile(path, bytes); return; }
    catch (error) { if (attempt >= 6 || !["EPERM", "EBUSY", "UNKNOWN"].includes(error.code)) throw error; await new Promise(r => setTimeout(r, 150)); }
  }
}
test("nine real arena event sequences: source, warning, action, impact, consequence and animation", async ({ page }) => {
  test.setTimeout(240000); await mkdir(out, { recursive: true });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("./art/arenas.html");
  await expect(page.locator("canvas").first()).toHaveAttribute("data-ready", "true", { timeout: 120000 });
  await page.evaluate(() => window.arenaLab.pause());
  const results = [];
  const selected = process.env.MSFD_EVENT_ARENAS?.split(",") ?? ids;
  for (const id of selected) {
    await mkdir(`${out}/${id}`, { recursive: true });
    await page.evaluate(id => { const lab = window.arenaLab; lab.reset(id); lab.advance(12); }, id);
    await capture(page, `${out}/${id}/01-origem.png`);
    const asset = await page.evaluate(id => {
      const image = window.arenaLab.renderer.sprites.get(`arenas/events/${id}.png`);
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const c = canvas.getContext("2d"); c.drawImage(image, 0, 0);
      const alpha = c.getImageData(0, 0, canvas.width, canvas.height).data;
      const corners = [3, (canvas.width - 1) * 4 + 3, (canvas.height - 1) * canvas.width * 4 + 3].map(i => alpha[i]);
      return { width: canvas.width, height: canvas.height, corners };
    }, id);
    // PNG alpha may round a virtually transparent texel to 1/255.
    expect(asset.corners.every(alpha => alpha <= 2), `${id}: no opaque atlas matte`).toBe(true);
    const info = await page.evaluate(() => {
      const lab = window.arenaLab; lab.event(); const h = lab.eventInfo();
      lab.match.fighters[1].x = h.x; lab.match.fighters[0].x = h.x < 640 ? 650 : 450;
      return h;
    });
    const targets = [
      ["02-aviso", info.timing.preparation + 18],
      ["03-acao", info.timing.preparation + info.timing.warning + Math.floor(info.timing.action / 2)],
      ["04-impacto", info.impactAt + 3],
      ["05-consequencia", info.impactAt + info.timing.impact + 45],
    ];
    for (const [name, age] of targets) {
      await page.evaluate(age => { const lab = window.arenaLab; lab.advance(age - lab.eventInfo().age); }, age);
      await capture(page, `${out}/${id}/${name}.png`);
    }
    const consequence = await page.evaluate(() => {
      const lab = window.arenaLab, m = lab.match, before = JSON.stringify(m.arena);
      const times = []; for (let n = 0; n < 30; n++) { const start = performance.now(); lab.renderer.draw(m); times.push(performance.now() - start); }
      return { hp: m.fighters.map(f => f.health), terrain: m.arena.terrain.map(t => t.kind), renderMs: times.sort((a, b) => a - b)[28], readOnly: before === JSON.stringify(m.arena) };
    });
    expect(consequence.readOnly).toBe(true);
    expect(consequence.renderMs, `${id} draw p95`).toBeLessThan(90);
    const video = await page.evaluate(async id => {
      const lab = window.arenaLab; lab.reset(id); lab.event();
      const info = lab.eventInfo(), samples = [], chunks = [], stream = document.querySelector("canvas").captureStream(24);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
      const finish = new Promise(resolve => recorder.onstop = async () => {
        const reader = new FileReader(); reader.onload = () => resolve({ base64: String(reader.result).split(",")[1], samples });
        reader.readAsDataURL(new Blob(chunks, { type: "video/webm" })); stream.getTracks().forEach(t => t.stop());
      });
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; recorder.start();
      for (let n = 0; n < info.impactAt + info.timing.impact + 110; n += 2) {
        lab.advance(2); if (n % 24 === 0) samples.push(lab.eventInfo().stage);
        await new Promise(r => setTimeout(r, 30));
      }
      recorder.stop(); return finish;
    }, id);
    await writeFile(`${out}/${id}/sequencia.webm`, Buffer.from(video.base64, "base64"));
    results.push({ id, kind: info.kind, source: info.source, target: info.x, timing: info.timing, asset, ...consequence, stages: [...new Set(video.samples)] });
    console.log(`${id}: visual sequence recorded`);
  }
  // A stopped car, weather and NPC state must stay frozen with DIO's clock.
  const frozen = await page.evaluate(() => {
    const lab = window.arenaLab; lab.reset("cairo", "dio"); lab.event(); lab.advance(85);
    lab.match.temporal.activate(0); lab.advance();
    const before = JSON.stringify(lab.match.arena); lab.advance(30); return before === JSON.stringify(lab.match.arena);
  });
  expect(frozen).toBe(true); expect(errors).toEqual([]);
  await writeFile(`${out}/resultados.json`, JSON.stringify({ results, frozen, errors }, null, 2));
});
