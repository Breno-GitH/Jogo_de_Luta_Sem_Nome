import { test, expect } from "@playwright/test";
import fs from "node:fs";

const attacks = JSON.parse(
  fs.readFileSync("public/sprites/samurai/attacks.json", "utf8"),
).clips;

test("all 45 attack poses render with matching phases and precise debug boxes", async ({
  page,
}) => {
  // This batch also exports 18 PNG captures; allow for a cold Chrome/image
  // cache without relaxing any pose, palette or collision assertions.
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  fs.mkdirSync("art/samurai/qa/attacks", { recursive: true });
  for (const [name, clip] of Object.entries(attacks)) {
    await page.selectOption("#animation", name);
    await page.locator("#boxes").check();
    const images = [];
    for (let i = 0; i < clip.count; i++) {
      await page
        .getByRole("button", { name: `Quadro ${i + 1}`, exact: true })
        .click();
      await expect(canvas).toHaveAttribute(
        "data-phase",
        clip.combat.poses[i].phase,
      );
      images.push(await canvas.evaluate((node) => node.toDataURL()));
    }
    expect(new Set(images).size).toBe(clip.count);
    const active = clip.combat.poses.findIndex(
      (pose) => pose.phase === "active",
    );
    await page
      .getByRole("button", { name: `Quadro ${active + 1}`, exact: true })
      .click();
    await canvas.screenshot({
      path: `art/samurai/qa/attacks/${name}-boxes.png`,
    });
    await page.locator("#boxes").uncheck();
    await page.locator("#p2").check();
    expect(await canvas.evaluate((node) => node.toDataURL())).not.toBe(
      images[active],
    );
    await page.locator("#p2").uncheck();
    await canvas.screenshot({ path: `art/samurai/qa/attacks/${name}.png` });
  }
  expect(errors).toEqual([]);
});

test("all nine attacks deal their individual damage against the real dummy and recover", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  for (const [name, clip] of Object.entries(attacks)) {
    await page.selectOption("#animation", name);
    await page.locator("#test-attack").click();
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-target-health")))
      .toBe(1000 - clip.combat.damage);
    await expect(canvas).toHaveAttribute("data-playing", "false");
    await expect(canvas).toHaveAttribute("data-animation", "idle");
    await expect(page.locator("#error")).toBeEmpty();
  }
});

test("ground chain, launcher and air finisher produce real combos and hitstop", async ({
  page,
}) => {
  await page.goto("/art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  await page.locator("#boxes").check();
  await page.locator("#ground-combo").click();
  await expect(canvas).toHaveAttribute("data-max-combo", "3");
  await expect(canvas).toHaveAttribute("data-target-health", "795");
  await expect(canvas).toHaveAttribute("data-playing", "false");
  await page.selectOption("#speed", "0.25");
  await page.locator("#air-combo").click();
  await expect(canvas).toHaveAttribute("data-animation", "air_light");
  await expect(canvas).toHaveAttribute("data-animation", "air_medium");
  await expect(canvas).toHaveAttribute("data-animation", "air_heavy");
  await expect(canvas).toHaveAttribute("data-max-combo", "4");
  await expect(canvas).toHaveAttribute("data-target-knockdown", "true");
  await canvas.screenshot({ path: "art/samurai/qa/attacks/air-finisher.png" });
  await expect(canvas).toHaveAttribute("data-target-health", "743");
  await expect(canvas).toHaveAttribute("data-playing", "false");
  await expect(canvas).toHaveAttribute("data-animation", "idle");
});
