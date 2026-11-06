import { test, expect } from "@playwright/test";

async function seek(page, value) {
  await page.locator("#seek").evaluate((slider, tick) => {
    slider.value = String(tick);
    slider.dispatchEvent(new Event("input"));
  }, value);
}

test("Jet Gigant renders the real phase timeline through the end of the round", async ({ page }) => {
  test.setTimeout(65000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("art/luffy-jet.html", { waitUntil: "domcontentloaded" });
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true", { timeout: 25000 });
  await page.selectOption("#rival", "dio");
  await page.check("#mirror");
  const phases = [[26, "none"], [72, "jetPistol"], [139, "jetBazooka"], [199, "jetGatling"],
    [323, "gearThird"], [375, "gigantPistol"], [439, "return"]];
  for (const [tick, phase] of phases) {
    await seek(page, tick);
    await expect(arena).toHaveAttribute("data-jet-phase", phase);
    if (tick === 375) {
      await expect(arena).toHaveAttribute("data-jet-fist", "5");
      await expect(arena).toHaveAttribute("data-target-health", "710");
    }
    if (tick === 439) await expect(arena).toHaveAttribute("data-jet-cel", "small");
  }
  await seek(page, 475);
  await expect(arena).toHaveAttribute("data-jet-cel", "growing");
  await seek(page, 531);
  await expect(arena).toHaveAttribute("data-animation", "idle");
  await expect(arena).toHaveAttribute("data-camera-zoom", "1");
  await expect(arena).toHaveAttribute("data-target-state", "hitstun");
  await page.selectOption("#scenario", "ko");
  await seek(page, 439);
  await expect(arena).toHaveAttribute("data-match-phase", "fight");
  await expect(arena).toHaveAttribute("data-target-health", "0");
  await seek(page, 531);
  await expect(arena).toHaveAttribute("data-match-phase", "roundEnd");
  await expect(arena).toHaveAttribute("data-camera-zoom", "1");
  expect(errors).toEqual([]);
});

test("R is edge-triggered in Chrome, with separate blocked, whiffed and empty recoveries", async ({ page }) => {
  test.setTimeout(65000);
  await page.goto("art/luffy-jet.html", { waitUntil: "domcontentloaded" });
  const arena = page.locator("#arena");
  await expect(arena).toHaveAttribute("data-loaded", "true", { timeout: 25000 });
  for (const mode of ["guard", "whiff", "empty"]) {
    await page.selectOption("#scenario", mode);
    await seek(page, mode === "guard" ? 68 : 88);
    await expect(arena).toHaveAttribute("data-capture", "none");
    await expect(arena).toHaveAttribute("data-target-health", "1000");
    await expect(arena).toHaveAttribute("data-meter", "0");
    if (mode === "guard")
      await expect(arena).toHaveAttribute("data-target-state", "blockstun");
    await seek(page, 122);
    await expect(arena).toHaveAttribute("data-animation", "idle");
  }
  await page.selectOption("#scenario", "free");
  await arena.focus();
  await page.keyboard.down("r");
  await expect(arena).toHaveAttribute("data-move", "jet_gigant");
  await expect(arena).toHaveAttribute("data-meter", "0");
  await expect(arena).toHaveAttribute("data-jet-phase", "jetBazooka", { timeout: 5000 });
  await expect(arena).toHaveAttribute("data-animation", "idle", { timeout: 11000 });
  await page.keyboard.up("r");
  await expect(arena).toHaveAttribute("data-target-health", "668");
});
