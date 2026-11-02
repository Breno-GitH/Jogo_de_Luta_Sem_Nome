import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "art/dio/qa/revision";
fs.mkdirSync(qa, { recursive: true });
async function save(canvas, file) {
  fs.writeFileSync(
    file,
    Buffer.from(
      (await canvas.evaluate((c) => c.toDataURL("image/png"))).split(",")[1],
      "base64",
    ),
  );
}
async function lab(page) {
  await page.clock.install();
  await page.goto("/art/dio.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  return canvas;
}
test("before/after, individual visibility, pivots, zoom, looping and frame controls work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const canvas = await lab(page);
  await page.locator("#previous").check();
  await page.locator("#guides").check();
  await page.selectOption("#zoom", "3");
  await page.selectOption("#animation", "crouchStart");
  await page.getByRole("button", { name: "Quadro 4", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-comparison", "true");
  await save(canvas, `${qa}/comparison-crouch.png`);
  await page.selectOption("#animation", "walkForward");
  await page.getByRole("button", { name: "Quadro 11", exact: true }).click();
  await save(canvas, `${qa}/comparison-walk.png`);
  await page.selectOption("#mode", "live");
  await page.locator("#hide-dio").check();
  await expect(canvas).toHaveAttribute(
    "data-visible",
    "the-world,previous:the-world",
  );
  await page.locator("#hide-world").check();
  await expect(canvas).toHaveAttribute("data-visible", "");
  await page.locator("#hide-dio").uncheck();
  await page.locator("#hide-world").uncheck();
  await page.selectOption("#animation", "jumpStart");
  await page.clock.runFor(1000);
  await expect(canvas).toHaveAttribute("data-paused", "false");
  await page.locator("#repeat").uncheck();
  await page.clock.runFor(1000);
  await expect(canvas).toHaveAttribute("data-paused", "true");
  await page.locator("#frame-previous").click();
  await expect(canvas).toHaveAttribute("data-frame", "1");
  await expect(page.locator("#error")).toBeEmpty();
  expect(errors).toEqual([]);
});

test("records an actual fixed-tick before/after walking preview", async ({
  page,
}) => {
  test.setTimeout(90000);
  const canvas = await lab(page);
  await page.locator("#previous").check();
  await page.selectOption("#zoom", "3");
  await canvas.focus();
  // Start in the camera's following region, so the captured clip has a stable
  // actor position and its loop does not reset a large horizontal screen pan.
  await page.keyboard.down("d");
  await page.clock.runFor(4100);
  await page.keyboard.up("d");
  await page.locator("#pause").click();
  await page.keyboard.down("d");
  const directory = `${qa}/walk-recording`;
  fs.mkdirSync(directory, { recursive: true });
  const trace = [];
  for (let i = 0; i < 80; i++) {
    await page.locator("#next").click();
    await save(canvas, `${directory}/${String(i).padStart(3, "0")}.png`);
    trace.push(await canvas.evaluate((c) => ({ ...c.dataset })));
  }
  await page.keyboard.up("d");
  fs.writeFileSync(`${qa}/walk-trace.json`, JSON.stringify(trace, null, 2));
  expect(new Set(trace.map((s) => s.dioFrame)).size).toBe(40);
  expect(Number(trace.at(-1).ownerX) - Number(trace[0].ownerX)).toBeCloseTo(
    79 * 1.6,
  );
});

test("the real game plays forward/back walking, repeated crouches, three jumps, dashes and Stand follow", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("/");
  await page.locator("#training").click();
  await page.getByRole("radio", { name: "Selecionar Dio Brando" }).check();
  await page.locator("#fight").click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "fight");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-character", "dio");
  const step = async (count = 1) =>
    page.clock.runFor((count * 1000) / 60 + 0.05);
  const snapshots = [];
  for (const key of ["d", "a"]) {
    await page.keyboard.down(key);
    await step(50);
    await expect(canvas).toHaveAttribute(
      "data-animation",
      key === "d" ? "walkForward" : "walkBack",
    );
    await expect(canvas).toHaveAttribute(
      "data-companion-clip",
      key === "d" ? "followForward" : "followBackward",
    );
    await save(canvas, `${qa}/game-${key === "d" ? "forward" : "back"}.png`);
    await page.keyboard.up(key);
    await step(2);
  }
  for (let i = 0; i < 12; i++) {
    const k = i % 2 ? "a" : "d";
    await page.keyboard.down(k);
    await step(3);
    await page.keyboard.up(k);
  }
  for (const held of [3, 8, 20]) {
    await page.keyboard.down("s");
    await step(held);
    await page.keyboard.up("s");
    await step(12);
    await expect(canvas).toHaveAttribute("data-animation", "idle");
  }
  for (const direction of ["", "d", "a"]) {
    if (direction) await page.keyboard.down(direction);
    await page.keyboard.press("w");
    const phases = new Set();
    for (let i = 0; i < 65; i++) {
      await step();
      const s = await canvas.evaluate((c) => ({ ...c.dataset }));
      phases.add(s.animation);
      snapshots.push(s);
      if (s.animation === "landing") expect(Number(s.rootY)).toBe(580);
      if (Number(s.rootY) < 580) {
        expect(Number(s.companionY)).toBeLessThan(Number(s.rootY) - 7);
        expect(s.companionClip).toBe("jumpFollow");
      }
      if (s.animation.startsWith("jumpApex"))
        await save(canvas, `${qa}/game-jump-${direction || "neutral"}.png`);
    }
    if (direction) await page.keyboard.up(direction);
    const suffix =
      direction === "d" ? "Forward" : direction === "a" ? "Backward" : "";
    for (const phase of ["jumpRise", "jumpApex", "jumpFall"])
      expect(phases.has(phase + suffix), phase + suffix).toBe(true);
    expect(phases.has("landing")).toBe(true);
    await step(12);
  }
  for (const key of ["d", "a"]) {
    await page.keyboard.down("Shift");
    await page.keyboard.down(key);
    await step(5);
    await expect(canvas).toHaveAttribute(
      "data-animation",
      key === "d" ? "dashForward" : "backdash",
    );
    await page.keyboard.up(key);
    await page.keyboard.up("Shift");
    await step(20);
    await expect(canvas).toHaveAttribute("data-animation", "idle");
  }
  await step(30);
  await expect(canvas).toHaveAttribute("data-companion-depth", "0");
  fs.writeFileSync(`${qa}/game-trace.json`, JSON.stringify(snapshots, null, 2));
  await save(canvas, `${qa}/game-neutral.png`);
  expect(errors).toEqual([]);
});

test("normal attack combos still work and Stand returns after the revised locomotion", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/art/dio-combat.html");
  const canvas = page.locator("#arena");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  for (const [name, count] of [
    ["groundCombo", "3"],
    ["airCombo", "5"],
  ]) {
    await page.selectOption("#scenario", name);
    await page.locator("#run").click();
    await page.clock.runFor(5500);
    await expect(canvas).toHaveAttribute("data-done", "true");
    await expect(canvas).toHaveAttribute("data-max-combo", count);
    await expect(canvas).toHaveAttribute("data-stand-mode", "follow");
    await save(canvas, `${qa}/${name}-returned.png`);
  }
  await expect(page.locator("#error")).toBeEmpty();
});
