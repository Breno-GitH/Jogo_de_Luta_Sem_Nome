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
