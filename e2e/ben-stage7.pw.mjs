import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("Gravattack and Echo Echo fight Samurai through the real Omnitrix", async ({ page }, info) => {
  test.setTimeout(150000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(process.env.BEN_STAGE7_URL ?? "./", { waitUntil: "domcontentloaded" });
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
  const value = key => canvas.evaluate((c, k) => c.dataset[k], key);
  const idle = () => expect(canvas).toHaveAttribute("data-physics-state", "idle");
  const keyFor = async forward => (Number(await value("omnitrixFacing")) > 0) === forward ? "d" : "a";
  const health = async () => Number(await value("targetHealth"));
  const distance = () => canvas.evaluate(c => Math.abs(+c.dataset.rivalX - +c.dataset.rootX));
  const initialHealth = await health();

  async function select(form) {
    await idle();
    const before = await value("omnitrixForm");
    for (let i = 0; i < 11 && (await value("omnitrixSelection")) !== form; i++) {
      const prior = await value("omnitrixSelection");
      await page.keyboard.press("l", { delay: 40 });
      await expect(canvas).not.toHaveAttribute("data-omnitrix-selection", prior);
      await expect(canvas).toHaveAttribute("data-omnitrix-form", before);
    }
    await expect(canvas).toHaveAttribute("data-omnitrix-selection", form);
    await page.keyboard.down("l");
    try {
      await expect(canvas).toHaveAttribute("data-omnitrix-form", form);
    } finally { await page.keyboard.up("l"); }
    await expect(canvas).toHaveAttribute("data-omnitrix-sheet", `ben/${form}/stage7.png`);
  }

  async function spacing(min, max) {
    await idle();
    const current = await distance();
    if (min <= current && current <= max) return;
    const forward = current > max, key = await keyFor(forward);
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(({ forward, limit }) => {
        const c = document.querySelector("canvas").dataset;
        const gap = Math.abs(+c.rivalX - +c.rootX);
        return forward ? gap <= limit : gap >= limit;
      }, { forward, limit: forward ? max : min }, { timeout: 6000 });
    } finally { await page.keyboard.up(key); }
    await idle();
  }

  async function motion(family, button) {
    const key = family === 2 ? "s" : await keyFor(family === 0);
    await page.keyboard.press("s", { delay: 47 });
    if (family === 2) await page.waitForTimeout(36);
    await page.keyboard.down(key);
    try { await page.keyboard.press(button, { delay: 35 }); }
    finally { await page.keyboard.up(key); }
  }

  async function record(name, play) {
    await canvas.evaluate(c => {
      const frames = [];
      window.stage7Frames = frames;
      const output = document.createElement("canvas");
      output.width = 960;
      output.height = 540;
      const ctx = output.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      let previous = -Infinity;
      const sample = now => {
        if (window.stage7Frames !== frames) return;
        if (now - previous >= 33) {
          ctx.drawImage(c, 0, 0, 960, 540);
          const d = c.dataset;
          frames.push({ image: output.toDataURL("image/png").split(",")[1],
            clip: d.animation, move: d.move, tick: Number(d.benMoveTick), x: Number(d.rootX),
            y: Number(d.rootY), target: Number(d.rivalX), health: Number(d.targetHealth),
            clones: Number(d.echoClones), well: d.gravityWell === "true", objects: d.benObjects,
            combo: Number(d.combo), form: d.omnitrixForm });
          previous = now;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await play();
    const frames = await page.evaluate(() => {
      const frames = window.stage7Frames;
      window.stage7Frames = null;
      return frames;
    });
    const folder = info.outputPath(name);
    await mkdir(folder, { recursive: true });
    await Promise.all(frames.map((frame, i) => writeFile(folder + "/" + String(i).padStart(3, "0") + ".png", Buffer.from(frame.image, "base64"))));
    const states = frames.map(({ image, ...state }) => state);
    await writeFile(folder + "/frames.json", JSON.stringify(states));
    return states;
  }

  async function walk(name) {
    await record(name + "-idle-walk", async () => {
      await page.waitForTimeout(270);
      for (const forward of [true, false]) {
        const key = await keyFor(forward);
        await page.keyboard.down(key);
        await page.waitForTimeout(240);
        await page.keyboard.up(key);
        await idle();
      }
    });
  }
  async function attack(id, family, button, min, max, damage = true) {
    await spacing(min, max);
    const before = await health();
    const frames = await record(id, async () => {
      if (family === null) await page.keyboard.press(button, { delay: 42 });
      else await motion(family, button);
      await idle();
      await page.waitForTimeout(150);
    });
    expect(frames.some(frame => frame.move === id || frame.clip === id), id).toBe(true);
    expect(await health(), id)[damage ? "toBeLessThan" : "toBe"](before);
    return frames;
  }
  async function refill() {
    await page.click("#refill-health");
    await canvas.focus();
    await expect.poll(health).toBe(initialHealth);
  }

  await select("gravattack");
  const jump = await record("gravattack-salto", async () => {
    await page.keyboard.press("w", { delay: 48 });
    await expect(canvas).toHaveAttribute("data-physics-state", "air");
    await idle();
  });
  expect(jump.some(frame => frame.clip === "jumpRise")).toBe(true);
  expect(jump.some(frame => frame.clip === "jumpFall")).toBe(true);
  await walk("gravattack");
  await attack("stand_light", null, "j", 85, 95);
  await attack("gravityPull_light", 0, "j", 137, 152);
  await attack("gravityPull_medium", 0, "k", 133, 153);
  await attack("gravityRepel_light", 1, "j", 85, 103);
  await attack("gravityRepel_medium", 1, "k", 85, 105);
  const well = await attack("gravityDomain_light", 2, "j", 132, 151, false);
  expect(well.some(frame => frame.well)).toBe(true);
  await attack("gravityDomain_medium", 2, "k", 108, 127);
  await refill();

  await record("gravattack-eco-eco", () => select("echoEcho"));
  await walk("eco-eco");
  await attack("sonicCry_light", 0, "j", 100, 125);
  await attack("sonicCry_medium", 0, "k", 132, 150);
  const one = await attack("echoSplit_light", 1, "j", 140, 159, false);
  expect(one.some(frame => frame.clones === 1)).toBe(true);
  await attack("echoHarmony_light", 2, "j", 78, 100);
  await expect(canvas).toHaveAttribute("data-echo-clones", "0", { timeout: 6500 });
  const two = await attack("echoSplit_medium", 1, "k", 146, 163, false);
  expect(two.some(frame => frame.clones === 2)).toBe(true);
  const chorus = await attack("echoHarmony_medium", 2, "k", 127, 155);
  expect(chorus.some(frame => frame.objects?.includes("echoCopyWave"))).toBe(true);
  await select("gravattack");
  await expect(canvas).toHaveAttribute("data-echo-clones", "0");
  expect(errors).toEqual([]);
});

