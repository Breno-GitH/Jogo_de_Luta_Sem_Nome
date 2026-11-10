import { expect, test } from "@playwright/test";

async function seek(page, tick) {
  await page.locator("#seek").evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event("input"));
  }, tick);
}

test("Kaneki lab plays all the cels, mirrors the four limbs, and recovers layered extension", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("art/kaneki.html");
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true");
  await seek(page, 0);
  await expect(arena).toHaveAttribute("data-count", "4");
  for (let i = 0; i < 6; i++) {
    await expect(arena).toHaveAttribute("data-frame", String(i));
    await page.click("#next-frame");
  }
  await expect(arena).toHaveAttribute("data-frame", "0");
  const origins = JSON.parse(await arena.getAttribute("data-origins"));
  const tips = JSON.parse(await arena.getAttribute("data-tips"));
  expect(new Set(origins.map((point) => JSON.stringify(point))).size).toBe(4);
  await page.locator("#mirror").check();
  await expect(arena).toHaveAttribute("data-facing", "-1");
  const mirrored = JSON.parse(await arena.getAttribute("data-tips"));
  for (let i = 0; i < 4; i++) {
    expect(mirrored[i].x + tips[i].x).toBeCloseTo(512);
    expect(mirrored[i].y).toBeCloseTo(tips[i].y);
  }

  await page.selectOption("#scenario", "none");
  await expect(arena).toHaveAttribute("data-count", "0");
  await page.selectOption("#scenario", "full");
  await page.selectOption("#limb", "lowerFront");
  const behind = await arena.evaluate((canvas) => canvas.toDataURL());
  await page.selectOption("#layer", "front");
  expect(await arena.evaluate((canvas) => canvas.toDataURL())).not.toBe(behind);
  await page.selectOption("#layer", "behind");
  await page.selectOption("#scenario", "cycle");
  await page.selectOption("#limb", "upperFront");
  await page.selectOption("#layer", "front");
  await seek(page, 32);
  await expect(arena).toHaveAttribute("data-layer", "front");
  await expect(arena).toHaveAttribute("data-phase", "extending");
  await seek(page, 50);
  await expect(arena).toHaveAttribute("data-phase", "extended");
  await seek(page, 77);
  await expect(arena).toHaveAttribute("data-layer", "behind");
  await expect(arena).toHaveAttribute("data-phase", "retracting");
  await seek(page, 101);
  await expect(arena).toHaveAttribute("data-phase", "folded");
  await seek(page, 163);
  await expect(arena).toHaveAttribute("data-phase", "idle");
  await page.locator("#guides").check();
  await page.locator("#compare").check();
  await expect(arena).toHaveAttribute("data-comparison", "true");
  expect(
    await arena.evaluate((canvas) => getComputedStyle(canvas).imageRendering),
  ).toBe("pixelated");

  for (const link of ["body-atlas", "raw-atlas", "pose-atlas", "scale-sheet"]) {
    const url = await page.locator("#" + link).evaluate((a) => a.href);
    const image = await page.request.get(url);
    expect(image.ok()).toBe(true);
    expect(image.headers()["content-type"]).toContain("image/png");
  }
  await page.setViewportSize({ width: 390, height: 800 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("Kaneki plays the movement scenarios at 60 Hz and is controllable in practice", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("art/kaneki.html");
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true");
  for (const [scene, tick, clip, motion] of [
    ["walkForward", 12, "walkForward", "following"],
    ["walkBack", 12, "walkBack", "following"],
    ["dashForward", 6, "dashForward", "dash"],
    ["backdash", 6, "backdash", "dash"],
    ["crouch", 25, "crouchIdle", "crouch"],
    ["crouch", 34, "crouchEnd", "crouch"],
    ["jump", 3, "jumpStart", "takeoff"],
    ["jumpForward", 12, "jumpRise", "rise"],
    ["jumpBack", 26, "jumpApex", "apex"],
    ["jump", 36, "jumpFall", "fall"],
    ["jump", 50, "landing", "landing"],
  ]) {
    await page.selectOption("#scenario", scene);
    await seek(page, tick);
    await expect(arena).toHaveAttribute("data-clip", clip);
    await expect(arena).toHaveAttribute("data-motion", motion);
    await expect(arena).toHaveAttribute("data-count", "4");
    const right = JSON.parse(await arena.getAttribute("data-tips"));
    const rightX = Number(await arena.getAttribute("data-world-x"));
    await page.locator("#mirror").check();
    await expect(arena).toHaveAttribute("data-facing", "-1");
    const leftX = Number(await arena.getAttribute("data-world-x"));
    expect(leftX + rightX).toBeCloseTo(1240);
    const left = JSON.parse(await arena.getAttribute("data-tips"));
    for (let i = 0; i < 4; i++) {
      expect(left[i].x + right[i].x).toBeCloseTo(512, 0);
      expect(left[i].y).toBeCloseTo(right[i].y);
    }
    await page.locator("#mirror").uncheck();
  }

  await page.selectOption("#scenario", "free");
  await page.keyboard.down("d");
  await expect(arena).toHaveAttribute("data-clip", "walkForward");
  await page.keyboard.up("d");
  await page.keyboard.down("a");
  await expect(arena).toHaveAttribute("data-clip", "walkBack");
  await page.keyboard.down("Shift");
  await expect(arena).toHaveAttribute("data-clip", "backdash");
  await page.keyboard.up("Shift");
  await page.keyboard.up("a");
  await expect(arena).toHaveAttribute("data-clip", "idle");
  await page.keyboard.down("s");
  await expect(arena).toHaveAttribute("data-clip", "crouchIdle");
  await page.keyboard.up("s");
  await expect(arena).toHaveAttribute("data-clip", "idle");
  await page.keyboard.press("w");
  await expect(arena).toHaveAttribute("data-clip", "jumpRise");
  await expect(arena).toHaveAttribute("data-clip", "idle");
  expect(Number(await arena.getAttribute("data-world-y"))).toBe(580);

  for (const id of ["movement-atlas", "motion-sheet", "motion-preview"]) {
    const url = await page.locator("#" + id).evaluate((a) => a.href);
    const response = await page.request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toMatch(/^image\/(png|webp)/);
  }
  expect(errors).toEqual([]);
});
