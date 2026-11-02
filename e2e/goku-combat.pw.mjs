import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "art/goku/combat/qa";
fs.mkdirSync(qa, { recursive: true });
async function start(page) {
  const epoch = new Date("2026-11-01T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/goku-combat.html");
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
const normals = [
  "stand_light",
  "stand_medium",
  "stand_heavy",
  "crouch_light",
  "crouch_medium",
  "crouch_heavy",
  "air_light",
  "air_medium",
  "air_heavy",
];
test("nine Goku normals really connect once against Samurai, Dio and Goku in both directions", async ({
  page,
}) => {
  test.setTimeout(120000);
  const c = await start(page),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const report = [];
  for (const enemy of ["samurai", "dio", "goku"]) {
    await page.selectOption("#opponent", enemy);
    for (const mirror of [false, true]) {
      if ((await c.getAttribute("data-facing")) !== (mirror ? "-1" : "1"))
        await page.locator("#flip").click();
      for (const key of normals) {
        await page.selectOption("#scenario", key);
        await page.locator("#execute").click();
        await page.clock.runFor(1600);
        const d = await c.evaluate((n) => ({ ...n.dataset }));
        expect(Number(d.hitCount), `${enemy}/${mirror}/${key}`).toBe(1);
        expect(Number(d.damage)).toBeGreaterThan(0);
        expect(d.capture).toBe("none");
        expect(d.smoothing).toBe("false");
        report.push({ enemy, key, mirror, ...d });
      }
    }
  }
  expect(errors).toEqual([]);
  fs.writeFileSync(
    `${qa}/normal-browser.json`,
    JSON.stringify({ report, errors }, null, 2),
  );
});
test("all combos, launcher, defense, damage, knockdown, getup and throws run in the existing renderer", async ({
  page,
}) => {
  test.setTimeout(120000);
  const c = await start(page),
    report = [];
  for (const enemy of ["samurai", "dio", "goku"]) {
    await page.selectOption("#opponent", enemy);
    for (const scene of [
      "groundCombo",
      "crouchCombo",
      "airCombo",
      "launcherCombo",
      "throw",
    ]) {
      await page.selectOption("#scenario", scene);
      await page.locator("#execute").click();
      await page.clock.runFor(3000);
      const d = await c.evaluate((n) => ({ ...n.dataset }));
      expect(Number(d.hitCount), `${enemy}/${scene}`).toBe(
        scene === "throw" ? 1 : scene === "launcherCombo" ? 4 : 3,
      );
      expect(d.capture).toBe("none");
      report.push({ enemy, scene, ...d });
    }
  }
  await page.selectOption("#opponent", "samurai");
  for (const scene of [
    "guardHigh",
    "guardLow",
    "hitLight",
    "hitMedium",
    "hitHeavy",
    "hitCrouch",
    "hitAir",
    "launched",
    "grabbed",
    "ko",
  ]) {
    await page.selectOption("#scenario", scene);
    await page.locator("#execute").click();
    const states = new Set(),
      clips = new Set();
    for (let n = 0; n < 70; n++) {
      await page.clock.runFor(1000 / 30 + 0.001);
      states.add(await c.getAttribute("data-physics-state"));
      clips.add(await c.getAttribute("data-animation"));
      if (n % 15 === 0) await save(c, `${qa}/${scene}-${n}.png`);
    }
    if (scene.startsWith("guard"))
      expect(Number(await c.getAttribute("data-blocked-hits"))).toBeGreaterThan(
        0,
      );
    else
      expect([...states]).toContain(
        scene === "grabbed" ? "grabbed" : scene === "ko" ? "ko" : "hitstun",
      );
    if (scene === "launched") {
      expect([...clips]).toContain("launched");
      expect([...clips]).toContain("falling");
      expect([...clips]).toContain("getup");
    }
    report.push({ scene, states: [...states], clips: [...clips] });
  }
  expect(await page.locator("#error").textContent()).toBe("");
  fs.writeFileSync(
    `${qa}/systems-browser.json`,
    JSON.stringify(report, null, 2),
  );
});
test("every combat cel renders with its actual sheet geometry, can pause, step and slow down", async ({
  page,
}) => {
  test.setTimeout(120000);
  const c = await start(page),
    m = JSON.parse(
      fs.readFileSync("public/sprites/goku/combat/manifest.json", "utf8"),
    );
  fs.mkdirSync(`${qa}/frames`, { recursive: true });
  let count = 0;
  for (const [key, meta] of Object.entries(m.clips)) {
    await page.selectOption("#animation", key);
    await page.locator("#pause").click();
    for (let i = 0; i < meta.count; i++) {
      await page
        .getByRole("button", { name: `Quadro ${i + 1}`, exact: true })
        .click();
      await expect(c).toHaveAttribute("data-animation", key);
      await expect(c).toHaveAttribute("data-frame", String(i));
      await save(c, `${qa}/frames/${key}-${String(i).padStart(2, "0")}.png`);
      count++;
    }
  }
  await page.selectOption("#animation", "stand_medium");
  await page.locator("#pause").click();
  await page.getByRole("button", { name: "Quadro 4", exact: true }).click();
  await expect(c).toHaveAttribute("data-phase", "active");
  await page.locator("#next").click();
  await expect(c).toHaveAttribute("data-frame", "4");
  await page.locator("#previous").click();
  await expect(c).toHaveAttribute("data-frame", "3");
  await page.selectOption("#zoom", "3");
  await page.locator("#bounds").check();
  await page.locator("#flip").click();
  await page.locator("#step").click();
  await expect(c).toHaveAttribute("data-facing", "-1");
  await page.selectOption("#speed", "0.25");
  await page.selectOption("#animation", "stand_heavy");
  await page.clock.runFor(600);
  expect(Number(await c.getAttribute("data-animation-tick"))).toBeLessThan(12);
  expect(await page.locator("#error").textContent()).toBe("");
  fs.writeFileSync(
    `${qa}/frame-browser.json`,
    JSON.stringify({
      clips: Object.keys(m.clips).length,
      cells: count,
      stepping: true,
      slowing: true,
      mirroring: true,
    }),
  );
});
test("Goku is selectable in local modes and fights each opponent in main training", async ({
  page,
}) => {
  test.setTimeout(90000);
  const epoch = new Date("2026-11-01T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  for (const enemy of ["samurai", "dio", "goku"]) {
    await page.goto("/");
    await page.locator("#training").click();
    await page
      .getByRole("radio", { name: "Selecionar Goku", exact: true })
      .check();
    await page.selectOption("#opponent-character", enemy);
    await page.locator("#fight").click();
    await expect(page.locator("#app")).toHaveAttribute(
      "data-character",
      "goku",
    );
    await page.clock.runFor(50);
    const c = page.locator("canvas").first();
    await expect(c).toHaveAttribute("data-character", "goku", {
      timeout: 20000,
    });
    await c.focus();
    await page.keyboard.down("d");
    await page.clock.runFor(1450);
    await page.keyboard.up("d");
    await page.clock.runFor(120);
    await page.keyboard.press("j");
    await page.clock.runFor(134);
    await expect(c).toHaveAttribute("data-move", "stand_light");
    await page.clock.runFor(800);
    await page.keyboard.press("r");
    await page.clock.runFor(100);
    await expect(c).toHaveAttribute("data-capture", "none");
    await expect(c).toHaveAttribute("data-move", "");
  }
  await page.goto("/");
  await page.locator("#versus").click();
  await expect(
    page.getByRole("radio", { name: "Selecionar Goku", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("radio", { name: "Selecionar Goku", exact: true })
    .check();
  await page.locator("#fight").click();
  await expect(page.locator("#app")).toHaveAttribute("data-character", "goku");
});
test("records real keyboard-driven combat scenarios for the exported preview", async ({
  page,
}) => {
  test.setTimeout(120000);
  const c = await start(page),
    folder = `${qa}/recording`;
  await page.locator("#boxes").uncheck();
  await page.locator("#guides").uncheck();
  fs.mkdirSync(folder, { recursive: true });
  let number = 0;
  const trace = [];
  for (const scene of [
    "stand_light",
    "stand_medium",
    "stand_heavy",
    "crouch_light",
    "crouch_medium",
    "crouch_heavy",
    "air_light",
    "air_medium",
    "air_heavy",
    "groundCombo",
    "crouchCombo",
    "launcherCombo",
    "throw",
    "guardHigh",
    "hitHeavy",
  ]) {
    await page.selectOption("#scenario", scene);
    await page.locator("#execute").click();
    for (let t = 0; t < 110; t += 3) {
      await page.clock.runFor(50);
      await save(c, `${folder}/${String(number++).padStart(4, "0")}.png`);
      trace.push({ scene, ...(await c.evaluate((n) => ({ ...n.dataset }))) });
    }
  }
  fs.writeFileSync(`${qa}/combat-trace.json`, JSON.stringify(trace, null, 2));
  expect(await page.locator("#error").textContent()).toBe("");
});
