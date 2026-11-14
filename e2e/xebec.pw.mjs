import { expect, test } from "@playwright/test";

async function start(page, mode, opponent = "Samurai") {
  const failures = [];
  page.on("pageerror", error => failures.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400 && response.url().includes("/sprites/xebec/")) failures.push(response.url());
  });
  const response = await page.goto("./", { waitUntil: "domcontentloaded", timeout: 35000 });
  expect(response?.status()).toBe(200);
  await page.locator("#" + mode).click();
  await page.getByRole("radio", { name: "Selecionar Rocks D. Xebec" }).check();
  await page.locator("#confirm-character").click();
  if (mode !== "arcade") {
    await page.getByRole("radio", { name: "Selecionar " + opponent }).check();
    await page.locator("#confirm-character").click();
  }
  await page.locator("#fight").click();
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-match-phase", "fight", { timeout: 45000 });
  await canvas.focus();
  // Give the newly mounted match its first input-enabled frame.
  await page.waitForTimeout(150);
  return { canvas, failures };
}
async function distance(page, max) {
  const state = await page.locator("canvas").evaluate(c => {
    const delta = Number(c.dataset.rivalX) - Number(c.dataset.rootX);
    return { gap: Math.abs(delta), key: delta < 0 ? "a" : "d" };
  });
  if (state.gap <= max) return;
  await page.locator("canvas").focus();
  await page.keyboard.down(state.key);
  try {
    await page.waitForFunction(max => {
      const d = document.querySelector("canvas").dataset;
      return Math.abs(Number(d.rivalX) - Number(d.rootX)) <= max;
    }, max, { timeout: 4500 });
  } finally { await page.keyboard.up(state.key); }
}

test("plays Xebec in the training arena and captures Pandemonium", async ({ page }, info) => {
  test.setTimeout(85000);
  const { canvas, failures } = await start(page, "training");
  await page.locator("#infinite-health").uncheck();
  await page.locator("#unlimited-meter").uncheck();
  await page.locator("#fill-meter").click();
  await canvas.focus();
  await page.keyboard.press("r", { delay: 40 });
  await expect(canvas).toHaveAttribute("data-move", "pandemonium");
  await expect(canvas).toHaveAttribute("data-physics-state", "idle");
  await expect(canvas).toHaveAttribute("data-meter", "0");
  await expect(canvas).toHaveAttribute("data-pandemonium-tick", "-1");

  await canvas.screenshot({ path: info.outputPath("xebec-samurai.png") });
  await page.keyboard.down("a");
  await expect(canvas).toHaveAttribute("data-animation", "walkBack");
  await page.keyboard.up("a");
  await distance(page, 120);
  await page.keyboard.press("w", { delay: 40 });
  await expect(canvas).toHaveAttribute("data-animation", "jumpRise");
  await canvas.screenshot({ path: info.outputPath("xebec-jump.png") });
  await expect(canvas).toHaveAttribute("data-physics-state", "idle");

  await page.keyboard.press("s", { delay: 48 });
  await page.keyboard.down("d");
  try { await page.keyboard.press("j", { delay: 35 }); }
  finally { await page.keyboard.up("d"); }
  await expect(canvas).toHaveAttribute("data-move", "xebecThrust");
  await expect(canvas).toHaveAttribute("data-domination", "18");
  await canvas.screenshot({ path: info.outputPath("estocada-relampago.png") });
  await expect(canvas).toHaveAttribute("data-physics-state", "idle");
  await page.waitForTimeout(650);
  const hp = Number(await canvas.getAttribute("data-target-health"));
  expect(hp).toBeLessThan(1000);
  await page.locator("#fill-meter").click();
  await canvas.focus();
  await page.keyboard.press("r", { delay: 36 });
  await expect(canvas).toHaveAttribute("data-capture", "pandemonium");
  const frameAt = tick => page.waitForFunction(t => Number(document.querySelector("canvas").dataset.pandemoniumTick) >= t, tick);
  await frameAt(61);
  await expect(canvas).toHaveAttribute("data-target-health", String(hp));
  await canvas.screenshot({ path: info.outputPath("pandemonium-sorriso.png") });
  for (const [tick, title] of [[156, "preparacao"], [199, "corte"], [389, "rocks"],
    [461, "portoes"], [588, "ruptura"], [690, "pose-final"]]) {
    await frameAt(tick);
    await canvas.screenshot({ path: info.outputPath("pandemonium-" + title + ".png") });
  }
  await expect(canvas).toHaveAttribute("data-pandemonium-tick", "-1", { timeout: 24000 });
  await expect(canvas).toHaveAttribute("data-camera-zoom", "1");
  await expect(canvas).toHaveAttribute("data-meter", "0");
  await expect(canvas).toHaveAttribute("data-target-health", String(hp - 334));
  await page.keyboard.press("j");
  await expect(canvas).toHaveAttribute("data-move", "stand_light");
  expect(failures).toEqual([]);
});

test("shows persistent Haki and spends it on a J special", async ({ page }, info) => {
  test.setTimeout(100000);
  const { canvas, failures } = await start(page, "training");
  await distance(page, 76);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("l", { delay: 40 });
    await expect(canvas).toHaveAttribute("data-move", "stand_heavy");
    await expect(canvas).toHaveAttribute("data-physics-state", "idle");
    await distance(page, 76);
  }
  // Six normal L strikes are 84 points. A connected special fills the rest.
  await page.keyboard.press("s", { delay: 44 });
  const back = await canvas.evaluate(c => Number(c.dataset.rootX) < Number(c.dataset.rivalX) ? "a" : "d");
  await page.keyboard.down(back);
  try { await page.keyboard.press("j", { delay: 35 }); }
  finally { await page.keyboard.up(back); }
  await expect(canvas).toHaveAttribute("data-xebec-charge", "full");
  await expect(canvas).toHaveAttribute("data-physics-state", "idle");
  await canvas.screenshot({ path: info.outputPath("haki-idle.png") });
  await page.keyboard.down(back);
  await expect(canvas).toHaveAttribute("data-animation", "walkBack");
  await canvas.screenshot({ path: info.outputPath("haki-recuo.png") });
  await page.keyboard.up(back);
  await page.keyboard.press("w");
  await expect(canvas).toHaveAttribute("data-animation", "jumpRise");
  await expect(canvas).toHaveAttribute("data-xebec-charge", "full");
  await canvas.screenshot({ path: info.outputPath("haki-salto.png") });
  await expect(canvas).toHaveAttribute("data-physics-state", "idle");
  await page.keyboard.press("s", { delay: 46 });
  await page.waitForTimeout(48);
  await page.keyboard.down("s");
  try { await page.keyboard.press("j", { delay: 40 }); }
  finally { await page.keyboard.up("s"); }
  await expect(canvas).toHaveAttribute("data-move", "xebecBrutal");
  await expect(canvas).toHaveAttribute("data-domination", "0");
  expect(failures).toEqual([]);
});

test("runs all nine new specials in Training", async ({ page }, info) => {
  test.setTimeout(120000);
  const { canvas, failures } = await start(page, "training");
  for (const [family, commands] of [
    ["forward", ["xebecThrust", "xebecAscension", "xebecGatebreaker"]],
    ["back", ["xebecCut", "xebecRift", "xebecTriple"]],
    ["double", ["xebecBrutal", "xebecDominion", "xebecExplosion"]],
  ]) {
    for (const [i, id] of commands.entries()) {
      await page.locator("#reset-positions").click();
      await canvas.focus();
      await expect(canvas).toHaveAttribute("data-physics-state", "idle");
      if (family !== "back" || i === 0) await distance(page, 70);
      await page.keyboard.down("s");
      await page.waitForTimeout(65);
      const horizontal = family === "forward" ? "d" : "a";
      if (family !== "double") await page.keyboard.down(horizontal);
      await page.keyboard.up("s");
      await page.waitForTimeout(50);
      if (family === "double") await page.keyboard.down("s");
      try { await page.keyboard.press(["j", "k", "l"][i], { delay: 40 }); }
      finally { await page.keyboard.up(family === "double" ? "s" : horizontal); }
      await expect(canvas).toHaveAttribute("data-move", id);
      if (family === "double")
        await expect(canvas).toHaveAttribute("data-physics-state", "grabbing");
      else
        await expect(canvas).toHaveAttribute("data-phase", "active");
      await canvas.screenshot({ path: info.outputPath(id + ".png") });
      await expect(canvas).toHaveAttribute("data-physics-state", "idle");
    }
  }
  expect(failures).toEqual([]);
});

for (const [mode, opponent] of [["arcade", "Samurai"], ["versus", "Dio"], ["training", "Goku"]]) {
  test("Xebec loads and moves in " + mode + " against " + opponent, async ({ page }, info) => {
    test.setTimeout(60000);
    const { canvas, failures } = await start(page, mode, opponent);
    await page.keyboard.down("d");
    await expect(canvas).toHaveAttribute("data-animation", "walkForward");
    await page.keyboard.up("d");
    await page.keyboard.press("j", { delay: 35 });
    await expect(canvas).toHaveAttribute("data-move", "stand_light");
    await canvas.screenshot({ path: info.outputPath("xebec-" + opponent.toLowerCase() + "-arena.png") });
    expect(failures).toEqual([]);
  });
}
