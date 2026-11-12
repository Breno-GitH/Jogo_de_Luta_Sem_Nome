import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const capture = process.env.BEN_CAPTURE === "1";
const forms = ["xlr8", "fourArms", "heatblast"];

function save(name, data) {
  if (!capture) return;
  const folder = "test-results/ben-forms";
  mkdirSync(folder, { recursive: true });
  writeFileSync(`${folder}/${name}.png`, Buffer.from(data.split(",")[1], "base64"));
}

async function photo(arena, name) {
  if (capture) save(name, await arena.evaluate(canvas => canvas.toDataURL()));
}

async function select(page, arena, id) {
  for (let count = 0; count < 11; count++) {
    const before = await arena.getAttribute("data-omnitrix-selection");
    if (before === id) return;
    await page.keyboard.press("l");
    await expect(arena).not.toHaveAttribute("data-omnitrix-selection", before);
  }
  throw Error(`Form not found in dial: ${id}`);
}

async function activate(page, arena, id, transitionPhoto = false) {
  await select(page, arena, id);
  if (capture && transitionPhoto) await arena.evaluate(canvas => {
    window.benFrame = new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const tick = +canvas.dataset.omnitrixTransitionTicks;
        if (tick < 1 || tick > 4) return;
        observer.disconnect();
        resolve(canvas.toDataURL());
      });
      observer.observe(canvas, { attributes: true, attributeFilter: ["data-omnitrix-transition-ticks"] });
    });
  });
  await page.keyboard.down("l");
  if (capture && transitionPhoto) save(`troca-${id}`, await page.evaluate(() => window.benFrame));
  await expect(arena).toHaveAttribute("data-omnitrix-form", id);
  await page.keyboard.up("l");
  await expect(arena).toHaveAttribute("data-omnitrix-selection", id);
  await expect(arena).toHaveAttribute("data-omnitrix-sheet", id === "feedback"
    ? "ben/feedback/rework/idle.png" : `ben/${id}/idle.png`);
}

test("Treinamento renders three real form changes and their movement clips", async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const assetFailures = [];
  page.on("response", response => {
    if (response.url().includes("/sprites/ben/") && !response.ok()) assetFailures.push(response.url());
  });
  await page.goto("./");
  await page.click("#training");
  await page.check('input[name="character"][value="ben"]');
  await page.click("#confirm-character");
  await page.check('input[name="opponent"][value="sasuke"]');
  await page.click("#confirm-character");
  await page.click("#fight");
  const arena = page.locator("canvas");
  await expect(arena).toHaveAttribute("data-omnitrix-form", "human", { timeout: 30000 });
  for (const id of forms) {
    await activate(page, arena, id, true);
    await photo(arena, `arena-${id}`);
    // Hold away from the rival to leave room for all three forms to dash.
    await page.keyboard.down("a");
    await expect(arena).toHaveAttribute("data-animation", "walkBack");
    await page.keyboard.up("a");
    await page.keyboard.down("d");
    await expect(arena).toHaveAttribute("data-animation", "walkForward");
    await page.keyboard.down("Shift");
    await expect(arena).toHaveAttribute("data-animation", "dashForward");
    await page.keyboard.up("Shift");
    await page.keyboard.up("d");
    await expect(arena).toHaveAttribute("data-animation", "idle");
    await page.keyboard.press("w");
    await expect.poll(() => arena.evaluate(c => Number(c.dataset.rootY))).toBeLessThan(535);
    await expect(arena).toHaveAttribute("data-animation", "idle");
    await page.keyboard.down("s");
    await expect(arena).toHaveAttribute("data-animation", "crouchIdle");
    await page.keyboard.up("s");
    await expect(arena).toHaveAttribute("data-animation", "idle");
  }
  await select(page, arena, "gravattack");
  await page.keyboard.press("l", { delay: 340 });
  await expect(arena).toHaveAttribute("data-omnitrix-form", "gravattack");
  expect(assetFailures).toEqual([]);
  expect(errors).toEqual([]);
});

test("right-side sprites and standard controller preserve independent taps and holds", async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    window.benPad = { connected: true, id: "DualSense", mapping: "standard", index: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    Object.defineProperty(navigator, "getGamepads", { value: () => [window.benPad] });
  });
  await page.goto("./art/ben.html");
  const arena = page.locator("canvas");
  await expect(arena).toHaveAttribute("data-ben-seat", "0", { timeout: 30000 });
  expect((await page.locator("#playlist").innerText()).split(" · ")).toHaveLength(11);
  await page.click("#seat");
  await expect(arena).toHaveAttribute("data-omnitrix-facing", "-1");
  await page.evaluate(() => { window.benPad.buttons[3].pressed = true; });
  await expect(arena).toHaveAttribute("data-omnitrix-form", "xlr8");
  await expect(arena).toHaveAttribute("data-chain-keys", "✕/□/△");
  await photo(arena, "espelho-xlr8");
  await arena.evaluate(canvas => {
    window.benPad.buttons[3].pressed = false;
    for (const event of ["keydown", "keyup"])
      canvas.dispatchEvent(new KeyboardEvent(event, { key: "l", code: "KeyL", bubbles: true }));
  });
  await expect(arena).toHaveAttribute("data-omnitrix-selection", "fourArms");
  await expect(arena).toHaveAttribute("data-omnitrix-form", "xlr8");
  for (const id of forms.slice(1)) {
    await activate(page, arena, id);
    await expect(arena).toHaveAttribute("data-omnitrix-facing", "-1");
    await photo(arena, `espelho-${id}`);
  }
});

test("Stage 5 masters load in the lab and their portraits render in the Omnitrix", async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    window.benPortraitsDrawn = new Set();
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      if (source instanceof HTMLImageElement) {
        const portrait = /\/sprites\/ben\/omnitrix\/([^/]+)\.png$/.exec(source.src);
        if (portrait) window.benPortraitsDrawn.add(portrait[1]);
      }
      return drawImage.call(this, source, ...args);
    };
  });
  await page.goto("./art/ben.html");
  const gallery = page.locator("#stage5-models");
  expect(await gallery.evaluate(async img => {
    await img.decode();
    return img.naturalWidth;
  })).toBe(1470);
  const arena = page.locator("canvas");
  await expect(arena).toHaveAttribute("data-omnitrix-form", "human", { timeout: 30000 });
  let active = "human";
  for (const id of ["feedback", "diamondhead", "humungousaur"]) {
    await select(page, arena, id);
    await expect.poll(() => page.evaluate(form => window.benPortraitsDrawn.has(form), id)).toBe(true);
    await expect(arena).toHaveAttribute("data-omnitrix-form", active);
    await activate(page, arena, id);
    await page.keyboard.down("s");
    await expect(arena).toHaveAttribute("data-animation", "crouchIdle");
    await page.keyboard.up("s");
    await expect(arena).toHaveAttribute("data-animation", "idle");
    active = id;
  }
});



test("Stage 6 visual models animate in the arena on both sides", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("./art/ben.html");
  const canvas = page.locator("canvas");
  const model = page.locator("#stage6-model"), clip = page.locator("#stage6-clip");
  await expect(page.locator("#stage6-models")).toHaveJSProperty("naturalWidth", 1216);
  for (const id of ["bigChill", "ghostfreak", "nrg", "nrgReleased"]) {
    await model.selectOption(id);
    await expect(canvas).toHaveAttribute("data-omnitrix-sheet", `ben/${id}/stage6-model.png`);
    await expect(page.locator("#stage6-status")).toHaveText("Prévia visual · combate pausado");
    await expect(canvas).toHaveAttribute("data-omnitrix-facing", "1");
    const startFrame = await canvas.getAttribute("data-frame");
    await expect(canvas).not.toHaveAttribute("data-frame", startFrame);
    await clip.selectOption(id === "bigChill" ? "wings" : "poses");
    await expect(canvas).toHaveAttribute("data-animation", id === "bigChill" ? "wings" : "poses");
    await page.locator("#seat").click();
    await expect(canvas).toHaveAttribute("data-omnitrix-facing", "-1");
    await expect(canvas).toHaveAttribute("data-omnitrix-sheet", `ben/${id}/stage6-model.png`);
    await page.locator("#seat").click();
  }
  await model.selectOption("");
  await expect(clip).toBeDisabled();
  await expect(canvas).not.toHaveAttribute("data-omnitrix-sheet", /stage6-model/);
});
