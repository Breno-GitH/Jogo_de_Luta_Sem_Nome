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
  await page.locator("#confirm-character").click();
  await page.locator("#fight").click();
  await advanceTo(page, "data-screen", "fight");
}

test("Arcade Tower applies each floor palette and restarts the completed route", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  for (let index = 1; index <= 10; index++) {
    const palette = index < 4 ? "cyan" : index < 7 ? "amber" : "violet";
    const difficulty = index < 3 ? "easy" : index < 7 ? "normal" : "hard";
    await advanceTo(page, "data-screen", "fight");
    await advanceTo(page, "data-match-phase", "fight");
    await expect(page.locator("#app")).toHaveAttribute("data-stage", String(index));
    await expect(page.locator("#app")).toHaveAttribute("data-difficulty", difficulty);
    await expect(page.locator("canvas")).toHaveAttribute("data-palette", palette);
    await bout(page, 1);
    await expect(page.locator("#app")).toHaveAttribute("data-session-status", index < 10 ? "stageClear" : "victory");
    if (index < 10) {
      await page.locator("#next-opponent").click();
      await page.locator("#fight").click();
    }
  }
  await expect(page.locator("#overlay")).toContainText("Torre concluída");
  await page.screenshot({
    path: "deployment/audit/menus/tower-victory-flow.png",
    fullPage: true,
  });
  await page.locator("#again").click();
  await page.locator("#fight").click();
  await advanceTo(page, "data-screen", "fight");
  await expect(page.locator("#app")).toHaveAttribute("data-stage", "1");
  await expect(page.locator("canvas")).toHaveAttribute("data-palette", "cyan");
  expect(errors).toEqual([]);
});

test("defeat and retry preserve the floor and Versus remains a separate mode", async ({
  page,
}) => {
  test.setTimeout(180000);
  await setup(page);
  await bout(page, 0);
  await expect(page.locator("#overlay")).toContainText("Derrota no andar 1");
  await page.screenshot({
    path: "deployment/audit/menus/tower-defeat-flow.png",
    fullPage: true,
  });
  await page.locator("#again").click();
  await page.locator("#fight").click();
  await advanceTo(page, "data-screen", "fight");
  await expect(page.locator("#app")).toHaveAttribute("data-stage", "1");
  await bout(page, 1);
  await page.locator("#next-opponent").click();
  await page.locator("#menu").click();
  await page.locator("#versus").click();
  await page.locator("#confirm-character").click();
  await page.locator("#confirm-character").click();
  await page.locator("#fight").click();
  await advanceTo(page, "data-screen", "fight");
  await page.clock.runFor(1500);
  await expect(page.locator("#app")).toHaveAttribute("data-mode", "versus");
  await expect(page.locator("canvas")).toHaveAttribute("data-palette", "cyan");
});
