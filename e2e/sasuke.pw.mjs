import { expect, test } from "@playwright/test";

async function seek(page, tick) {
  await page.locator("#seek").evaluate((slider, n) => {
    slider.value = String(n);
    slider.dispatchEvent(new Event("input"));
  }, tick);
}

test("Sasuke's live atlas plays every normal, dash, jump and both guards", async ({
  page,
}) => {
  test.setTimeout(65000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("art/sasuke.html", { waitUntil: "domcontentloaded" });
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true", {
    timeout: 25000,
  });
  for (const side of [false, true]) {
    await page.locator("#mirror").setChecked(side);
    for (const stance of ["stand", "crouch", "air"]) {
      for (const strength of ["light", "medium", "heavy"]) {
        await page.selectOption("#scenario", `${stance}_${strength}`);
        await seek(page, 17);
        await expect(arena).not.toHaveAttribute("data-target-health", "1000");
      }
    }
  }
  await page.check("#boxes");
  await page.selectOption("#scenario", "stand_heavy");
  await seek(page, 13);
  await expect(arena).toHaveAttribute("data-animation", "stand_heavy");
  await expect(arena).toHaveAttribute("data-phase", "active");
  await arena.screenshot({
    path: "deployment/audit/sasuke-hebi/stand-heavy.png",
  });
  for (const [scenario, tick, clip] of [
    ["forward", 8, "walkForward"],
    ["back", 8, "walkBack"],
    ["dash", 7, "dashForward"],
    ["backdash", 7, "backdash"],
    ["crouch", 20, "crouchIdle"],
    ["jump", 27, "jumpApex"],
    ["guard", 6, "guardImpactStand"],
    ["guardLow", 6, "guardImpactCrouch"],
  ]) {
    await page.selectOption("#scenario", scenario);
    await seek(page, tick);
    await expect(arena).toHaveAttribute("data-animation", clip);
  }
  expect(errors).toEqual([]);
});

test("Sasuke appears in the roster and uses his own art in Training", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.click("#training");
  await page.check('input[name="character"][value="sasuke"]');
  await expect(
    page.locator(".character-card.selected strong").first(),
  ).toHaveText("Sasuke · Hebi");
  await page.click("#confirm-character");
  await page.check('input[name="opponent"][value="goku"]');
  await page.click("#confirm-character");
  await page.click("#fight");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-character",
    "sasuke",
    { timeout: 25000 },
  );
  await page.keyboard.press("w");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-animation",
    /jump(Start|Rise|Apex|Fall)/,
  );
});

test("All eight Sasuke specials render through the live engine", async ({ page }) => {
  test.setTimeout(65000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400) errors.push(response.url());
  });
  await page.goto("art/sasuke.html", { waitUntil: "domcontentloaded" });
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true");
  for (const side of [false, true]) {
    await page.locator("#mirror").setChecked(side);
    for (const [id, startup] of [
      ["senbon", 8], ["eiso", 10], ["chidori", 11], ["gokakyu", 10],
      ["hosenka", 12], ["goryuka", 16], ["serpents", 11], ["nagashi", 8],
    ]) {
      await page.selectOption("#scenario", id);
      await seek(page, 5);
      await expect(arena).toHaveAttribute("data-animation", id);
      await expect(arena).toHaveAttribute("data-phase", "startup");
      await seek(page, startup + 4);
      await expect(arena).toHaveAttribute("data-animation", id);
      await expect(arena).toHaveAttribute("data-phase", "active");
      await seek(page, 50);
      await expect(arena).not.toHaveAttribute("data-target-health", "1000");
    }
    await expect(arena).toHaveAttribute("data-storm", "false");
    await page.selectOption("#scenario", "goryuka");
    await seek(page, 42);
    await expect(arena).toHaveAttribute("data-storm", "true");
  }
  expect(errors).toEqual([]);
});

test("Sasuke Curse Mark uses the corrected atlas through awakening, combat and reversion", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("art/sasuke.html", { waitUntil: "domcontentloaded" });
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true");
  await page.selectOption("#scenario", "awakening");
  await seek(page, 13);
  await expect(arena).toHaveAttribute("data-animation", "curse_awaken");
  await seek(page, 50);
  await expect(arena).toHaveAttribute("data-curse-phase", "active");
  await expect(arena).toHaveAttribute("data-animation", "curse_idle");
  await page.locator("#mirror").setChecked(true);
  await page.selectOption("#scenario", "powered:stand_heavy");
  await seek(page, 14);
  await expect(arena).toHaveAttribute("data-animation", "curse_stand_heavy");
  await expect(arena).not.toHaveAttribute("data-target-health", "1000");
  await page.selectOption("#scenario", "powered:wingBurst");
  await seek(page, 18);
  await expect(arena).toHaveAttribute("data-animation", "curse_airBurst");
  await page.selectOption("#scenario", "powered:revert");
  await seek(page, 23);
  await expect(arena).toHaveAttribute("data-animation", "curse_revert");
  await seek(page, 42);
  await expect(arena).toHaveAttribute("data-curse-phase", "cooldown");
  await expect(arena).toHaveAttribute("data-animation", "idle");
  expect(errors).toEqual([]);
});

test("Kirin runs from palm confirm through the dragon impact in both forms", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("art/sasuke.html", { waitUntil: "domcontentloaded" });
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true");
  for (const [mode, cursed] of [["kirin", false], ["powered:kirin", true]]) {
    await page.locator("#mirror").setChecked(cursed);
    await page.selectOption("#scenario", mode);
    await seek(page, 7);
    await expect(arena).toHaveAttribute("data-animation", cursed ? "curse_kirin_start" : "kirin_start");
    await seek(page, 55);
    await expect(arena).toHaveAttribute("data-kirin-phase", "storm");
    await seek(page, 92);
    await expect(arena).toHaveAttribute("data-kirin-phase", "reveal");
    await expect(arena).toHaveAttribute("data-kirin-dragon", "true");
    await expect(arena).toHaveAttribute("data-kirin-cursed", String(cursed));
    await expect(arena).toHaveAttribute("data-kirin-variant", cursed ? "black" : "blue");
    await seek(page, 136);
    await expect(arena).toHaveAttribute("data-animation", cursed ? "curse_kirinCommand" : "kirinCommand");
    await seek(page, 156);
    await expect(arena).toHaveAttribute("data-kirin-phase", "dive");
    await seek(page, 171);
    await expect(arena).toHaveAttribute("data-kirin-phase", "impact");
    await expect(arena).toHaveAttribute("data-target-health", "680");
    await seek(page, 257);
    await expect(arena).toHaveAttribute("data-kirin-phase", "none");
    await expect(arena).toHaveAttribute("data-camera-zoom", "1");
  }
  expect(errors).toEqual([]);
});

test("polished Goryuka, Chidori and Nagashi use the real engine in the lab", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("art/sasuke.html", { waitUntil: "domcontentloaded" });
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true");
  for (const reverse of [false, true]) {
    await page.locator("#mirror").setChecked(reverse);
    await page.selectOption("#scenario", "goryukaWave");
    const samples = [];
    for (const tick of [38, 42, 46, 50, 54, 58, 62, 66]) {
      await seek(page, tick);
      await expect(arena).toHaveAttribute("data-fire-dragon-live", "true");
      samples.push(await arena.evaluate(c => ({
        x: Number(c.dataset.fireDragonX), y: Number(c.dataset.fireDragonY),
      })));
    }
    expect(samples.slice(1).every((sample, i) => (sample.x - samples[i].x) * (reverse ? -1 : 1) > 0)).toBe(true);
    expect(samples.filter((sample, i) => i > 0 && i + 1 < samples.length &&
      (sample.y - samples[i - 1].y) * (samples[i + 1].y - sample.y) < 0).length).toBeGreaterThanOrEqual(2);
    await seek(page, 150);
    await expect(arena).toHaveAttribute("data-fire-dragon-live", "false");
  }
  for (const powered of ["", "powered:"]) {
    await page.selectOption("#scenario", powered + "chidoriFar");
    await seek(page, 11);
    await expect(arena).toHaveAttribute("data-animation", powered ? "curse_chidori" : "chidori");
    let zoomed = false;
    for (const tick of [19, 22, 25, 28, 31, 34, 37]) {
      await seek(page, tick);
      zoomed ||= Number(await arena.getAttribute("data-camera-zoom")) > 1;
    }
    expect(zoomed).toBe(true);
    await seek(page, 85);
    await expect(arena).toHaveAttribute("data-target-health", powered ? "879" : "895");
    await expect(arena).toHaveAttribute("data-camera-zoom", "1");
    await page.selectOption("#scenario", powered + "nagashiField");
    await seek(page, 65);
    await expect(arena).toHaveAttribute("data-target-health", powered ? "931" : "940");
  }
  expect(errors).toEqual([]);
});
