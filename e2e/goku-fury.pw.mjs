import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "art/goku/fury/qa";
fs.mkdirSync(qa, { recursive: true });
async function start(page) {
  const epoch = new Date("2026-11-02T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("art/goku-fury.html");
  const c = page.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true", { timeout: 30000 });
  await page.clock.runFor(34);
  return c;
}
async function save(c, path) {
  fs.writeFileSync(
    path,
    Buffer.from(
      (await c.evaluate((n) => n.toDataURL())).split(",")[1],
      "base64",
    ),
  );
}
test("real cinematic recording, transform/combo/teleports/downward beam/detransformation/control return", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await start(page);
  await page.selectOption("#zoom", "1");
  await page.uncheck("#boxes");
  await page.uncheck("#infinite");
  await page.click("#execute");
  const trace = [];
  const recording = qa + "/recording";
  fs.mkdirSync(recording, { recursive: true });
  for (let i = 0; i < 200; i++) {
    await page.clock.runFor(50);
    const d = await c.evaluate((n) => ({ ...n.dataset }));
    trace.push(d);
    await save(c, `${recording}/${String(i).padStart(4, "0")}.png`);
  }
  expect(trace.some((d) => d.transformed === "true")).toBe(true);
  expect(trace.some((d) => d.furyPhase === "teleports")).toBe(true);
  expect(trace.some((d) => d.furyPhase === "beam")).toBe(true);
  expect(trace.some((d) => d.animation === "furyHairColorTransition")).toBe(
    true,
  );
  expect(trace.at(-1).capture).toBe("none");
  expect(trace.at(-1).transformed).toBe("false");
  expect(trace.at(-1).cameraZoom).toBe("1");
  expect(Number(trace.at(-1).hitCount)).toBe(16);
  expect(Number(trace.at(-1).meter)).toBe(0);
  await page.selectOption("#mode", "live");
  await page.clock.runFor(34);
  await c.focus();
  await page.keyboard.down("d");
  await page.clock.runFor(250);
  await page.keyboard.up("d");
  expect(await c.getAttribute("data-physics-state")).toBe("walk");
  expect(errors).toEqual([]);
  expect(await page.locator("#error").textContent()).toBe("");
  fs.writeFileSync(qa + "/trace.json", JSON.stringify(trace, null, 2));
  fs.writeFileSync(qa + "/recording-errors.json", JSON.stringify(errors));
});
for (const enemy of ["samurai", "dio", "goku"])
  test(`${enemy}: both directions, corner, whiff/block/empty meter, interrupt, KO and restart`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const c = await start(page),
      report = [],
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.uncheck("#infinite");
    await page.selectOption("#speed", "2");
    await page.selectOption("#opponent", enemy);
    for (const left of [false, true]) {
      if (Number(await c.getAttribute("data-facing")) !== (left ? -1 : 1))
        await page.click("#flip");
      for (const scene of [
        "hit",
        "wall",
        "block",
        "whiff",
        "noMeter",
        "interrupt",
        "ko",
      ]) {
        await page.selectOption("#scenario", scene);
        await page.click("#execute");
        await page.clock.runFor(4850);
        const d = await c.evaluate((n) => ({ ...n.dataset }));
        report.push({ enemy, left, scene, ...d });
        expect(d.capture).toBe("none");
        expect(d.transformed).toBe("false");
        expect(Number(d.hitCount)).toBe(
          ["hit", "wall", "block", "ko"].includes(scene) ? 16 : 0,
        );
        if (scene === "ko") expect(d.matchPhase).toBe("roundEnd");
        if (scene === "block") expect(Number(d.blockedHits)).toBe(0);
      }
    }
    expect(errors).toEqual([]);
    fs.writeFileSync(
      qa + `/scenarios-${enemy}.json`,
      JSON.stringify({ report, errors }, null, 2),
    );
  });
test("every exported body cel is selectable, opaque body complete, paused and stepped with pixel-perfect bounds", async ({
  page,
}) => {
  test.setTimeout(120000);
  const c = await start(page),
    manifest = JSON.parse(
      fs.readFileSync("public/sprites/goku/fury/manifest.json", "utf8"),
    );
  await page.check("#bounds");
  for (const [key, m] of Object.entries(manifest.clips)) {
    await page.selectOption("#animation", key);
    await page.click("#pause");
    for (let i = 0; i < m.count; i++) {
      await page.locator("#strip button").nth(i).click();
      expect(await c.getAttribute("data-frame")).toBe(String(i));
      expect(await c.getAttribute("data-animation")).toBe(key);
      expect(await c.getAttribute("data-smoothing")).toBe("false");
    }
    await page.click("#step");
  }
  await save(c, qa + "/inspector.png");
  expect(await page.locator("#error").textContent()).toBe("");
});
test("actual keyboard double quarter circle works mirrored and consumes energy once", async ({
  page,
}) => {
  const c = await start(page);
  for (const left of [false, true]) {
    await page.selectOption("#scenario", "hit");
    if (Number(await c.getAttribute("data-facing")) !== (left ? -1 : 1))
      await page.click("#flip");
    await page.selectOption("#mode", "live");
    await c.focus();
    const forward = left ? "a" : "d";
    for (let n = 0; n < 2; n++) {
      await page.keyboard.down("s");
      await page.clock.runFor(34);
      await page.keyboard.down(forward);
      await page.clock.runFor(34);
      await page.keyboard.up("s");
      if (n === 1) await page.keyboard.down("l");
      await page.clock.runFor(34);
      await page.keyboard.up(forward);
    }
    expect(await c.getAttribute("data-move")).toBe("ssj1_fury");
    expect(Number(await c.getAttribute("data-meter"))).toBe(0);
    await page.keyboard.up("l");
    await page.clock.runFor(9500);
    expect(await c.getAttribute("data-transformed")).toBe("false");
  }
});
