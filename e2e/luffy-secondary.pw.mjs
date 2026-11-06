import { expect, test } from "@playwright/test";

test("Luffy renders the elastic grab and removes its grip after release", async ({
  page,
}) => {
  test.setTimeout(65_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/art/luffy-secondary.html");
  const canvas = page.locator("#arena");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  await page.selectOption("#speed", "0.25");
  await page.check("#boxes");
  await page.selectOption("#scenario", "grab");
  await page.click("#pause");
  for (let i = 0; i < 20; i++) {
    if ((await canvas.getAttribute("data-animation")) === "grabHold") break;
    await page.click("#step");
  }
  await expect(canvas).toHaveAttribute("data-animation", "grabHold");
  await expect(canvas).toHaveAttribute("data-luffy-arms", "1");
  await canvas.screenshot({ path: "deployment/audit/luffy-secondary-grab.png" });
  await page.selectOption("#speed", "1");
  await page.click("#pause");
  await expect(canvas).toHaveAttribute("data-target-health", "888");
  await expect(canvas).toHaveAttribute("data-luffy-arms", "0");
  await expect(canvas).toHaveAttribute("data-animation", "idle");
  expect(errors).toEqual([]);
});

test("Luffy renders guard impacts, launches, the KO transition and a punished special", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.goto("/art/luffy-secondary.html");
  const canvas = page.locator("#arena");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  const saw = async (clip) =>
    expect.poll(async () => JSON.parse(await canvas.getAttribute("data-seen"))).toContain(clip);
  await page.selectOption("#scenario", "blockHigh");
  await saw("guardImpactStand");
  await saw("guardRecovery");
  await page.check("#mirror");
  await page.selectOption("#scenario", "blockLow");
  await saw("guardImpactCrouch");
  await saw("guardRecovery");
  await page.selectOption("#scenario", "launcher");
  for (const clip of ["launched", "falling", "downed", "getup"]) await saw(clip);
  await page.selectOption("#scenario", "interrupt");
  await saw("gatling_heavy");
  await saw("damageLight");
  await expect(canvas).toHaveAttribute("data-luffy-arms", "0");
  await page.selectOption("#scenario", "ko");
  await saw("ko");
  await saw("defeat");
  await page.selectOption("#scenario", "victory");
  await saw("victory");
  await expect(page.locator("#error")).toBeEmpty();
});
