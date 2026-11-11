import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("Feedback walks and conducts captures in the main arena on either side", async ({ page }, info) => {
  test.setTimeout(140000);
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.FEEDBACK_URL ?? "./", { waitUntil: "domcontentloaded", timeout: 45000 });
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
  const clip = name => expect(canvas).toHaveAttribute("data-animation", name);
  const keys = async () => (await facing()) > 0 ? ["d", "a"] : ["a", "d"];

  for (const id of ["fourArms", "feedback"]) {
    await page.keyboard.press("l", { delay: 36 });
    await expect(canvas).toHaveAttribute("data-omnitrix-selection", id);
  }
  await page.keyboard.down("l");
  try { await expect(canvas).toHaveAttribute("data-omnitrix-form", "feedback"); }
  finally { await page.keyboard.up("l"); }
  await idle();

  async function distance(min, max) {
    await idle();
    const value = await gap(), [forward, back] = await keys();
    if (value >= min && value <= max) return;
    const closer = value > max;
    const key = closer ? forward : back;
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

  async function record(name, play) {
    await canvas.evaluate(c => {
      const frames = [];
      window.feedbackFrames = frames;
      const image = document.createElement("canvas");
      image.width = 960;
      image.height = 540;
      const ctx = image.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      let previous = -Infinity;
      const sample = now => {
        if (window.feedbackFrames !== frames) return;
        if (now - previous >= 26) {
          ctx.drawImage(c, 0, 0, image.width, image.height);
          frames.push({ image: image.toDataURL("image/png").split(",")[1],
            clip: c.dataset.animation, frame: c.dataset.frame, x: +c.dataset.rootX,
            facing: +c.dataset.omnitrixFacing, tick: +c.dataset.benMoveTick,
            capture: c.dataset.benCapture, health: +c.dataset.targetHealth });
          previous = now;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await play();
    const frames = await page.evaluate(() => {
      const recorded = window.feedbackFrames;
      window.feedbackFrames = null;
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

  async function walking(side) {
    await distance(side > 0 ? 240 : 205, 325);
    const [forward, back] = await keys();
    const frames = await record("walk-" + side, async () => {
      for (const [key, name] of [[forward, "walkForward"], [back, "walkBack"]]) {
        await page.keyboard.down(key);
        try {
          await clip(name);
          await page.waitForTimeout(550);
        } finally { await page.keyboard.up(key); }
        await idle();
        await page.waitForTimeout(110);
      }
    });
    for (const name of ["walkForward", "walkBack"]) {
      const cels = new Set(frames.filter(f => f.clip === name).map(f => f.frame));
      expect(cels.size, name).toBeGreaterThanOrEqual(7);
    }
    expect(frames.at(-1).clip).toBe("idle");
    expect(frames.every(f => f.facing === side)).toBe(true);
  }

  async function special(button, outcome, suffix) {
    const name = button === "j" ? "conductor_light" : "conductor_medium";
    const before = await health();
    const frames = await record(button + "-" + suffix, async () => {
      const [, back] = await keys();
      await page.keyboard.press("s", { delay: 52 });
      await page.keyboard.down(back);
      try { await page.keyboard.press(button, { delay: 40 }); }
      finally { await page.keyboard.up(back); }
      await expect(canvas).toHaveAttribute("data-move", name);
      await idle();
      await page.waitForTimeout(130);
    });
    expect(frames.some(f => f.capture === name), name + " @ " + await gap()).toBe(outcome === "hit");
    if (outcome === "hit") expect(await health()).toBeLessThan(before);
    else expect(await health()).toBe(before);
  }

  await walking(1);
  await distance(102, 122);
  await special("j", "hit", "direita");
  await distance(105, 137);
  await special("k", "hit", "direita");
  await distance(245, 295);
  await special("j", "miss", "erro");
  await special("k", "miss", "erro");
  await distance(95, 115);
  await page.locator("#dummy").selectOption("crouchGuard");
  await canvas.focus();
  await special("j", "guard", "defesa");
  await page.locator("#dummy").selectOption("idle");
  await canvas.focus();

  await distance(61, 74);
  await page.keyboard.down("d");
  try {
    await page.keyboard.press("w");
    await expect(canvas).toHaveAttribute("data-omnitrix-facing", "-1");
  } finally { await page.keyboard.up("d"); }
  await idle();
  await walking(-1);
  await distance(99, 121);
  await special("j", "hit", "esquerda");
  await distance(110, 136);
  await special("k", "hit", "esquerda");
  expect(errors).toEqual([]);
});
