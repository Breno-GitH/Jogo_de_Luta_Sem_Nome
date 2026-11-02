import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "art/dio/qa/stand-only";
fs.mkdirSync(qa, { recursive: true });
const damage = {
  stand_light: 42,
  stand_medium: 72,
  stand_heavy: 116,
  crouch_light: 38,
  crouch_medium: 64,
  crouch_heavy: 88,
  air_light: 38,
  air_medium: 66,
  air_heavy: 108,
};
async function start(page, freeze = false) {
  const epoch = new Date("2026-10-30T12:00:00Z");
  await page.clock.install(freeze ? { time: epoch } : {});
  if (freeze) await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/dio-combat.html");
  const c = page.locator("#arena");
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

test("nine Stand-only normals hit in both directions against Samurai and Dio", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await start(page);
  const results = [];
  for (const enemy of ["samurai", "dio"])
    for (const mirror of [false, true]) {
      await page.selectOption("#opponent", enemy);
      await page.locator("#mirror").setChecked(mirror);
      for (const [name, value] of Object.entries(damage)) {
        await page.selectOption("#scenario", name);
        await page.locator("#gap").fill("65");
        await page.locator("#run").click();
        await page.clock.runFor(1800);
        await expect(c).toHaveAttribute("data-done", "true");
        await expect(c).toHaveAttribute(
          "data-hits",
          name === "air_medium" ? "2" : "1",
        );
        await expect(c).toHaveAttribute("data-damage", String(value));
        await expect(c).toHaveAttribute("data-stand-mode", "follow");
        await expect(c).toHaveAttribute("data-stand-boxes", "0");
        results.push({ enemy, mirror, name, damage: value });
      }
    }
  fs.writeFileSync(
    `${qa}/browser-attacks.json`,
    JSON.stringify(results, null, 2),
  );
  expect(errors).toEqual([]);
});

test("all four combos keep the Stand offensive until the final recovery", async ({
  page,
}) => {
  test.setTimeout(90000);
  const c = await start(page);
  const results = [];
  for (const enemy of ["samurai", "dio"])
    for (const [name, hits, actions] of [
      ["groundCombo", 3, 3],
      ["crouchCombo", 3, 3],
      ["airChain", 4, 3],
      ["airCombo", 5, 5],
    ]) {
      await page.selectOption("#opponent", enemy);
      await page.selectOption("#scenario", name);
      await page.locator("#run").click();
      const states = [];
      for (let i = 0; i < 200; i++) {
        await page.clock.runFor(17);
        const s = await c.evaluate((n) => ({ ...n.dataset }));
        states.push(s);
        if (s.standMode === "return") expect(Number(s.stage)).toBe(actions);
        if (s.done === "true") break;
      }
      await expect(c).toHaveAttribute("data-max-combo", String(hits));
      await expect(c).toHaveAttribute("data-hits", String(hits));
      await expect(c).toHaveAttribute("data-stand-mode", "follow");
      expect(states.some((s) => s.standClip.startsWith("bridge_"))).toBe(true);
      results.push({ enemy, name, hits, states });
    }
  fs.writeFileSync(
    `${qa}/browser-combos.json`,
    JSON.stringify(results, null, 2),
  );
});

test("pause, drawing stepping, slow playback, zoom, replay and recovery turning work", async ({
  page,
}) => {
  const c = await start(page);
  await page.selectOption("#zoom", "2");
  await page.selectOption("#speed", "0.25");
  await page.selectOption("#scenario", "stand_heavy");
  await page.locator("#run").click();
  await page.clock.runFor(1000);
  await page.locator("#pause").click();
  const before = await c.getAttribute("data-stand-frame");
  await page.locator("#next-frame").click();
  expect(await c.getAttribute("data-stand-frame")).not.toBe(before);
  await save(c, `${qa}/heavy-debug.png`);
  await page.locator("#pause").click();
  await page.clock.runFor(600);
  await page.locator("#swap-side").click();
  await page.selectOption("#speed", "1");
  await page.clock.runFor(4000);
  await expect(c).toHaveAttribute("data-stand-mode", "follow");
  await expect(c).toHaveAttribute("data-stand-boxes", "0");
  const x = Number(await c.getAttribute("data-player-x")),
    standX = Number(await c.getAttribute("data-stand-x"));
  expect(Math.abs(standX - x - 30)).toBeLessThan(1);
  await page.locator("#timeline").fill("5");
  await expect(c).toHaveAttribute("data-mode", "replay");
  await page.locator("#pause").click();
  await page.clock.runFor(300);
  expect(Number(await c.getAttribute("data-replay-cursor"))).toBeGreaterThan(5);
  await expect(page.locator("#error")).toBeEmpty();
});

test("damage, block and whiff remove pending Stand hitboxes and return safely", async ({
  page,
}) => {
  const c = await start(page);
  for (const [name, hits] of [
    ["interrupt", 0],
    ["whiff", 0],
  ]) {
    await page.selectOption("#scenario", name);
    await page.locator("#run").click();
    await page.clock.runFor(5500);
    await expect(c).toHaveAttribute("data-hits", String(hits));
    await expect(c).toHaveAttribute("data-stand-mode", "follow");
    await expect(c).toHaveAttribute("data-stand-boxes", "0");
  }
  await page.selectOption("#scenario", "crouch_heavy");
  await page.locator("#gap").fill("65");
  await page.locator("#reset").click();
  await page.selectOption("#dummy", "guard");
  await c.focus();
  await page.keyboard.down("s");
  await page.keyboard.press("l");
  await page.keyboard.up("s");
  await page.clock.runFor(3000);
  await expect(c).toHaveAttribute("data-target-health", "1000");
  await expect(c).toHaveAttribute("data-stand-boxes", "0");
});

test("all World actions and Dio command drawings can be inspected and downloaded", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.clock.install();
  await page.goto("/art/dio.html");
  const c = page.locator("#preview");
  await expect(c).toHaveAttribute("data-loaded", "true");
  for (const [entity, file] of [
    ["dio", "commands.json"],
    ["the-world", "stand-actions.json"],
  ]) {
    const clips = JSON.parse(
      fs.readFileSync(`public/sprites/${entity}/${file}`, "utf8"),
    ).clips;
    await page.selectOption("#entity", entity);
    for (const [name, clip] of Object.entries(clips)) {
      await page.selectOption("#animation", name);
      const frames = [];
      for (let i = 0; i < clip.count; i++) {
        await page
          .getByRole("button", { name: `Quadro ${i + 1}`, exact: true })
          .click();
        await expect(c).toHaveAttribute("data-frame", String(i));
        frames.push(await c.evaluate((n) => n.toDataURL()));
      }
      expect(new Set(frames).size, name).toBe(clip.count);
      await expect(page.locator("#download")).toHaveAttribute(
        "href",
        new RegExp(`${entity}/${name}\\.png$`),
      );
      await save(c, `${qa}/${entity}-${name}.png`);
    }
  }
  await expect(page.locator("#error")).toBeEmpty();
});

test("Dio versus Dio is selectable and playable in main training", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.locator("#training").click();
  await page.getByRole("radio", { name: "Selecionar Dio Brando" }).check();
  await page.selectOption("#opponent-character", "dio");
  await page.locator("#fight").click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "fight");
  const c = page.locator("canvas");
  await page.keyboard.down("d");
  for (let i = 0; i < 60; i++) {
    await page.clock.runFor(100);
    const distance = await c.evaluate(
      (n) => Number(n.dataset.targetX) - Number(n.dataset.playerX),
    );
    if (distance < 65) break;
  }
  await page.keyboard.up("d");
  await page.clock.runFor(50);
  await page.keyboard.press("j");
  await page.clock.runFor(120);
  await expect(c).toHaveAttribute("data-move", "stand_light");
  await page.clock.runFor(1000);
  expect(
    Number(await page.locator("#total-damage").textContent()),
  ).toBeGreaterThan(0);
  await page.locator("#boxes").click();
  await save(c, `${qa}/main-dio-vs-dio.png`);
});

test("records a real Stand-only ground combo for the release preview", async ({
  page,
}) => {
  test.setTimeout(90000);
  // Freeze before loading: every capture advances precisely one game tick.
  const c = await start(page, true);
  await page.selectOption("#zoom", "2");
  await page.locator("#boxes").uncheck();
  await page.selectOption("#scenario", "groundCombo");
  await page.locator("#run").click();
  await page.locator("#pause").click();
  const out = `${qa}/combo-recording`;
  fs.mkdirSync(out, { recursive: true });
  for (const file of fs.readdirSync(out))
    if (/^\d{3}\.png$/.test(file)) fs.unlinkSync(`${out}/${file}`);
  const trace = [];
  for (let i = 0; i < 120; i++) {
    await page.locator("#step").click();
    await save(c, `${out}/${String(i).padStart(3, "0")}.png`);
    trace.push(await c.evaluate((n) => ({ ...n.dataset })));
    if (trace.at(-1).done === "true") break;
  }
  fs.writeFileSync(`${qa}/combo-trace.json`, JSON.stringify(trace, null, 2));
  expect(trace[0].phase).toBe("startup");
  await expect(c).toHaveAttribute("data-max-combo", "3");
});
