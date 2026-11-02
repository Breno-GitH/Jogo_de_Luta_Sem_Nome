import { test, expect } from "@playwright/test";
import fs from "node:fs";
fs.mkdirSync("art/samurai/qa/game", { recursive: true });
async function begin(page, mode = "training", difficulty = "normal") {
  await page.goto("/");
  await page.locator(`#${mode}`).click();
  if (mode !== "arcade") await page.selectOption("#difficulty", difficulty);
  await page.locator("#fight").click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "fight");
  return page.locator("canvas");
}
async function approach(page, canvas) {
  await page.keyboard.down("d");
  await expect
    .poll(
      async () =>
        Number(await canvas.getAttribute("data-target-x")) -
        Number(await canvas.getAttribute("data-player-x")),
    )
    .toBeLessThan(103);
  await page.keyboard.up("d");
}

test("menu, character selection, three difficulties, Arcade start, restart and return work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.screenshot({
    path: "art/samurai/qa/game/menu.png",
    fullPage: true,
  });
  for (const difficulty of ["easy", "normal", "hard"]) {
    await page.locator("#versus").click();
    await expect(
      page.getByRole("radio", { name: "Selecionar Samurai" }),
    ).toBeChecked();
    await page.selectOption("#difficulty", difficulty);
    await page.locator("#fight").click();
    await expect(page.locator("#app")).toHaveAttribute(
      "data-difficulty",
      difficulty,
    );
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-animation",
      "entrance",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("#resume")).toBeVisible();
    await page.locator("#pause-restart").click();
    await expect(page.locator("#app")).toHaveAttribute("data-screen", "fight");
    await expect(page.locator("canvas")).toHaveAttribute("data-round", "1");
    await page.locator("#menu").click();
  }
  await page.locator("#arcade").click();
  await expect(page.locator(".route li")).toHaveCount(3);
  await expect(page.locator("#overlay")).not.toContainText("NÃO IMPLEMENTADO");
  await page.locator("#fight").click();
  await expect(page.locator("#app")).toHaveAttribute("data-stage", "1");
  await expect(page.locator("#app")).toHaveAttribute("data-difficulty", "easy");
  await page.locator("#menu").click();
  await page.locator("#online").click();
  await expect(page.locator("#join-form")).toBeVisible();
  expect(errors).toEqual([]);
});

test("training measures a real ground combo with infinite life, clears counters and resets positions", async ({
  page,
}) => {
  const canvas = await begin(page);
  await expect(page.locator("#training-panel")).toBeVisible();
  await expect(canvas).toHaveAttribute("data-meter", "100");
  await approach(page, canvas);
  await page.keyboard.press("j");
  await expect(canvas).toHaveAttribute("data-hitstop", /[1-9]/);
  await page.keyboard.press("k");
  await expect(canvas).toHaveAttribute("data-move", "stand_medium");
  await expect(canvas).toHaveAttribute("data-hitstop", /[1-9]/);
  await page.keyboard.press("l");
  await expect(page.locator("#best-hits")).toHaveText("3");
  await expect(page.locator("#combo-damage")).toHaveText("205");
  await expect(canvas).toHaveAttribute("data-target-health", "1000");
  await page.locator("#boxes").click();
  await page.screenshot({
    path: "art/samurai/qa/game/training.png",
    fullPage: true,
  });
  await page.locator("#clear-damage").click();
  await expect(page.locator("#total-damage")).toHaveText("0");
  await page.locator("#infinite-health").uncheck();
  await page.locator("#unlimited-meter").uncheck();
  await page.locator("#restart").click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "fight");
  await expect(canvas).toHaveAttribute("data-player-x", "400");
  await expect(canvas).toHaveAttribute("data-meter", "0");
  await expect(page.locator("#infinite-health")).not.toBeChecked();
});

test("practice dummy defenses, jumping, BOT, finite damage and ultimate meters are functional", async ({
  page,
}) => {
  test.setTimeout(40000);
  const canvas = await begin(page);
  await page.selectOption("#dummy", "guard");
  await approach(page, canvas);
  await page.keyboard.press("j");
  await expect(canvas).toHaveAttribute("data-target-state", "blockstun");
  await expect(page.locator("#total-damage")).toHaveText("0");
  await expect(canvas).toHaveAttribute("data-physics-state", "idle");
  await page.keyboard.down("s");
  await page.keyboard.press("j");
  await page.keyboard.up("s");
  await expect(page.locator("#last-damage")).toHaveText("40");
  await page.selectOption("#dummy", "crouchGuard");
  await expect(page.locator("#dummy-state")).toContainText("crouch");
  await page.selectOption("#dummy", "jump");
  await expect(page.locator("#dummy-state")).toContainText("air");
  await page.selectOption("#dummy", "bot");
  await page.selectOption("#training-difficulty", "hard");
  await expect(page.locator("#app")).toHaveAttribute("data-difficulty", "hard");
  await expect(page.locator("#status")).toContainText("DIFÍCIL");
  await expect(page.locator("#ai-decision")).not.toHaveText("desligada");
  await page.selectOption("#dummy", "idle");
  await page.locator("#restart").click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "fight");
  await page.locator("#infinite-health").uncheck();
  await page.locator("#unlimited-meter").uncheck();
  await approach(page, canvas);
  await page.keyboard.press("r");
  await expect(canvas).toHaveAttribute("data-capture", "ultimate");
  await expect(canvas).toHaveAttribute("data-meter", "0");
  await expect(page.locator("#best-hits")).toHaveText("10");
  await expect(canvas).toHaveAttribute("data-target-health", "701");
  await expect(page.locator("#player-state")).toContainText("idle");
  await expect(page.locator("#total-damage")).toHaveText("299");
});

test("sound unlocks after a click and supports mute and volume; menus stay usable at a smaller desktop size", async ({
  page,
}) => {
  await begin(page);
  const root = page.locator("#app");
  await expect(root).toHaveAttribute("data-audio", "running");
  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toHaveText("Som: desligado");
  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toHaveText("Som: ligado");
  await page.locator("#volume").fill("15");
  await page.locator("#menu").click();
  await page.setViewportSize({ width: 800, height: 900 });
  await page.locator("#training").click();
  await page.locator("#fight").scrollIntoViewIfNeeded();
  await expect(page.locator("#fight")).toBeInViewport();
  await page.screenshot({
    path: "art/samurai/qa/game/selection-small.png",
    fullPage: true,
  });
});
