import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("NRG contained uses the new armor attacks in the main arena", async ({ page }, info) => {
  test.setTimeout(150000);
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.NRG_URL ?? "./", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.click("#training");
  await page.getByRole("radio", { name: "Selecionar Ben Tennyson" }).check();
  await page.click("#confirm-character");
  await page.getByRole("radio", { name: "Selecionar Samurai" }).check();
  await page.click("#confirm-character");
  await page.click("#fight");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-omnitrix-form", "human", { timeout: 45000 });
  await page.locator("#infinite-health").uncheck();
  await canvas.focus();
  await expect(canvas).toHaveAttribute("data-match-phase", "fight");
  const data = key => canvas.evaluate((c, k) => c.dataset[k], key);
  const idle = () => expect(canvas).toHaveAttribute("data-physics-state", "idle");
  const facing = async () => Number(await data("omnitrixFacing"));
  const health = async () => Number(await data("targetHealth"));
  const gap = () => canvas.evaluate(c => Math.abs(+c.dataset.rivalX - +c.dataset.rootX));
  const keyFor = (sign, forward) => (sign > 0) === forward ? "d" : "a";

  for (let i = 0; i < 11 && (await data("omnitrixSelection")) !== "nrg"; i++) {
    const prior = await data("omnitrixSelection");
    await page.keyboard.press("l", { delay: 35 });
    await expect(canvas).not.toHaveAttribute("data-omnitrix-selection", prior);
  }
  await expect(canvas).toHaveAttribute("data-omnitrix-selection", "nrg");
  await page.keyboard.down("l");
  try { await expect(canvas).toHaveAttribute("data-nrg-mode", "contained"); }
  finally { await page.keyboard.up("l"); }
  await idle();

  async function distance(min, max) {
    await idle();
    const current = await gap();
    if (current >= min && current <= max) return;
    const closer = current > max;
    const key = keyFor(await facing(), closer);
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(({ limit, closer }) => {
        const c = document.querySelector("canvas");
        const distance = Math.abs(+c.dataset.rivalX - +c.dataset.rootX);
        return closer ? distance <= limit : distance >= limit;
      }, { limit: closer ? max : min, closer });
    } finally { await page.keyboard.up(key); }
    await idle();
  }
  async function motion(family, button, direction) {
    await page.keyboard.press("s", { delay: 46 });
    if (family === 2) await page.waitForTimeout(35);
    const key = family === 2 ? "s" : keyFor(direction, family === 0);
    await page.keyboard.down(key);
    try { await page.keyboard.press(button, { delay: 30 }); }
    finally { await page.keyboard.up(key); }
  }
  async function refill() {
    await page.click("#refill-health");
    await canvas.focus();
  }

  async function record(name, play) {
    await canvas.evaluate(c => {
      const frames = [];
      window.nrgFrames = frames;
      const output = document.createElement("canvas");
      output.width = 960;
      output.height = 540;
      const ctx = output.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      let previous = -Infinity;
      const sample = now => {
        if (window.nrgFrames !== frames) return;
        if (now - previous >= 26) {
          ctx.drawImage(c, 0, 0, output.width, output.height);
          frames.push({ image: output.toDataURL("image/png").split(",")[1],
            clip: c.dataset.animation, move: c.dataset.move, tick: +c.dataset.benMoveTick,
            x: +c.dataset.rootX, y: +c.dataset.rootY, rival: +c.dataset.rivalX, health: +c.dataset.targetHealth,
            combo: +c.dataset.combo, facing: +c.dataset.omnitrixFacing, mode: c.dataset.nrgMode,
            state: c.dataset.physicsState, sheet: c.dataset.omnitrixSheet });
          previous = now;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await play();
    const frames = await page.evaluate(() => {
      const recorded = window.nrgFrames;
      window.nrgFrames = null;
      return recorded;
    });
    const folder = info.outputPath(name);
    await mkdir(folder, { recursive: true });
    await Promise.all(frames.map((frame, i) =>
      writeFile(folder + "/" + String(i).padStart(3, "0") + ".png", Buffer.from(frame.image, "base64"))));
    const states = frames.map(({ image, ...state }) => state);
    await writeFile(folder + "/frames.json", JSON.stringify(states));
    return states;
  }

  await record("idle", () => page.waitForTimeout(450));
  for (const posture of ["stand", "crouch", "air"]) for (const [strength, key] of [["light", "j"], ["medium", "k"]]) {
    await distance(70, 83);
    const id = posture + "_" + strength;
    const before = await health();
    const frames = await record(id, async () => {
      if (posture === "air") {
        await page.keyboard.press("w");
        await page.waitForFunction(limit => {
          const c = document.querySelector("canvas");
          return c.dataset.physicsState === "air" && +c.dataset.vy > 0 && +c.dataset.rootY > limit;
        }, strength === "light" ? 510 : 435);
      }
      if (posture === "crouch") await page.keyboard.down("s");
      try { await page.keyboard.press(key, { delay: 32 }); }
      finally { if (posture === "crouch") await page.keyboard.up("s"); }
      await expect(canvas).toHaveAttribute("data-move", id);
      await idle();
      await page.waitForTimeout(120);
    });
    expect(frames.some(f => f.clip === id && f.sheet.includes("armadura-combate"))).toBe(true);
    expect(await health(), id).toBeLessThan(before);
  }
  await distance(70, 78);
  const beforeGrab = await health();
  const grab = await record("throw", async () => {
    await page.keyboard.press("u", { delay: 36 });
    await expect(canvas).toHaveAttribute("data-move", "throw");
    await idle();
    await page.waitForTimeout(120);
  });
  expect(grab.some(f => f.clip === "grabHold")).toBe(true);
  expect(await health()).toBeLessThan(beforeGrab);
  await refill();

  for (const [family, key, id, range] of [
    [1, "j", "armorImpact_light", [111, 129]],
    [1, "k", "armorImpact_medium", [71, 82]],
    [0, "j", "thermal_light", [126, 160]],
    [0, "k", "thermal_medium", [161, 203]],
    [2, "k", "armorCounter_medium", [97, 122]],
  ]) {
    await distance(...range);
    const before = await health(), sign = await facing();
    const frames = await record(id, async () => {
      await motion(family, key, sign);
      await expect(canvas).toHaveAttribute("data-move", id);
      await idle();
      await page.waitForTimeout(120);
    });
    const attempts = frames.filter(f => f.move === id);
    expect(attempts.length).toBeGreaterThan(1);
    if (id === "armorImpact_light")
      expect((attempts.at(-1).x - attempts[0].x) * sign).toBeGreaterThan(10);
    if (id === "armorCounter_medium") expect(await health()).toBe(before);
    else expect(await health(), id).toBeLessThan(before);
  }

  await distance(73, 80);
  await refill();
  const sign = await facing();
  const combo = await record("combo", async () => {
    const hits = count => page.waitForFunction(n => +document.querySelector("canvas").dataset.combo === n, count);
    await page.keyboard.press("j", { delay: 25 });
    await hits(1);
    await page.keyboard.press("k", { delay: 27 });
    await hits(2);
    await motion(1, "j", sign);
    await hits(3);
    await idle();
    await page.waitForTimeout(160);
  });
  expect(combo.some(f => f.move === "armorImpact_light" && f.combo === 3)).toBe(true);

  const release = await record("release", async () => {
    await motion(2, "j", await facing());
    await expect(canvas).toHaveAttribute("data-nrg-mode", "released");
    await idle();
    await page.waitForTimeout(180);
  });
  expect(release.some(f => f.move === "nrgUnseal_light")).toBe(true);
  expect(release.some(f => f.mode === "released" && f.sheet.includes("nrgReleased"))).toBe(true);
  const x = Number(await data("rootX"));
  const away = keyFor(await facing(), false);
  await page.keyboard.down(away);
  await page.keyboard.down("w");
  try { await expect(canvas).toHaveAttribute("data-ben-flight", "nrg"); await page.waitForTimeout(270); }
  finally { await page.keyboard.up("w"); await page.keyboard.up(away); }
  const near = Number(await data("rootX"));
  expect(Math.abs(near - x)).toBeGreaterThan(20);
  await motion(2, "k", await facing());
  await expect(canvas).toHaveAttribute("data-nrg-mode", "contained");
  expect(Math.abs(Number(await data("rootX")) - near)).toBeLessThan(42);
  expect(errors).toEqual([]);
});
