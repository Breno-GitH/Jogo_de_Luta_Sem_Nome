import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "art/goku/specials/stage3/qa";
fs.mkdirSync(qa, { recursive: true });
async function start(page) {
  const epoch = new Date("2026-11-02T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/goku-specials.html");
  const c = page.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true", { timeout: 20000 });
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
test("all nine special variants work in both directions against all three characters without spending Super", async ({
  page,
}) => {
  test.setTimeout(180000);
  const c = await start(page),
    errors = [],
    report = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const enemy of ["samurai", "dio", "goku"]) {
    await page.selectOption("#opponent", enemy);
    for (const mirror of [false, true]) {
      if (Number(await c.getAttribute("data-facing")) !== (mirror ? -1 : 1))
        await page.locator("#flip").click();
      for (const family of ["ki", "kamehameha", "teleport"])
        for (const strength of ["light", "medium", "heavy"]) {
          const scene = family + "_" + strength;
          await page.selectOption("#scenario", scene);
          await page.locator("#execute").click();
          const seen = new Set();
          for (let i = 0; i < 5; i++) {
            await page.clock.runFor(400);
            seen.add(await c.getAttribute("data-move"));
          }
          const data = await c.evaluate((n) => ({ ...n.dataset }));
          expect(data.moves).toContain(scene);
          expect(data.capture).toBe("none");
          expect(data.roadPhase).toBe("none");
          const expected =
            family === "ki"
              ? strength === "medium"
                ? 2
                : 1
              : family === "kamehameha"
                ? { light: 2, medium: 4, heavy: 6 }[strength]
                : 0;
          expect(Number(data.hitCount), `${enemy}/${mirror}/${scene}`).toBe(
            expected,
          );
          expect(Number(data.meter)).toBeGreaterThanOrEqual(0);
          expect(data.kiProjectiles).toBe("0");
          expect(data.beams).toBe("0");
          report.push({ enemy, mirror, scene, ...data });
        }
    }
  }
  expect(errors).toEqual([]);
  expect(await page.locator("#error").textContent()).toBe("");
  fs.writeFileSync(
    qa + "/variants.json",
    JSON.stringify({ report, errors }, null, 2),
  );
});
test("the real keyboard accepts mirrored cardinal/diagonal motions, strict double-down and no held-key repeats", async ({
  page,
}) => {
  test.setTimeout(120000);
  const c = await start(page),
    report = [];
  for (const mirror of [false, true])
    for (const family of ["ki", "kamehameha", "teleport"])
      for (const strength of ["light", "medium", "heavy"]) {
        await page.selectOption("#scenario", "ki_light");
        if (Number(await c.getAttribute("data-facing")) !== (mirror ? -1 : 1))
          await page.locator("#flip").click();
        await page.selectOption("#mode", "live");
        await c.focus();
        await page.keyboard.down("s");
        await page.clock.runFor(34);
        await page.keyboard.up("s");
        if (family === "teleport") {
          await page.clock.runFor(34);
          await page.keyboard.down("s");
        } else {
          const key = (family === "ki") !== mirror ? "d" : "a";
          await page.keyboard.down(key);
        }
        const button = { light: "j", medium: "k", heavy: "l" }[strength];
        await page.keyboard.down(button);
        await page.clock.runFor(34);
        await page.keyboard.up(button);
        await page.keyboard.up("s");
        await page.keyboard.up("a");
        await page.keyboard.up("d");
        await expect(c).toHaveAttribute("data-move", family + "_" + strength);
        report.push({
          mirror,
          family,
          strength,
          ...(await c.evaluate((n) => ({ ...n.dataset }))),
        });
        await page.clock.runFor(2100);
        await expect(c).toHaveAttribute("data-move", "");
      }
  // A real diagonal quarter circle works too.
  await page.selectOption("#scenario", "ki_light");
  await page.selectOption("#mode", "live");
  await c.focus();
  const front = Number(await c.getAttribute("data-facing")) === 1 ? "d" : "a";
  await page.keyboard.down("s");
  await page.clock.runFor(34);
  await page.keyboard.down(front);
  await page.clock.runFor(34);
  await page.keyboard.up("s");
  await page.keyboard.press("j");
  await page.clock.runFor(34);
  await page.keyboard.up(front);
  await expect(c).toHaveAttribute("data-move", "ki_light");
  await page.clock.runFor(2100);
  await page.keyboard.down("s");
  await page.clock.runFor(100);
  await page.keyboard.down("l");
  await page.clock.runFor(50);
  await expect(c).toHaveAttribute("data-move", "crouch_heavy");
  await page.clock.runFor(1000);
  await expect(c).toHaveAttribute("data-move", "");
  await page.keyboard.up("s");
  await page.keyboard.up("l");
  fs.writeFileSync(qa + "/keyboard.json", JSON.stringify(report, null, 2));
});
test("normal cancels, blocking, interrupted preparation, air teleport and wall destinations run in the renderer", async ({
  page,
}) => {
  test.setTimeout(120000);
  const c = await start(page),
    report = [];
  for (const scene of [
    "lightMediumKi",
    "mediumHeavyBeam",
    "crouchKi",
    "blockKi",
    "blockBeam",
    "interrupt",
    "teleport_air",
    "wallTeleport",
  ]) {
    await page.selectOption("#scenario", scene);
    await page.locator("#execute").click();
    let invisible = false,
      minY = 580;
    const phases = new Set();
    for (let i = 0; i < 65; i++) {
      await page.clock.runFor(1000 / 30 + 0.001);
      invisible ||= (await c.getAttribute("data-invisible")) === "true";
      minY = Math.min(minY, Number(await c.getAttribute("data-root-y")));
      phases.add(await c.getAttribute("data-phase"));
      if (i % 15 === 0) await save(c, `${qa}/${scene}-${i}.png`);
    }
    const d = await c.evaluate((n) => ({ ...n.dataset }));
    if (scene === "lightMediumKi") expect(Number(d.hitCount)).toBe(3);
    if (scene === "mediumHeavyBeam") expect(Number(d.hitCount)).toBe(4);
    if (scene === "crouchKi") expect(Number(d.hitCount)).toBe(2);
    if (scene.startsWith("block"))
      expect(Number(d.blockedHits)).toBeGreaterThan(0);
    if (scene === "interrupt") {
      expect(Number(d.hitCount)).toBe(0);
      expect(phases.has("hitstun")).toBe(true);
    }
    if (scene === "teleport_air") {
      expect(invisible).toBe(true);
      expect(minY).toBeLessThan(450);
    }
    expect(Number(d.rootX)).toBeGreaterThanOrEqual(40);
    expect(Number(d.rootX)).toBeLessThanOrEqual(1240);
    expect(d.beams).toBe("0");
    report.push({ scene, invisible, minY, phases: [...phases], ...d });
  }
  fs.writeFileSync(qa + "/systems.json", JSON.stringify(report, null, 2));
});
test("all special body drawings support slow playback, exact stepping and pivots without bad crops", async ({
  page,
}) => {
  test.setTimeout(120000);
  const c = await start(page),
    m = JSON.parse(
      fs.readFileSync("public/sprites/goku/specials/manifest.json", "utf8"),
    );
  fs.mkdirSync(qa + "/frames", { recursive: true });
  let count = 0;
  for (const [key, v] of Object.entries(m.clips)) {
    await page.selectOption("#animation", key);
    await page.locator("#pause").click();
    for (let i = 0; i < v.count; i++) {
      await page
        .getByRole("button", { name: `Quadro ${i + 1}`, exact: true })
        .click();
      await expect(c).toHaveAttribute("data-animation", key);
      await expect(c).toHaveAttribute("data-frame", String(i));
      await save(c, `${qa}/frames/${key}-${i}.png`);
      count++;
    }
  }
  await page.selectOption("#speed", "0.25");
  await page.selectOption("#animation", "kamehameha_heavy");
  await page.clock.runFor(600);
  expect(Number(await c.getAttribute("data-animation-tick"))).toBeLessThan(12);
  await page.locator("#pause").click();
  await page.locator("#next").click();
  await page.locator("#bounds").check();
  await page.selectOption("#zoom", "3");
  await page.locator("#flip").click();
  expect(await page.locator("#error").textContent()).toBe("");
  fs.writeFileSync(
    qa + "/inspection.json",
    JSON.stringify({
      clips: 10,
      cells: count,
      pause: true,
      stepping: true,
      slowing: true,
    }),
  );
});
test("records actual Ki, beam and teleport scenarios for the real gameplay preview", async ({
  page,
}) => {
  test.setTimeout(120000);
  const c = await start(page),
    folder = qa + "/recording",
    trace = [];
  fs.mkdirSync(folder, { recursive: true });
  await page.locator("#boxes").uncheck();
  await page.locator("#guides").uncheck();
  let n = 0;
  for (const scene of [
    "ki_light",
    "ki_medium",
    "ki_heavy",
    "kamehameha_light",
    "kamehameha_medium",
    "kamehameha_heavy",
    "teleport_light",
    "teleport_medium",
    "teleport_heavy",
    "teleport_air",
    "lightMediumKi",
    "mediumHeavyBeam",
    "blockBeam",
    "interrupt",
  ]) {
    await page.selectOption("#scenario", scene);
    await page.locator("#execute").click();
    for (let i = 0; i < 120; i += 3) {
      await page.clock.runFor(50);
      await save(c, `${folder}/${String(n++).padStart(4, "0")}.png`);
      trace.push({ scene, ...(await c.evaluate((n) => ({ ...n.dataset }))) });
    }
  }
  fs.writeFileSync(qa + "/trace.json", JSON.stringify(trace, null, 2));
  expect(await page.locator("#error").textContent()).toBe("");
});
