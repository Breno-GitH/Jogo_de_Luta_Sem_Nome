import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "art/dio/qa/secondary";
fs.mkdirSync(qa, { recursive: true });
async function start(page, path = "/art/dio-secondary.html") {
  const epoch = new Date("2026-10-30T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto(path);
  const c = page.locator(path.includes("dio.html") ? "#preview" : "#arena");
  await expect(c).toHaveAttribute("data-loaded", "true");
  return c;
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
test("each secondary state is actually rendered, held and advanced in the game lab", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await start(page),
    results = [];
  const cases = {
    guardStand: "secondaryGuardStand",
    guardCrouch: "secondaryGuardCrouch",
    guardImpactStand: "secondaryGuardImpactStand",
    guardImpactCrouch: "secondaryGuardImpactCrouch",
    damageLight: "secondaryDamageLight",
    damageMedium: "secondaryDamageMedium",
    damageHeavy: "secondaryDamageHeavy",
    damageCrouch: "secondaryDamageCrouch",
    damageAir: "secondaryDamageAir",
    launched: "secondaryLaunched",
    falling: "secondaryFalling",
    downed: "secondaryDowned",
    getup: "secondaryGetup",
    grabbed: "secondaryGrabbed",
    ko: "secondaryKo",
    defeat: "secondaryDefeat",
    taunt: "secondaryTaunt",
    victory: "secondaryVictory",
  };
  for (const [scenario, clip] of Object.entries(cases)) {
    await page.selectOption("#scenario", scenario);
    if (scenario.startsWith("guard") && !scenario.includes("Impact"))
      await page.clock.runFor(34);
    await expect(c).toHaveAttribute("data-animation", clip);
    await save(c, `${qa}/state-${scenario}.png`);
    await page.locator("#pause").click();
    const before = await c.getAttribute("data-elapsed");
    await page.clock.runFor(200);
    await expect(c).toHaveAttribute("data-elapsed", before);
    await page.locator("#step").click();
    await expect(c).toHaveAttribute("data-elapsed", String(Number(before) + 1));
    results.push({ scenario, clip });
  }
  expect(errors).toEqual([]);
  await expect(page.locator("#error")).toBeEmpty();
  fs.writeFileSync(`${qa}/states.json`, JSON.stringify(results, null, 2));
});
test("real hit interrupts the Stand, removes fists and returns after facing changes on either side", async ({
  page,
}) => {
  const c = await start(page);
  for (const mirror of [false, true]) {
    await page.locator("#mirror").setChecked(mirror);
    await page.selectOption("#scenario", "interrupt");
    await page.locator("#run").click();
    await page.clock.runFor(260);
    expect(JSON.parse(await c.getAttribute("data-seen"))).toContain(
      "secondaryInterrupt",
    );
    await expect(c).toHaveAttribute("data-stand-boxes", "0");
    await save(c, `${qa}/interrupt-${mirror}.png`);
    await page.clock.runFor(2200);
    await expect(c).toHaveAttribute("data-stand-mode", "follow");
    await expect(c).toHaveAttribute("data-stand-boxes", "0");
    const x = Number(await c.getAttribute("data-owner-x")),
      sx = Number(await c.getAttribute("data-stand-x")),
      f = Number(await c.getAttribute("data-stand-facing"));
    expect(Math.abs(sx - x + 30 * f)).toBeLessThan(1);
  }
});
test("fall recovery, temporary absence and K.O. dissipation finish safely", async ({
  page,
}) => {
  const c = await start(page);
  await page.selectOption("#scenario", "launched");
  await page.clock.runFor(3000);
  const seen = JSON.parse(await c.getAttribute("data-seen"));
  for (const clip of ["secondaryVanish", "secondaryHidden", "secondaryAppear"])
    expect(seen).toContain(clip);
  await expect(c).toHaveAttribute("data-stand-mode", "follow");
  await expect(c).toHaveAttribute("data-physics-state", "idle");
  await page.selectOption("#scenario", "ko");
  await page.clock.runFor(1600);
  await expect(c).toHaveAttribute("data-stand-clip", "secondaryHidden");
  await expect(c).toHaveAttribute("data-animation", "secondaryDefeat");
  await expect(c).toHaveAttribute("data-stand-boxes", "0");
  await save(c, `${qa}/ko-absent.png`);
});
test("all 36 sheets and eight facial expressions are inspectable with frame stepping and download", async ({
  page,
}) => {
  test.setTimeout(120000);
  const c = await start(page, "/art/dio.html");
  await page.selectOption("#mode", "inspect");
  const results = [];
  for (const who of ["dio", "the-world"]) {
    await page.selectOption("#entity", who);
    const m = JSON.parse(
      fs.readFileSync(`public/sprites/${who}/secondary.json`, "utf8"),
    );
    for (const [key, clip] of Object.entries(m.clips)) {
      await page.selectOption("#animation", key);
      await page
        .getByRole("button", { name: `Quadro ${clip.count}`, exact: true })
        .click();
      await expect(c).toHaveAttribute("data-frame", String(clip.count - 1));
      results.push({ who, key, frames: clip.count });
    }
  }
  await expect(page.locator("#error")).toBeEmpty();
  expect(
    (await page.request.get("/downloads/dio-secondary.zip")).status(),
  ).toBe(200);
  fs.writeFileSync(`${qa}/inspector.json`, JSON.stringify(results, null, 2));
});
test("main game uses T for Dio and R for Road Roller, ignores held-key repeats and no longer accepts the old Super motion", async ({
  page,
}) => {
  const epoch = new Date("2026-10-30T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/");
  await page.locator("#training").click();
  await page.getByRole("radio", { name: "Selecionar Dio Brando" }).check();
  await page.locator("#fight").click();
  await page.clock.runFor(50);
  await page.locator("#unlimited-meter").uncheck();
  const c = page.locator("canvas").first();
  await c.focus();
  await page.keyboard.press("t");
  await page.clock.runFor(100);
  await expect(c).toHaveAttribute("data-animation", "secondaryTaunt");
  await page.clock.runFor(1100);
  await expect(c).toHaveAttribute("data-physics-state", "idle");
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down("s");
    await page.clock.runFor(34);
    await page.keyboard.down("d");
    await page.clock.runFor(34);
    await page.keyboard.up("s");
    if (i === 1) await page.keyboard.press("l");
    await page.clock.runFor(34);
    await page.keyboard.up("d");
  }
  expect(await c.getAttribute("data-move")).not.toBe("road_roller");
  await expect(c).toHaveAttribute("data-meter", "200");
  await page.clock.runFor(1600);
  await page.keyboard.down("r");
  await page.clock.runFor(34);
  await expect(c).toHaveAttribute("data-move", "road_roller");
  await expect(c).toHaveAttribute("data-meter", "0");
  await page.clock.runFor(2000);
  await expect(c).toHaveAttribute("data-physics-state", "idle");
  await page.keyboard.up("r");
  await expect(c).toHaveAttribute("data-camera-zoom", "1");
});
test("records real entrance, taunt, launcher recovery and KO as a fixed-tick game preview", async ({
  page,
}) => {
  test.setTimeout(180000);
  const c = await start(page),
    dir = `${qa}/recording`;
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir))
    if (/^\d{3}\.png$/.test(f)) fs.unlinkSync(`${dir}/${f}`);
  const trace = [];
  let index = 0;
  for (const [scenario, ticks] of [
    ["entrance", 110],
    ["taunt", 70],
    ["launched", 140],
    ["ko", 90],
  ]) {
    await page.selectOption("#scenario", scenario);
    await page.locator("#pause").click();
    for (let t = 0; t < ticks; t += 2) {
      for (let j = 0; j < 2; j++) await page.locator("#step").click();
      await save(c, `${dir}/${String(index++).padStart(3, "0")}.png`);
      trace.push({
        scenario,
        tick: t + 2,
        ...(await c.evaluate((n) => ({ ...n.dataset }))),
      });
    }
  }
  fs.writeFileSync(`${qa}/trace.json`, JSON.stringify(trace, null, 2));
});
