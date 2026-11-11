import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "art/dio/qa/road-roller";
fs.mkdirSync(qa, { recursive: true });
async function start(page) {
  const epoch = new Date("2026-10-30T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("art/road-roller.html");
  const c = page.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true");
  return c;
}
async function run(page, scenario = "hit", enemy = "samurai", mirror = false) {
  await page.selectOption("#scenario", scenario);
  await page.selectOption("#opponent", enemy);
  await page.locator("#mirror").setChecked(mirror);
  await page.locator("#run").click();
}
async function save(c, file) {
  fs.writeFileSync(
    file,
    Buffer.from(
      (await c.evaluate((n) => n.toDataURL("image/png"))).split(",")[1],
      "base64",
    ),
  );
}

test("Road Roller connects in both directions against both characters and restores camera and actors", async ({
  page,
}) => {
  test.setTimeout(100000);
  const c = await start(page),
    results = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const enemy of ["samurai", "dio"])
    for (const mirror of [false, true]) {
      await run(page, "hit", enemy, mirror);
      await page.clock.runFor(7000);
      await expect(c).toHaveAttribute("data-damage", "350");
      await expect(c).toHaveAttribute("data-hits", "15");
      await expect(c).toHaveAttribute("data-meter", "0");
      await expect(c).toHaveAttribute("data-camera-zoom", "1");
      await expect(c).toHaveAttribute("data-camera-shake", "0");
      await expect(c).toHaveAttribute("data-stand-state", "follow");
      await expect(c).toHaveAttribute("data-owner-state", "idle");
      await expect(c).toHaveAttribute("data-owner-y", "580");
      await expect(c).toHaveAttribute("data-enemy-state", "idle");
      results.push({ enemy, mirror, damage: 350, hits: 15 });
    }
  expect(errors).toEqual([]);
  fs.writeFileSync(
    `${qa}/browser-results.json`,
    JSON.stringify(results, null, 2),
  );
});
test("a held guard permits confirmation, while insufficient meter or whiff do not", async ({
  page,
}) => {
  const c = await start(page);
  for (const energy of ["0", "100", "199"]) {
    await page.selectOption("#energy", energy);
    await run(page);
    await page.clock.runFor(2200);
    await expect(c).toHaveAttribute("data-seen", "false");
    await expect(c).toHaveAttribute("data-meter", energy);
    await expect(c).toHaveAttribute("data-hits", "0");
  }
  await page.selectOption("#energy", "200");
  for (const scenario of ["block", "whiff"]) {
    await run(page, scenario);
    await page.clock.runFor(2200);
    await expect(c).toHaveAttribute("data-seen", String(scenario === "block"));
    if (scenario === "whiff") await expect(c).toHaveAttribute("data-damage", "0");
    else expect(Number(await c.getAttribute("data-damage"))).toBeGreaterThan(0);
    await expect(c).toHaveAttribute("data-meter", "0");
    await expect(c).toHaveAttribute("data-blocks", "0");
  }
});
test("combo confirmation, K.O., corners and rematch really execute", async ({
  page,
}) => {
  const c = await start(page);
  await run(page, "combo", "dio");
  await page.clock.runFor(7000);
  expect(Number(await c.getAttribute("data-damage"))).toBeGreaterThan(350);
  await expect(c).toHaveAttribute("data-hits", "16");
  await run(page, "ko");
  await page.clock.runFor(6500);
  await expect(c).toHaveAttribute("data-match-phase", "roundEnd");
  await expect(c).toHaveAttribute("data-camera-zoom", "1");
  await expect(c).toHaveAttribute("data-target-health", "0");
  await page.locator("#rematch").click();
  await expect(c).toHaveAttribute("data-meter", "200");
  await run(page);
  await page.clock.runFor(7000);
  await expect(c).toHaveAttribute("data-damage", "350");
  for (const edge of ["left", "right"]) {
    await page.selectOption("#edge", edge);
    await page.locator("#run").click();
    await page.clock.runFor(2600);
    const x = Number(await c.getAttribute("data-roller-x"));
    expect(x - 164).toBeGreaterThanOrEqual(0);
    expect(x + 164).toBeLessThanOrEqual(1280);
    await page.clock.runFor(4400);
    await expect(c).toHaveAttribute("data-stand-state", "follow");
  }
});
test("time-stop use history and cooldown survive the full Super and pause", async ({
  page,
}) => {
  const c = await start(page);
  await page.locator("#time-history").click();
  await expect(c).toHaveAttribute("data-time-uses", "1");
  const cooldown = Number(await c.getAttribute("data-time-cooldown"));
  expect(cooldown).toBeGreaterThan(1100);
  await page.locator("#execute").click();
  await page.locator("#pause").click();
  await page.clock.runFor(750);
  await expect(c).toHaveAttribute("data-capture", "roadRoller");
  const captured = await c.getAttribute("data-time-cooldown");
  await page.clock.runFor(3800);
  await expect(c).toHaveAttribute("data-time-cooldown", captured);
  await expect(c).toHaveAttribute("data-time-uses", "1");
  await page.locator("#pause").click();
  const tick = await c.getAttribute("data-road-tick");
  await page.clock.runFor(2000);
  await expect(c).toHaveAttribute("data-road-tick", tick);
  await page.locator("#step").click();
  await expect(c).toHaveAttribute("data-road-tick", String(Number(tick) + 1));
  await page.locator("#pause").click();
  await page.clock.runFor(2500);
  await expect(c).toHaveAttribute("data-time-uses", "1");
});
test("the main game accepts R for Road Roller on the keyboard", async ({
  page,
}) => {
  const epoch = new Date("2026-10-30T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("./");
  await page.locator("#training").click();
  await page.getByRole("radio", { name: "Selecionar Dio Brando" }).check();
  await page.locator("#fight").click();
  await page.clock.runFor(50);
  const c = page.locator("canvas").first();
  await expect(c).toHaveAttribute("data-meter", "200");
  await page.locator("#unlimited-meter").uncheck();
  await c.focus();
  await page.keyboard.press("r");
  await page.clock.runFor(34);
  await expect(c).toHaveAttribute("data-move", "road_roller");
  await expect(c).toHaveAttribute("data-meter", "0");
  await page.clock.runFor(2400);
  await expect(c).toHaveAttribute("data-capture", "none");
  await expect(c).toHaveAttribute("data-camera-zoom", "1");
});
test("all new character drawings are inspectable and the object and FX export are real PNGs", async ({
  page,
}) => {
  const epoch = new Date("2026-10-30T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("art/dio.html");
  const c = page.locator("#preview");
  await expect(c).toHaveAttribute("data-loaded", "true");
  await page.selectOption("#mode", "inspect");
  for (const who of ["dio", "the-world"]) {
    await page.selectOption("#entity", who);
    const clips = JSON.parse(
      fs.readFileSync(`public/sprites/${who}/road-roller.json`, "utf8"),
    ).clips;
    for (const [key, clip] of Object.entries(clips)) {
      await page.selectOption("#animation", key);
      await page
        .getByRole("button", { name: `Quadro ${clip.count}`, exact: true })
        .click();
      await expect(c).toHaveAttribute("data-frame", String(clip.count - 1));
      await save(c, `${qa}/${who}-${key}.png`);
    }
  }
  for (const file of [
    "road-roller/roadBase.png",
    "road-fx/explosion.png",
    "road-roller/roadExplosion.png",
  ])
    expect((await page.request.get("/sprites/" + file)).status()).toBe(200);
  expect((await page.request.get("/downloads/road-roller.zip")).status()).toBe(
    200,
  );
  await expect(page.locator("#error")).toBeEmpty();
});
test("records the complete real Super and every cinematic phase at fixed ticks", async ({
  page,
}) => {
  test.setTimeout(150000);
  const c = await start(page);
  await run(page);
  await page.locator("#pause").click();
  const dir = `${qa}/recording`;
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir))
    if (/^\d{3}\.png$/.test(f)) fs.unlinkSync(`${dir}/${f}`);
  const trace = [],
    captures = [],
    phases = new Set();
  let after = 0,
    seen = false,
    index = 0;
  for (let tick = 0; tick < 430; tick++) {
    await page.locator("#step").click();
    const s = await c.evaluate((n) => ({ ...n.dataset }));
    trace.push(s);
    if (s.capture === "roadRoller") seen = true;
    if (tick % 2 === 0) {
      await save(c, `${dir}/${String(index++).padStart(3, "0")}.png`);
      captures.push(tick);
    }
    if (s.roadPhase !== "none" && !phases.has(s.roadPhase)) {
      phases.add(s.roadPhase);
      await save(c, `${qa}/phase-${s.roadPhase}.png`);
    }
    if (s.roadTick === "246") await save(c, `${qa}/explosion-peak.png`);
    if (seen && s.done === "true" && ++after >= 24) break;
  }
  expect(phases.size).toBe(12);
  expect(trace.at(-1).damage).toBe("350");
  expect(trace.at(-1).cameraZoom).toBe("1");
  fs.writeFileSync(`${qa}/trace.json`, JSON.stringify(trace, null, 2));
  fs.writeFileSync(`${qa}/capture-ticks.json`, JSON.stringify(captures));
});
