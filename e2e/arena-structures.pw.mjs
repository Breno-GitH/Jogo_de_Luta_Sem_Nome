import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const ids = ["dojo", "budokai", "cairo", "enies", "uchiha", "anteiku", "undertown", "godvalley", "clover"];
const out = "docs/arenas/evidencias/estruturas";
async function capture(page, path) {
  const pixels = await page.locator("canvas").first().screenshot();
  // Windows can briefly hold an existing PNG; retry only artifact writes.
  for (let attempt = 0; ; attempt++) {
    try { await writeFile(path, pixels); return; }
    catch (error) {
      if (attempt === 6 || !["EPERM", "EBUSY", "UNKNOWN"].includes(error.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
}
test("open stages use a continuous chasm and first to three round wins", async ({ page }) => {
  test.setTimeout(120000); await mkdir(out, { recursive: true });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("./art/arenas.html");
  await expect(page.locator("canvas").first()).toHaveAttribute("data-ready", "true", { timeout: 90000 });
  await page.evaluate(() => window.arenaLab.pause());
  for (const id of ["undertown", "clover"]) {
    expect((await page.evaluate(id => window.arenaLab.upperPreservation(id), id)).changed).toBe(0);
    await page.evaluate(id => { const lab = window.arenaLab; lab.reset(id); lab.match.rules.training = false; lab.advance(20); }, id);
    expect(await page.evaluate(() => window.arenaLab.match.roundsToWin)).toBe(3);
    await capture(page, `${out}/${id}-continuidade-depois.png`);
    for (let won = 1; won <= 3; won++) {
      await page.evaluate(() => {
        const lab = window.arenaLab, m = lab.match, target = m.fighters[1];
        m.phase = "fight"; target.x = 1190; target.y = 580; target.setState("air"); lab.advance(100);
      });
      expect(await page.evaluate(() => window.arenaLab.match.wins[0])).toBe(won);
      if (won === 1) await capture(page, `${out}/${id}-queda-ko.png`);
      if (won === 2) await capture(page, `${out}/${id}-dois-rounds.png`);
      await page.evaluate(() => window.arenaLab.advance(150));
      expect(await page.evaluate(() => window.arenaLab.match.phase)).toBe(won < 3 ? "intro" : "finished");
    }
  }
  expect(errors).toEqual([]);
});
test("real arena engine: collision, descent, lower combat and opaque camera matrix", async ({ page }) => {
  test.setTimeout(240000); await mkdir(out, { recursive: true });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("./art/arenas.html");
  await expect(page.locator("canvas").first()).toHaveAttribute("data-ready", "true", { timeout: 120000 });
  await page.evaluate(() => window.arenaLab.pause());
  const proof = [];
  for (const id of ids) {
    await page.evaluate(id => { window.arenaLab.reset(id); window.arenaLab.advance(30); }, id);
    await capture(page, `${out}/${id}-normal.png`);
    await page.evaluate(() => { window.arenaLab.event(); window.arenaLab.advance(18); });
    await capture(page, `${out}/${id}-aviso.png`);
    for (const camera of [
      { x: 640, y: 360, scale: .5 }, { x: 40, y: 50, scale: .65 },
      { x: 1240, y: 120, scale: .72, angle: .16 }, { x: 640, y: -180, scale: .6 },
    ]) {
      const result = await page.evaluate(({ id, camera }) => window.arenaLab.coverage(id, camera), { id, camera });
      expect(result.transparent, `${id}: ${JSON.stringify(camera)}`).toBe(0); proof.push({ id, camera, ...result });
    }
  }
  for (const id of ["enies", "godvalley"]) {
    await page.evaluate(id => { const lab = window.arenaLab; lab.reset(id); lab.event(true); lab.advance(92); }, id);
    expect(await page.evaluate(() => !!window.arenaLab.match.arena.transition)).toBe(true);
    await capture(page, `${out}/${id}-queda-inicio.png`);
    await page.evaluate(() => window.arenaLab.advance(36));
    await capture(page, `${out}/${id}-queda-meio.png`);
    await page.evaluate(() => window.arenaLab.advance(60));
    expect(await page.evaluate(() => window.arenaLab.match.arena.level)).toBe(1);
    await capture(page, `${out}/${id}-inferior.png`);
    const before = await page.evaluate(() => window.arenaLab.match.fighters[0].x);
    await page.evaluate(() => window.arenaLab.advance(8, { direction: 1, down: false, pressed: [] }));
    expect(await page.evaluate(() => window.arenaLab.match.fighters[0].x)).toBeGreaterThan(before);
    for (const level of [0, 1]) for (const tick of [0, 42, 80]) {
      const result = await page.evaluate(({ id, level, tick }) => window.arenaLab.coverage(id, { x: 640, y: level ? 360 : 360 + tick / 84 * 720, scale: .65, angle: .08 }, level, level ? undefined : tick), { id, level, tick });
      expect(result.transparent).toBe(0);
    }
    const video = await page.evaluate(async id => {
      const lab = window.arenaLab; lab.reset(id); lab.event(true);
      const stream = document.querySelector("canvas").captureStream(24), chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const finished = new Promise(resolve => recorder.onstop = async () => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(new Blob(chunks, { type: "video/webm" })); stream.getTracks().forEach(track => track.stop());
      });
      recorder.start();
      for (let n = 0; n < 194; n++) { lab.advance(); await new Promise(resolve => setTimeout(resolve, 17)); }
      recorder.stop(); return finished;
    }, id);
    await writeFile(`${out}/${id}-descida.webm`, Buffer.from(video, "base64"));
  }
  for (const id of ["undertown", "clover"]) {
    await page.evaluate(id => { window.arenaLab.reset(id); window.arenaLab.platform(); }, id);
    await capture(page, `${out}/${id}-plataforma.png`);
    expect(await page.evaluate(() => window.arenaLab.match.fighters[0].airborne)).toBe(false);
    await page.evaluate(() => {
      const lab = window.arenaLab; lab.advance(1, { direction: 0, down: true, pressed: ["jump"] }); lab.advance(50);
    });
    expect(await page.evaluate(() => window.arenaLab.match.fighters[0].y)).toBe(580);
    await page.evaluate(() => {
      const lab = window.arenaLab, f = lab.match.fighters[0];
      f.x = 92; f.y = 580; f.setState("air"); lab.advance(39);
    });
    await capture(page, `${out}/${id}-borda-aberta.png`);
    expect(await page.evaluate(() => window.arenaLab.match.fighters[0].y)).toBeGreaterThan(750);
    await page.evaluate(() => window.arenaLab.advance(75));
    expect(await page.evaluate(() => window.arenaLab.match.fighters[0].health)).toBe(0);
    expect(await page.evaluate(() => window.arenaLab.match.phase)).toBe("roundEnd");
    await capture(page, `${out}/${id}-queda-ko.png`);
  }
  await writeFile(`${out}/camera-resultados.json`, JSON.stringify(proof, null, 2));
  expect(errors).toEqual([]);
});

test("all nine fighters execute their super across the nine stage backdrops", async ({ page }) => {
  test.setTimeout(300000); await mkdir(out, { recursive: true });
  await page.goto("./art/arenas.html");
  await expect(page.locator("canvas").first()).toHaveAttribute("data-ready", "true", { timeout: 120000 });
  await page.evaluate(() => window.arenaLab.pause());
  const results = [];
  for (const id of ids) for (const fighter of ["samurai", "dio", "goku", "luffy", "sasuke", "kaneki", "ben", "xebec", "asta"]) {
    const result = await page.evaluate(({ id, fighter }) => {
      const lab = window.arenaLab; lab.reset(id, fighter);
      const m = lab.match, f = m.fighters[0], enemy = m.fighters[1];
      if (f.omnitrix) f.omnitrix.active = f.omnitrix.selected = "echoEcho";
      f.x = 530; enemy.x = 640; f.meter = f.meterMaximum;
      lab.advance(1, { direction: 0, down: false, pressed: ["ultimate"] });
      const started = f.state === "attack";
      let cinematic = false;
      for (let n = 0; n < 1600; n++) { m.step([{ direction: 0, down: false, pressed: [] }, { direction: 0, down: false, pressed: [] }]); lab.renderer.tick(m); if (n % 12 === 0) lab.renderer.draw(m); cinematic ||= m.cinematicActive; if (n > 80 && !m.cinematicActive && f.state === "idle") break; }
      const restored = !m.cinematicActive && !m.capture;
      const finite = m.fighters.every(actor => Number.isFinite(actor.x) && Number.isFinite(actor.y));
      return { id, fighter, started, cinematic, restored, finite, level: m.arena.level };
    }, { id, fighter });
    expect(result.started, `${id}/${fighter} activation`).toBe(true);
    expect(result.restored, `${id}/${fighter}`).toBe(true); expect(result.finite).toBe(true);
    results.push(result);
  }
  await writeFile(`${out}/supers-matriz.json`, JSON.stringify(results, null, 2));
});
