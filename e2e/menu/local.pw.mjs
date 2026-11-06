import { test, expect } from "@playwright/test";
const production = !!process.env.MENU_URL;
const audit = "deployment/audit/menus";
import { mkdirSync } from "node:fs";
mkdirSync(audit, { recursive: true });
async function select(
  page,
  mode = "training",
  player = "samurai",
  enemy = "goku",
  difficulty = "normal",
) {
  await page.click("#" + mode);
  await page.check("#character-" + player);
  await page.click("#confirm-character");
  if (mode !== "arcade") {
    await page.check("#opponent-" + enemy);
    await page.click("#confirm-character");
    await page.selectOption("#difficulty", difficulty);
  }
  await page.click("#fight");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "fight", {
    timeout: 60000,
  });
}
test("five menu entries, keyboard and mouse selection, back paths and responsive roster", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "menu");
  await expect(page.locator(".menu-option")).toHaveCount(5);
  await expect(page.locator("#arcade")).toBeFocused();
  await page.keyboard.press("KeyS");
  await expect(page.locator("#versus")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-screen",
    "selection",
  );
  for (const id of ["samurai", "dio", "goku", "luffy"]) {
    await page.check("#character-" + id);
    await expect(page.locator("#fighter-hero")).toContainText(
      id === "dio"
        ? "Dio Brando"
        : id === "samurai"
          ? "Samurai"
          : id === "goku"
            ? "Goku"
            : "Luffy",
    );
  }
  await page.click("#confirm-character");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-select-step",
    "opponent",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-select-step",
    "player",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "menu");
  for (const id of ["arcade", "training"]) {
    await page.click("#" + id);
    await page.click("#back");
    await expect(page.locator("#app")).toHaveAttribute("data-screen", "menu");
  }
  for (const [w, h] of [
    [1440, 1000],
    [1280, 720],
    [900, 700],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.screenshot({ path: `${audit}/main-${w}.png`, fullPage: true });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".main-menu")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBe(true);
    await page.click("#versus");
    await page.screenshot({ path: `${audit}/select-${w}.png`, fullPage: true });
    await page.click("#back");
  }
  const images = await page
    .locator(".menu-cast img")
    .evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0));
  expect(images).toBe(true);
  expect(errors).toEqual([]);
});
test("real persisted audio and video options, fullscreen, remapping conflicts and restore", async ({
  page,
}) => {
  await page.goto("./");
  await page.click("#settings");
  for (const [id, value] of [
    ["master", "72"],
    ["effects", "31"],
    ["music", "24"],
  ]) {
    await page.locator("#opt-" + id).fill(value);
    await expect(page.locator("#value-" + id)).toHaveText(value + "%");
  }
  await page.check("#opt-muted");
  await page.uncheck("#opt-shake");
  await page.check("#opt-fps");
  await page.uncheck("#opt-pixelPerfect");
  await page.selectOption("#opt-scale", "1");
  await page.click('[data-bind="light"]');
  await page.keyboard.press("KeyK");
  await expect(page.locator("#settings-message")).toContainText(
    "já está atribuída",
  );
  await page.keyboard.press("KeyF");
  await expect(page.locator('[data-bind="light"]')).toHaveText("F");
  await page.reload();
  await page.click("#settings");
  await expect(page.locator("#opt-master")).toHaveValue("72");
  await expect(page.locator("#opt-muted")).toBeChecked();
  await expect(page.locator("#opt-shake")).not.toBeChecked();
  await expect(page.locator('[data-bind="light"]')).toHaveText("F");
  await page.click("#fullscreen");
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.click("#fullscreen");
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
  await page.uncheck("#opt-muted");
  await page.click("#test-sound");
  await expect(page.locator("#app")).toHaveAttribute("data-audio", "running");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-last-sound",
    "heavy",
  );
  await page.screenshot({ path: `${audit}/settings.png`, fullPage: true });
  await page.click("#back");
  await select(page, "training", "goku", "luffy");
  await page.keyboard.press("KeyF");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-move",
    "stand_light",
  );
  await page.keyboard.press("Escape");
  await page.click("#pause-controls");
  await expect(page.locator("#overlay .controls-list")).toContainText("F");
  await page.click("#back");
  await page.click("#pause-options");
  await page.click("#reset-options");
  await expect(page.locator('[data-bind="light"]')).toHaveText("J");
  await expect(page.locator("#opt-muted")).not.toBeChecked();
  await expect(page.locator("#opt-shake")).toBeChecked();
  await page.click("#back");
  await page.click("#pause-menu");
  await page.reload();
  await page.click("#settings");
  await expect(page.locator("#opt-master")).toHaveValue("50");
  await page.click("#back");
});
test("training settings, all four playable characters, real inputs, move lists, pause, combo and position resets", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  for (const [id, enemy] of [
    ["samurai", "dio"],
    ["dio", "goku"],
    ["goku", "luffy"],
    ["luffy", "samurai"],
  ]) {
    await select(page, "training", id, enemy);
    await expect(page.locator("canvas")).toHaveAttribute("data-character", id);
    await page.locator("#health-0").fill("53");
    await page.locator("#health-0").press("Tab");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-player-health",
      "530",
    );
    await page.locator("#meter-0").fill("30");
    await page.locator("#meter-0").press("Tab");
    await expect
      .poll(async () =>
        Number(await page.locator("canvas").getAttribute("data-meter")),
      )
      .toBe(id === "dio" ? 60 : 30);
    await page.click("#empty-meter");
    await expect(page.locator("canvas")).toHaveAttribute("data-meter", "0");
    await page.click("#fill-meter");
    await expect
      .poll(async () =>
        Number(await page.locator("canvas").getAttribute("data-meter")),
      )
      .toBeGreaterThanOrEqual(100);
    await page.check("#unlimited-meter");
    await page.uncheck("#infinite-health");
    await page.click("#refill-health");
    await page.check("#infinite-health");
    await page.selectOption("#dummy", "guard");
    await expect(page.locator("#status")).toContainText("DEFESA EM PÉ");
    await page.selectOption("#dummy", "crouchGuard");
    await page.selectOption("#dummy", "bot");
    await page.selectOption("#training-difficulty", "hard");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-difficulty",
      "hard",
    );
    await page.selectOption("#dummy", "idle");
    await page.click("#training-moves");
    await expect(page.locator("#overlay .move-list")).toBeVisible();
    if (id === "luffy")
      await expect(page.locator("#overlay .move-list")).toContainText(
        "Bazooka",
      );
    await page.click("#back");
    await page.locator("canvas").focus();
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(350);
    await page.keyboard.up("KeyD");
    await page.keyboard.press("KeyJ");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-move",
      "stand_light",
    );
    await expect(page.locator("#input-history")).toContainText("J");
    await page.click("#clear-damage");
    await expect(page.locator("#total-damage")).toHaveText("0");
    await page.click("#reset-positions");
    await expect(page.locator("#app")).toHaveAttribute("data-screen", "fight");
    await page.keyboard.press("Escape");
    await expect(page.locator("#app")).toHaveAttribute("data-screen", "pause");
    const x = await page.locator("canvas").getAttribute("data-player-x");
    await page.keyboard.press("KeyD");
    expect(await page.locator("canvas").getAttribute("data-player-x")).toBe(x);
    await page.click("#pause-moves");
    await page.keyboard.press("Escape");
    await expect(page.locator("#app")).toHaveAttribute("data-screen", "pause");
    await page.click("#pause-controls");
    await page.click("#back");
    await page.click("#resume");
    if (id === "luffy")
      await page.screenshot({ path: `${audit}/training.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await page.click("#pause-menu");
  }
  expect(errors).toEqual([]);
});
test("real best-of-three Arcade progression, completion, defeat, retry, versus rematch and character change", async ({
  page,
}) => {
  test.skip(
    production,
    "KO helper only exists in the development test fixture, never in production.",
  );
  await page.clock.install();
  await page.goto("/e2e/flow.html");
  await select(page, "arcade", "luffy");
  async function advanceFight() {
    for (let i = 0; i < 30; i++) {
      if (
        (await page.locator("canvas").getAttribute("data-match-phase")) ===
        "fight"
      )
        return;
      await page.clock.runFor(200);
    }
    throw Error("fight did not start");
  }
  async function bout(loser) {
    for (let i = 0; i < 2; i++) {
      await advanceFight();
      await page.evaluate((side) => window.flowFixture.knockOut(side), loser);
      await page.clock.runFor(2700);
    }
    await expect(page.locator("#app")).toHaveAttribute("data-screen", "result");
  }
  for (let i = 0; i < 3; i++) {
    await bout(1);
    if (i < 2) await page.click("#next-opponent");
  }
  await expect(page.locator("#overlay")).toContainText("Arcade concluído");
  await page.screenshot({
    path: `${audit}/arcade-complete.png`,
    fullPage: true,
  });
  await page.click("#again");
  await bout(0);
  await expect(page.locator("#overlay")).toContainText("Derrota");
  await page.click("#again");
  await advanceFight();
  await page.keyboard.press("Escape");
  await page.click("#pause-menu");
  await select(page, "versus", "goku", "dio", "hard");
  await bout(1);
  await page.click("#again");
  await bout(0);
  await page.click("#change-character");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-select-step",
    "player",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "menu");
});
