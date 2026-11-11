import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("Ben's redesigned specials in the main arena against Samurai", async ({ page }, info) => {
  test.setTimeout(210000);
  const errors = [];
  const handsOnly = process.env.BEN_REFORM_HANDS_ONLY === "1";
  const bodyOnly = process.env.BEN_REFORM_BODY_ONLY === "1";
  page.on("pageerror", error => errors.push(error.message));
  const handAtlas = handsOnly ? page.waitForResponse(res =>
    res.url().endsWith("/sprites/ben/ghostfreak-hands-reform.png") && res.ok(),
  ) : undefined;
  await page.goto(process.env.BEN_REFORM_URL ?? "./");
  await page.click("#training");
  await page.check('input[name="character"][value="ben"]');
  await page.click("#confirm-character");
  await page.check('input[name="opponent"][value="samurai"]');
  await page.click("#confirm-character");
  await page.click("#fight");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-omnitrix-form", "human", { timeout: 45000 });
  await page.locator("#infinite-health").uncheck();

  const idle = () => expect(canvas).toHaveAttribute("data-physics-state", "idle");
  const data = name => canvas.evaluate((c, key) => c.dataset[key], name);
  const health = async () => Number(await data("p2Health"));
  const gap = () => canvas.evaluate(c => Math.abs(+c.dataset.rivalX - +c.dataset.rootX));
  async function distance(min, max) {
    let current = await gap();
    if (current < min || current > max) {
      const face = Number(await data("omnitrixFacing"));
      const forward = face > 0 ? "d" : "a";
      const back = face > 0 ? "a" : "d";
      const key = current < min ? back : forward;
      const closer = current > max;
      await page.keyboard.down(key);
      try {
        if (closer) await expect.poll(gap).toBeLessThanOrEqual(max);
        else await expect.poll(gap).toBeGreaterThanOrEqual(min);
      } finally { await page.keyboard.up(key); }
      await idle();
    }
  }
  async function choose(id) {
    await idle();
    for (let i = 0; i < 11 && (await data("omnitrixSelection")) !== id; i++) {
      const prior = await data("omnitrixSelection");
      await page.keyboard.press("l", { delay: 35 });
      await expect(canvas).not.toHaveAttribute("data-omnitrix-selection", prior);
    }
    await expect(canvas).toHaveAttribute("data-omnitrix-selection", id);
    await page.keyboard.down("l");
    await expect(canvas).toHaveAttribute("data-omnitrix-form", id);
    await page.keyboard.up("l");
    await idle();
  }
  async function motion(family, key) {
    const forward = Number(await data("omnitrixFacing")) > 0 ? "d" : "a";
    const back = forward === "a" ? "d" : "a";
    await page.keyboard.press("s", { delay: 52 });
    if (family === 2) {
      await page.waitForTimeout(52);
      await page.keyboard.down("s");
      await page.keyboard.press(key, { delay: 38 });
      await page.keyboard.up("s");
    } else {
      const button = family === 0 ? forward : back;
      await page.keyboard.down(button);
      await page.keyboard.press(key, { delay: 38 });
      await page.keyboard.up(button);
    }
  }

  const output = process.env.BEN_REFORM_PREVIEW ?? info.outputPath("arena");
  await mkdir(output, { recursive: true });
  async function take(name, action, duration = 1850) {
    await canvas.evaluate((c, ms) => {
      const mini = document.createElement("canvas");
      mini.width = 800;
      mini.height = 450;
      const ctx = mini.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      const start = performance.now();
      let previous = start - 55;
      window.benProof = [];
      function record(now) {
        if (now - previous > 48) {
          ctx.drawImage(c, 0, 0, mini.width, mini.height);
          window.benProof.push({ png: mini.toDataURL("image/png").split(",")[1],
            t: Math.round(now - start), move: c.dataset.move, tick: c.dataset.benMoveTick,
            sheet: c.dataset.omnitrixSheet, capture: c.dataset.benCapture, objects: c.dataset.benObjects });
          previous = now;
        }
        if (now < start + ms) requestAnimationFrame(record);
      }
      requestAnimationFrame(record);
    }, duration);
    await action();
    await page.waitForTimeout(duration);
    const frames = await page.evaluate(() => window.benProof);
    const folder = output + "/" + name;
    await mkdir(folder, { recursive: true });
    await Promise.all(frames.map((frame, i) =>
      writeFile(folder + "/" + String(i).padStart(3, "0") + ".png", Buffer.from(frame.png, "base64"))));
    await writeFile(folder + "/events.json", JSON.stringify(frames.map(({ png, ...state }) => state)));
    return frames;
  }

  async function special(name, family, key, damage = true, duration) {
    await idle();
    const before = await health();
    const frames = await take(name, async () => {
      await motion(family, key);
      await expect(canvas).toHaveAttribute("data-move", name);
    }, duration);
    await idle();
    if (damage) expect(await health(), name).toBeLessThan(before);
    return frames;
  }

  if (!handsOnly && !bodyOnly) {
    await choose("humungousaur");
    await distance(142, 169);
    await special("car_medium", 1, "k");
    await distance(98, 139);
    await special("car_light", 1, "j");
    await distance(180, 240);
    await special("colossal_medium", 0, "k", true, 2200);
  }

  if (!handsOnly) {
    await choose("feedback");
    if (bodyOnly) {
      await expect(canvas).toHaveAttribute("data-omnitrix-sheet", "ben/feedback/anatomia-v3.png");
      await distance(58, 74);
      for (const [suffix,key] of [["light","j"],["medium","k"]]) {
        for (const stance of ["stand","crouch","air"]) {
          await distance(58,74);
          await idle();
          const before = await health();
          if (stance === "air") {
            await page.keyboard.press("w");
            // Aim the short air normal at a standing opponent on the descent.
            await page.waitForFunction(height => {
              const c = document.querySelector("canvas");
              return c?.dataset.physicsState === "air" && Number(c.dataset.vy) > 0 && Number(c.dataset.rootY) > height;
            }, suffix === "light" ? 475 : 450);
          }
          if (stance === "crouch") await page.keyboard.down("s");
          try { await page.keyboard.press(key, { delay: 36 }); }
          finally { if (stance === "crouch") await page.keyboard.up("s"); }
          await expect(canvas).toHaveAttribute("data-animation", stance + "_" + suffix);
          await idle();
          expect(await health(), stance + "_" + suffix).toBeLessThan(before);
        }
      }
      await distance(53,67);
      const before = await health();
      await page.keyboard.press("u", { delay: 42 });
      await expect.poll(health).toBeLessThan(before);
      await idle();
      await page.click("#refill-health");
    }
    await distance(100, 125);
    await special("storm_medium", 0, "k");
    await distance(102, 125);
    const grip = await special("conductor_medium", 1, "k");
    expect(grip.some(frame => frame.capture === "conductor_medium")).toBe(true);
    await distance(128, 160);
    await special("discharge_light", 2, "j");
    await distance(158, 188);
    await special("discharge_medium", 2, "k");
  }

  if (!bodyOnly) {
  await choose("ghostfreak");
  await handAtlas;
  await page.click("#refill-health");
  if (!handsOnly) {
    await distance(115, 142);
    await special("ghostCross_medium", 0, "k");
    await distance(87, 105);
    await special("spectralArms_medium", 1, "k");
  }
  await distance(81, 101);
  const nightmare = await special("ghostPhase_medium", 2, "k", true, 2200);
  expect(nightmare.some(frame => frame.sheet.endsWith("/zs-skayr.png"))).toBe(true);
  await expect(canvas).toHaveAttribute("data-omnitrix-sheet", /stage6-locomotion/);

  await expect(canvas).toHaveAttribute("data-physics-state", "idle");
  await page.waitForTimeout(2100);
  await page.locator("#dummy").selectOption("crouchGuard");
  await page.locator("#dummy").evaluate(el => el.blur());
  await distance(76, 89);
  const guarded = await health();
  const noReveal = await take("nightmare-guard", () => motion(2, "j"));
  expect(noReveal.some(frame => frame.objects.includes("ghostPhase_light"))).toBe(true);
  expect(noReveal.every(frame => !frame.capture)).toBe(true);
  expect(await health()).toBe(guarded);
  await page.locator("#dummy").selectOption("idle");
  await page.locator("#dummy").evaluate(el => el.blur());
  await page.click("#reset-positions");
  await choose("ghostfreak");
  const spaced = await health();
  const evaded = await take("nightmare-evade", () => motion(2, "j"));
  expect(evaded.some(frame => frame.objects.includes("ghostPhase_light"))).toBe(true);
  expect(evaded.every(frame => !frame.capture)).toBe(true);
  expect(await health()).toBe(spaced);
  await idle();
  if (handsOnly) {
    expect(errors).toEqual([]);
    return;
  }
  }

  await choose("nrg");
  await distance(125, 153);
  await special("thermal_medium", 0, "k");
  const release = await take("nrg-release-flight", async () => {
    await motion(2, "j");
    await expect(canvas).toHaveAttribute("data-nrg-mode", "released");
    await idle();
    await page.keyboard.down("w");
    try {
      await expect(canvas).toHaveAttribute("data-ben-flight", "nrg");
      await expect.poll(async () => Number(await data("rootY"))).toBeLessThan(450);
    } finally { await page.keyboard.up("w"); }
    await motion(0, "k");
    await expect(canvas).toHaveAttribute("data-animation", "radiantShot_mediumAir");
  }, 2550);
  expect(release.some(frame => frame.sheet.includes("nrgReleased/stage6-calibrated"))).toBe(true);
  await idle();
  await page.keyboard.down("w");
  try { await expect(canvas).toHaveAttribute("data-ben-flight", "nrg"); }
  finally { await page.keyboard.up("w"); }
  const xBeforeReturn = Number(await data("rootX"));
  await take("nrg-reseal", async () => {
    await motion(2, "k");
    await expect(canvas).toHaveAttribute("data-nrg-mode", "contained", { timeout: 6500 });
  }, 2400);
  expect(Number(await data("rootX"))).toBeCloseTo(xBeforeReturn, 0);
  expect(errors).toEqual([]);
});

