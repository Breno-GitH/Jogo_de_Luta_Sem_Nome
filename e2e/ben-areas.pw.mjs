import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = "docs/arenas/evidencias/ben-dojo";
const events = ["alien-sign", "pressure-pipe", "cargo-cart", "alien-overload", "smoothie-spill", "smoothy-sign", "patio-collapse", "delivery-cart"];
async function open(page) {
  await page.goto("./art/arenas.html"); await expect(page.locator("canvas").first()).toHaveAttribute("data-ready", "true", { timeout: 120000 }); await page.evaluate(() => window.arenaLab.pause());
}
async function shot(page, name) {
  const bytes = await page.locator("canvas").first().screenshot();
  for (let i = 0; ; i++) { try { await writeFile(`${out}/${name}.png`, bytes); return; } catch (e) { if (i > 5 || !["EPERM", "EBUSY", "UNKNOWN"].includes(e.code)) throw e; await new Promise(r => setTimeout(r, 150)); } }
}
async function saveVideo(path, bytes) {
  // Windows media indexing can briefly hold an existing recording open.
  for (let n = 0; ; n++) {
    try { await writeFile(path, bytes); return; }
    catch (e) { if (n >= 12 || !["EPERM", "EBUSY", "UNKNOWN"].includes(e.code)) throw e; await new Promise(r => setTimeout(r, 250)); }
  }
}
async function video(page, name, mode, key) {
  const base64 = await page.evaluate(async ({ mode, key }) => {
    const lab = window.arenaLab; lab.reset(mode === "dojo" ? "dojo" : "undertown", mode === "dojo" ? "asta" : "ben");
    if (mode === "event") lab.benEvent(key);
    else if (mode === "lift") lab.lift();
    else if (mode === "return") { lab.benArea("smoothy"); lab.match.arena.ben.used = true; lab.lift(); }
    else { if (key === "garden") lab.match.arena.dojo.room = "veranda"; lab.match.fighters[0].x = 1060; lab.match.fighters[1].x = 1140; }
    const chunks = [], stream = document.querySelector("canvas").captureStream(24), recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    const finish = new Promise(resolve => recorder.onstop = () => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.readAsDataURL(new Blob(chunks, { type: "video/webm" })); stream.getTracks().forEach(t => t.stop()); });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; recorder.start();
    const duration = mode === "event" ? lab.eventInfo().impactAt + 100 : mode === "dojo" ? 140 : 175;
    for (let n = 0; n < duration; n += 2) {
      if (mode === "dojo" && n === 0) { lab.advance(1, { direction: 0, down: false, pressed: ["heavy"] }); lab.advance(); }
      else lab.advance(2);
      await new Promise(r => setTimeout(r, 30));
    }
    recorder.stop(); return finish;
  }, { mode, key });
  await saveVideo(`${out}/${name}.webm`, Buffer.from(base64, "base64"));
}
test("Undertown and Smoothy: eight authored events, atlas alpha, movement, consequences and videos", async ({ page }) => {
  test.setTimeout(240000); await mkdir(out, { recursive: true }); await open(page);
  const errors = []; page.on("pageerror", e => errors.push(e.message)); const proof = [];
  for (const kind of events) {
    await page.evaluate(kind => { const lab = window.arenaLab; lab.reset("undertown", "ben"); lab.benEvent(kind); const h = lab.eventInfo(); lab.match.fighters[1].x = h.x; lab.match.fighters[0].x = h.x < 640 ? 650 : 450; }, kind);
    const info = await page.evaluate(() => window.arenaLab.eventInfo()); await shot(page, `${kind}-origem`);
    for (const [name, age] of [["aviso", info.timing.preparation + 35], ["acao", info.timing.preparation + info.timing.warning + Math.floor(info.timing.action / 2)], ["impacto", info.impactAt + 3], ["consequencia", info.impactAt + info.timing.impact + 35]]) {
      await page.evaluate(age => { const lab = window.arenaLab; lab.advance(age - lab.eventInfo().age); }, age); await shot(page, `${kind}-${name}`);
    }
    const result = await page.evaluate(() => {
      const lab = window.arenaLab, before = JSON.stringify(lab.match.arena), times = [];
      for (let i = 0; i < 30; i++) { const start = performance.now(); lab.renderer.draw(lab.match); times.push(performance.now() - start); }
      const images = [...lab.renderer.sprites.entries()].filter(([id]) => id.includes("arenas/events/ben-") || id === "arenas/events/undertown.png");
      const matte = images.map(([id, image]) => { const c = document.createElement("canvas"); c.width = image.naturalWidth; c.height = image.naturalHeight; const ctx = c.getContext("2d"); ctx.drawImage(image, 0, 0); return { id, alpha: ctx.getImageData(0, 0, 1, 1).data[3] }; });
      lab.renderer.effects = false; lab.renderer.draw(lab.match); lab.renderer.effects = true;
      return { hp: lab.match.fighters.map(f => f.health), terrain: lab.match.arena.terrain.map(t => t.kind), readOnly: before === JSON.stringify(lab.match.arena), p95: times.sort((a, b) => a - b)[28], matte };
    });
    expect(result.readOnly).toBe(true); expect(result.p95).toBeLessThan(90); expect(result.matte.every(p => p.alpha <= 2)).toBe(true);
    proof.push({ kind, ...result }); await video(page, kind, "event", kind); console.log(`${kind}: captured`);
  }
  expect(errors).toEqual([]); await writeFile(`${out}/eventos.json`, JSON.stringify(proof, null, 2));
});
test("lift boarding, ascent, daylight arrival and connected dojo rooms use the real renderer", async ({ page }) => {
  test.setTimeout(150000); await mkdir(out, { recursive: true }); await open(page);
  await page.evaluate(() => window.arenaLab.reset("undertown", "ben")); await shot(page, "undertown-intacta");
  await page.evaluate(() => {
    const lab = window.arenaLab, m = lab.match; m.fighters[0].x = 1020; m.fighters[1].x = 1130;
    for (let n = 1; n <= 3; n++) { m.hits = [{ serial: n, frame: m.frame, attacker: 0, victim: 1, move: "impact-proof", damage: 60, blocked: false, combo: 1 }]; lab.advance(); }
  });
  expect(await page.evaluate(() => window.arenaLab.match.arena.ben.exposed)).toBe(true); await shot(page, "elevador-exposto");
  const before = await page.evaluate(() => { const lab = window.arenaLab, m = lab.match; const before = m.fighters.map(f => [f.health, f.meter]); m.hits = [{ serial: 4, frame: m.frame, attacker: 0, victim: 1, move: "impact-proof", damage: 60, blocked: false, combo: 1 }]; lab.advance(18); return before; });
  await shot(page, "elevador-embarque"); await page.evaluate(() => window.arenaLab.advance(56)); await shot(page, "elevador-subida");
  const cameras = [{ x: 640, y: 360, scale: .5 }, { x: 40, y: -100, scale: .65, angle: -.14 }, { x: 1240, y: 80, scale: .72, angle: .16 }];
  for (const camera of cameras) expect((await page.evaluate(c => window.arenaLab.coverageScene(c), camera)).transparent).toBe(0);
  await page.evaluate(() => window.arenaLab.advance(67)); await shot(page, "elevador-chegada"); await page.evaluate(() => window.arenaLab.advance(20));
  expect(await page.evaluate(() => window.arenaLab.match.arena.ben.area)).toBe("smoothy");
  expect(await page.evaluate(() => window.arenaLab.match.fighters.map(f => [f.health, f.meter]))).toEqual(before);
  await shot(page, "smoothy-intacto"); for (const camera of cameras) expect((await page.evaluate(c => window.arenaLab.coverageScene(c), camera)).transparent).toBe(0);
  await video(page, "elevador-transicao", "lift");
  await page.evaluate(() => { const lab = window.arenaLab; lab.benArea("smoothy"); lab.match.arena.ben.used = true; lab.match.arena.ben.cooldown = 0; lab.match.fighters[0].x = 1140; lab.match.fighters[1].x = 940; lab.advance(38, { direction: 0, down: true, pressed: [] }); });
  expect(await page.evaluate(() => window.arenaLab.match.arena.ben.lift.to)).toBe("market");
  await page.evaluate(() => window.arenaLab.advance(65)); await shot(page, "elevador-retorno-descida");
  await page.evaluate(() => window.arenaLab.advance(110)); expect(await page.evaluate(() => window.arenaLab.match.arena.ben.area)).toBe("market");
  await shot(page, "elevador-retorno-cidade"); await video(page, "elevador-retorno", "return");
  for (const room of ["hall", "west", "veranda", "garden"]) {
    await page.evaluate(room => { const lab = window.arenaLab; lab.reset("dojo"); if (room !== "hall") { lab.travel(room, room === "west" ? -1 : 1, room === "garden"); lab.advance(66); } }, room);
    expect(await page.evaluate(() => window.arenaLab.match.arena.dojo.room)).toBe(room); await shot(page, `dojo-${room}`);
    for (const camera of cameras) expect((await page.evaluate(c => window.arenaLab.coverageScene(c), camera)).transparent).toBe(0);
    await page.evaluate(() => { const lab = window.arenaLab; lab.event(true); lab.advance(lab.eventInfo().impactAt + 20); }); await shot(page, `dojo-${room}-evento`);
  }
  await page.evaluate(() => { const lab = window.arenaLab; lab.reset("dojo", "asta"); lab.launchRoom("veranda", 1); lab.advance(22); }); await shot(page, "dojo-golpe-voo");
  await page.evaluate(() => window.arenaLab.advance(32)); await shot(page, "dojo-golpe-aterrissagem");
  await page.evaluate(() => window.arenaLab.advance(12)); expect(await page.evaluate(() => window.arenaLab.match.arena.dojo.room)).toBe("veranda");
  await video(page, "dojo-impacto-entre-salas", "dojo"); await video(page, "dojo-varanda-jardim", "dojo", "garden");
});
test("all nine supers restore combat in both Ben areas and all four dojo rooms", async ({ page }) => {
  test.setTimeout(180000); await mkdir(out, { recursive: true }); await open(page); const proof = [];
  for (const area of ["market", "smoothy", "hall", "west", "veranda", "garden"]) for (const fighter of ["samurai", "dio", "goku", "luffy", "sasuke", "kaneki", "ben", "xebec", "asta"]) {
    const result = await page.evaluate(({ area, fighter }) => {
      const lab = window.arenaLab, ben = ["market", "smoothy"].includes(area); lab.reset(ben ? "undertown" : "dojo", fighter);
      if (ben) lab.benArea(area); else lab.match.arena.dojo.room = area;
      const m = lab.match, f = m.fighters[0], target = m.fighters[1]; if (f.omnitrix) f.omnitrix.active = f.omnitrix.selected = "echoEcho";
      f.x = 530; target.x = 640; f.meter = f.meterMaximum; lab.advance(1, { direction: 0, down: false, pressed: ["ultimate"] }); const started = f.state === "attack";
      let capture;
      for (let n = 0; n < 1600; n++) {
        m.step([{ direction: 0, down: false, pressed: [] }, { direction: 0, down: false, pressed: [] }]); lab.renderer.tick(m);
        if (n % 12 === 0) lab.renderer.draw(m);
        if (ben && n === 60) capture = document.querySelector("canvas").toDataURL("image/png").split(",")[1];
        if (n > 80 && !m.cinematicActive && f.state === "idle") break;
      }
      return { area, fighter, started, restored: !m.cinematicActive && !m.capture, finite: m.fighters.every(f => Number.isFinite(f.x) && Number.isFinite(f.y)), capture };
    }, { area, fighter });
    expect(result.started, `${area}/${fighter}`).toBe(true); expect(result.restored).toBe(true); expect(result.finite).toBe(true);
    const { capture, ...record } = result;
    if (capture) await writeFile(`${out}/super-${area}-${fighter}.png`, Buffer.from(capture, "base64"));
    proof.push(record);
  }
  await writeFile(`${out}/supers.json`, JSON.stringify(proof, null, 2));
});
