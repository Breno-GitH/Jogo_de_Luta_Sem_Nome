import { test, expect } from "@playwright/test";

test.skip(
  process.env.SAMURAI_TEST_BUILD === "1",
  "Flow fixture is intentionally not shipped in the production build.",
);
async function advanceTo(page, attribute, value) {
  const target =
    attribute === "data-screen" ? page.locator("#app") : page.locator("canvas");
  for (let i = 0; i < 50; i++) {
    if ((await target.getAttribute(attribute)) === value) return;
    await page.clock.runFor(200);
  }
  await expect(target).toHaveAttribute(attribute, value);
}
async function bout(page, loser) {
  for (let i = 0; i < 2; i++) {
    await advanceTo(page, "data-match-phase", "fight");
    await page.evaluate((side) => window.flowFixture.knockOut(side), loser);
    await page.clock.runFor(2700);
  }
  await advanceTo(page, "data-screen", "result");
}
async function setup(page) {
  await page.clock.install();
  await page.goto("/e2e/flow.html");
  await page.locator("#arcade").click();
  await page.locator("#fight").click();
  await advanceTo(page, "data-screen", "fight");
}

test("Arcade advances through three coloured opponents, resolves real rounds, and restarts the completed route", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  for (const [index, palette, difficulty] of [
    [1, "cyan", "easy"],
    [2, "amber", "normal"],
    [3, "violet", "hard"],
  ]) {
    await advanceTo(page, "data-screen", "fight");
    await advanceTo(page, "data-match-phase", "fight");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-stage",
      String(index),
    );
    await expect(page.locator("#app")).toHaveAttribute(
      "data-difficulty",
      difficulty,
    );
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-palette",
      palette,
    );
    if (index > 1) {
      const recoloured = await page
        .locator("canvas")
        .evaluate((canvas, palette) => {
          const x = Math.round(Number(canvas.dataset.targetX)),
            context = canvas.getContext("2d");
          const pixels = context.getImageData(
            Math.max(0, x - 90),
            200,
            Math.min(200, 1280 - x + 90),
            390,
          ).data;
          const target = palette === "amber" ? [182, 140, 50] : [129, 86, 173];
          let count = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (
              pixels[i] === target[0] &&
              pixels[i + 1] === target[1] &&
              pixels[i + 2] === target[2]
            )
              count++;
          return count;
        }, palette);
      expect(recoloured).toBeGreaterThan(10);
    }
    await page.screenshot({
      path: `art/samurai/qa/game/arcade-${palette}.png`,
      fullPage: true,
    });
    await bout(page, 1);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-session-status",
      index < 3 ? "stageClear" : "victory",
    );
    if (index < 3) await page.locator("#next-opponent").click();
  }
  await expect(page.locator("#overlay")).toContainText("Arcade concluído.");
  await page.screenshot({
    path: "art/samurai/qa/game/arcade-victory.png",
    fullPage: true,
  });
  await page.locator("#again").click();
  await advanceTo(page, "data-screen", "fight");
  await expect(page.locator("#app")).toHaveAttribute("data-stage", "1");
  await expect(page.locator("canvas")).toHaveAttribute("data-palette", "cyan");
  expect(errors).toEqual([]);
});

test("defeat, retry and cancelling a palette load preserve the actual session and menu flow", async ({
  page,
}) => {
  test.setTimeout(60000);
  await setup(page);
  await bout(page, 0);
  await expect(page.locator("#overlay")).toContainText("Derrota.");
  await page.screenshot({
    path: "art/samurai/qa/game/defeat.png",
    fullPage: true,
  });
  await page.locator("#again").click();
  await advanceTo(page, "data-screen", "fight");
  await expect(page.locator("#app")).toHaveAttribute("data-stage", "1");
  await bout(page, 1);
  await page.locator("#next-opponent").click();
  await page.locator("#menu").click();
  await page.locator("#versus").click();
  await page.locator("#fight").click();
  await advanceTo(page, "data-screen", "fight");
  await page.clock.runFor(1500);
  await expect(page.locator("#app")).toHaveAttribute("data-mode", "versus");
  await expect(page.locator("canvas")).toHaveAttribute("data-palette", "cyan");
});
