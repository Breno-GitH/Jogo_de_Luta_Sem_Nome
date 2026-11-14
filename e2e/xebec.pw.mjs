import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

async function captureAt(page, info, label, conditions) {
  const frame = await page.waitForFunction(expected => {
    const canvas = document.querySelector("canvas");
    const d = canvas.dataset;
    return Object.entries(expected).every(([key, value]) =>
      typeof value === "number" ? Number(d[key]) >= value : d[key] === value)
      ? canvas.toDataURL() : null;
  }, conditions, { timeout: 7500 });
  const data = await frame.jsonValue();
  await writeFile(info.outputPath(label + ".png"), Buffer.from(data.split(",")[1], "base64"));
}

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
  await canvas.click();
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

async function pandemoniumTest({ page }, info) {
  test.setTimeout(110000);
  const { canvas, failures } = await start(page, "training");
  if (info.title.endsWith("without Haki FX")) await page.locator("#xebec-fx").uncheck();
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
  await distance(page, 85);
  await page.keyboard.press("w", { delay: 40 });
  await expect(canvas).toHaveAttribute("data-animation", "jumpRise");
  await canvas.screenshot({ path: info.outputPath("xebec-jump.png") });
  await expect(canvas).toHaveAttribute("data-physics-state", "idle");

  await page.keyboard.press("s", { delay: 48 });
  await page.keyboard.down("d");
  try { await page.keyboard.press("j", { delay: 35 }); }
  finally { await page.keyboard.up("d"); }
  await expect(canvas).toHaveAttribute("data-move", "xebecFangs");
  await expect(canvas).toHaveAttribute("data-domination", "18");
  await canvas.screenshot({ path: info.outputPath("presas-eclipse.png") });
  await expect(canvas).toHaveAttribute("data-physics-state", "idle");
  await page.waitForTimeout(650);
  const hp = Number(await canvas.getAttribute("data-target-health"));
  expect(hp).toBeLessThan(1000);
  await distance(page, 110);
  await page.locator("#fill-meter").click();
  await canvas.focus();
  await page.keyboard.press("r", { delay: 36 });
  await expect(canvas).toHaveAttribute("data-capture", "pandemonium");
  await captureAt(page, info, "pandemonium-horizontal", { pandemoniumTick: 6, pandemoniumPhase: "horizontal" });
  for (const [tick, title] of [
    [22, "diagonal"], [37, "cruzado"], [54, "ascendente"], [92, "apice"],
    [115, "preparacao"], [132, "aceleracao"], [138, "corte"], [163, "lancamento"],
    [237, "entrada-barba-branca"], [275, "barba-branca"], [345, "kaido-aereo"], [392, "linlin"],
    [413, "prometheus"], [441, "comando"], [454, "fogo"], [481, "recuo-prometheus"],
    [524, "piratas-rocks"], [558, "transicao"], [618, "portoes"], [750, "ruptura"], [849, "pose-final"],
  ]) {
    await captureAt(page, info, "pandemonium-" + title, { pandemoniumTick: tick });
    if (tick === 115) await expect(canvas).toHaveAttribute("data-target-health", String(hp));
    if (tick === 163 || tick === 481) await expect(canvas).toHaveAttribute("data-target-health", String(hp - 132));
  }
  await expect(canvas).toHaveAttribute("data-pandemonium-tick", "-1", { timeout: 24000 });
  await expect(canvas).toHaveAttribute("data-camera-zoom", "1");
  await expect(canvas).toHaveAttribute("data-meter", "0");
  await expect(canvas).toHaveAttribute("data-target-health", String(hp - 334));
  await page.keyboard.press("j");
  await expect(canvas).toHaveAttribute("data-move", "stand_light");
  expect(failures).toEqual([]);
}

test("plays Xebec in the training arena and captures Pandemonium", pandemoniumTest);
test("captures Pandemonium body movement without Haki FX", pandemoniumTest);

async function doubleDown(page, button) {
  await page.keyboard.press("s", { delay: 65 });
  await page.waitForTimeout(50);
  await page.keyboard.down("s");
  try { await page.keyboard.press(button, { delay: 40 }); }
  finally { await page.keyboard.up("s"); }
}

async function kingWillTest({ page }, info) {
  test.setTimeout(100000);
  const { canvas, failures } = await start(page, "training");
  const effects = !info.title.endsWith("without Haki FX");
  if (!effects) await page.locator("#xebec-fx").uncheck();
  const ko = info.title.endsWith("with legitimate KO");
  await page.locator("#empty-meter").click();
  await distance(page, 83);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("l", { delay: 40 });
    await expect(canvas).toHaveAttribute("data-move", "stand_heavy");
    await expect(canvas).toHaveAttribute("data-physics-state", "idle");
    await distance(page, 83);
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
  await page.keyboard.press("l", { delay: 40 });
  await expect(canvas).toHaveAttribute("data-move", "stand_heavy");
  await captureAt(page, info, "haki-normal", { move: "stand_heavy", phase: "active", xebecCharge: "full" });
  await expect(canvas).toHaveAttribute("data-physics-state", "idle");
  await distance(page, 105);
  if (ko) {
    const hp = page.locator("#health-1");
    await hp.fill("10");
    await hp.press("Tab");
    await expect(canvas).toHaveAttribute("data-target-health", "100");
  } else {
    await doubleDown(page, "j");
    await captureAt(page, info, "haki-pulso", { move: "xebecPulse", moveTick: 12 });
    await expect(canvas).toHaveAttribute("data-physics-state", "idle");
    await doubleDown(page, "k");
    await captureAt(page, info, "haki-explosao", { move: "xebecSovereign", moveTick: 24 });
    await expect(canvas).toHaveAttribute("data-domination", "100");
    await expect(canvas).toHaveAttribute("data-physics-state", "idle");
  }
  await distance(page, 185);
  await doubleDown(page, "l");
  await expect(canvas).toHaveAttribute("data-move", "xebecKingWill");
  await expect(canvas).toHaveAttribute("data-domination", "0");
  await captureAt(page, info, "haki-concentracao", { move: "xebecKingWill", moveTick: 22 });
  if (ko) {
    await captureAt(page, info, "haki-ko-resiste", { hakiReaction: "collapse", targetHealth: "0" });
    await captureAt(page, info, "haki-ko-cai", { hakiReaction: "collapse", moveTick: 19 });
  } else {
    const snapshots = await page.evaluate(async fx => {
      const canvas = document.querySelector("canvas");
      const frames = new Map([
        ["primeira-esfera", [39, "1"]], ["segunda-esfera", [47, "2"]],
        ["tres-esferas", [60, "3"]], ["dissipacao", [82, "2"]],
      ]);
      const images = {};
      const deadline = performance.now() + 6500;
      while (performance.now() < deadline && (frames.size || !images.reacao)) {
        await new Promise(requestAnimationFrame);
        const { moveTick, move, hakiReaction, kingWillFronts } = canvas.dataset;
        if (move !== "xebecKingWill") continue;
        if (!images.reacao && hakiReaction === "pressure" && Number(moveTick) >= 44)
          images.reacao = canvas.toDataURL();
        for (const [name, [tick, count]] of frames) {
          if (Number(moveTick) < tick || name !== "dissipacao" && kingWillFronts !== (fx ? count : "0")) continue;
          images[name] = canvas.toDataURL();
          frames.delete(name);
        }
      }
      return images;
    }, effects);
    expect(Object.keys(snapshots)).toEqual(expect.arrayContaining(["primeira-esfera", "segunda-esfera", "tres-esferas", "reacao", "dissipacao"]));
    for (const [label, data] of Object.entries(snapshots))
      await writeFile(info.outputPath("haki-" + label + ".png"), Buffer.from(data.split(",")[1], "base64"));
    await expect(canvas).toHaveAttribute("data-physics-state", "idle");
    await expect(canvas).toHaveAttribute("data-king-will-fronts", "0");
  }
  await expect(canvas).toHaveAttribute("data-camera-zoom", "1");
  expect(failures).toEqual([]);
}

test("keeps Haki charged until King Will", kingWillTest);
test("keeps King Will readable without Haki FX", kingWillTest);
test("shows the collapse of King Will with legitimate KO", kingWillTest);

async function ordinarySpecials({ page }, info) {
  test.setTimeout(120000);
  const effects = !info.title.endsWith("without Haki FX");
  const { canvas, failures } = await start(page, "training");
  for (const [family, commands] of [
    ["forward", ["xebecFangs", "xebecDance", "xebecCarnage"]],
    ["back", ["xebecCut", "xebecRift", "xebecTriple"]],
    ["double", ["xebecPulse", "xebecSovereign"]],
  ]) {
    for (const [i, id] of commands.entries()) {
      await page.locator("#reset-positions").click();
      if (!effects) await page.locator("#xebec-fx").uncheck();
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
      await expect(canvas).toHaveAttribute("data-phase", "active");
      await canvas.screenshot({ path: info.outputPath(id + ".png") });
      const extra = { xebecDance: [32], xebecCarnage: [49], xebecRift: [35], xebecTriple: [41, 63] }[id] ?? [];
      for (const tick of extra) {
        await page.waitForFunction(t => Number(document.querySelector("canvas").dataset.moveTick) >= t, tick);
        await canvas.screenshot({ path: info.outputPath(id + "-" + tick + ".png") });
      }
      await expect(canvas).toHaveAttribute("data-physics-state", "idle");
    }
  }
  expect(failures).toEqual([]);
}

test("runs the eight ordinary specials in Training", ordinarySpecials);
test("reads the eight ordinary specials without Haki FX", ordinarySpecials);

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
