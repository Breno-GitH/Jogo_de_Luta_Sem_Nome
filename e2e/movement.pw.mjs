import { test, expect } from "@playwright/test";
import fs from "node:fs";

const counts = {
  idle: 6,
  walkForward: 6,
  walkBack: 6,
  dashForward: 5,
  backdash: 5,
  crouchStart: 2,
  crouchIdle: 2,
  crouchEnd: 2,
  jumpStart: 3,
  jumpRise: 2,
  jumpApex: 1,
  jumpFall: 2,
  landing: 3,
};

test("all 45 frames render, step, pause and use both palettes", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  fs.mkdirSync("art/samurai/qa", { recursive: true });
  const fingerprints = {};
  for (const [name, count] of Object.entries(counts)) {
    await page.selectOption("#animation", name);
    // Selecting a thumbnail stops the clock and guarantees an exact frame.
    const images = [];
    for (let i = 0; i < count; i++) {
      await page
        .getByRole("button", { name: `Quadro ${i + 1}`, exact: true })
        .click();
      await expect(canvas).toHaveAttribute("data-frame", String(i));
      await expect(canvas).toHaveAttribute("data-playing", "false");
      images.push(await canvas.evaluate((node) => node.toDataURL()));
    }
    expect(new Set(images).size).toBe(count);
    fingerprints[name] = images.length;
    await page.getByRole("button", { name: "Quadro 1", exact: true }).click();
    await page.locator("#next").click();
    await expect(canvas).toHaveAttribute(
      "data-frame",
      String(count === 1 ? 0 : 1),
    );
    await page.locator("#previous").click();
    await expect(canvas).toHaveAttribute("data-frame", "0");
    await page.locator("#p2").check();
    expect(await canvas.evaluate((node) => node.toDataURL())).not.toBe(
      images[0],
    );
    await page.locator("#p2").uncheck();
    await canvas.screenshot({ path: `art/samurai/qa/${name}.png` });
    await expect(page.locator("#error")).toBeEmpty();
  }
  fs.writeFileSync(
    "art/samurai/qa/browser-frames.json",
    JSON.stringify(fingerprints, null, 2),
  );
  expect(errors).toEqual([]);
});

test("jump and crouch scenarios execute the actual engine transitions", async ({
  page,
}) => {
  await page.goto("/art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  await page.selectOption("#speed", "0.25");
  await page.locator("#jump").click();
  const phases = new Set();
  const roots = [];
  for (let i = 0; i < 130; i++) {
    phases.add(await canvas.getAttribute("data-animation"));
    roots.push(Number(await canvas.getAttribute("data-root-y")));
    if (i > 10 && (await canvas.getAttribute("data-playing")) === "false")
      break;
    await page.waitForTimeout(40);
  }
  for (const name of [
    "jumpStart",
    "jumpRise",
    "jumpApex",
    "jumpFall",
    "landing",
    "idle",
  ])
    expect(phases.has(name), `Missing ${name}`).toBe(true);
  expect(Math.min(...roots)).toBeLessThan(400);
  expect(roots.at(-1)).toBe(580);
  await page.locator("#crouch").click();
  for (const clip of ["crouchStart", "crouchIdle", "crouchEnd", "idle"])
    await expect(canvas).toHaveAttribute("data-animation", clip, {
      timeout: 5000,
    });
  await page.locator("#locomotion").click();
  for (const clip of [
    "walkForward",
    "walkBack",
    "dashForward",
    "backdash",
    "idle",
  ])
    await expect(canvas).toHaveAttribute("data-animation", clip, {
      timeout: 5000,
    });
});

test("the playable match selects directional clips and interrupts movement with attacks", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#versus").click();
  await page.selectOption("#difficulty", "easy");
  await page.locator("#fight").click();
  const canvas = page.locator("canvas");
  await page.waitForTimeout(1800);
  await page.keyboard.down("a");
  await expect(canvas).toHaveAttribute("data-animation", "walkBack");
  await page.keyboard.up("a");
  await page.keyboard.down("d");
  await expect(canvas).toHaveAttribute("data-animation", "walkForward");
  await canvas.screenshot({ path: "art/samurai/qa/game-movement.png" });
  await page.keyboard.up("d");
  await page.keyboard.down("s");
  await expect(canvas).toHaveAttribute("data-animation", "crouchStart");
  await expect(canvas).toHaveAttribute("data-animation", "crouchIdle");
  await page.keyboard.up("s");
  await expect(canvas).toHaveAttribute("data-animation", "crouchEnd");
  await page.keyboard.down("a");
  await page.keyboard.press("Shift");
  await expect(canvas).toHaveAttribute("data-animation", "backdash");
  await page.keyboard.press("j");
  await expect(canvas).toHaveAttribute("data-physics-state", "attack");
  await page.keyboard.up("a");
  await page.screenshot({ path: "art/samurai/qa/game.png", fullPage: true });
});
