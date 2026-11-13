import { expect, test } from "@playwright/test";

async function launch(page, mode) {
  await page.goto("./");
  await page.click("#" + mode);
  await page.getByRole("radio", { name: "Selecionar Ben Tennyson" }).check();
  await page.click("#confirm-character");
  if (mode !== "arcade") {
    await page.getByRole("radio", { name: "Selecionar Samurai" }).check();
    await page.click("#confirm-character");
  }
  await page.click("#fight");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-match-phase", "fight", {
    timeout: 45000,
  });
  await canvas.focus();
  return canvas;
}

async function transform(page, canvas, form) {
  const before = await canvas.getAttribute("data-omnitrix-form");
  for (let i = 0; i < 11; i++) {
    const selection = await canvas.getAttribute("data-omnitrix-selection");
    if (selection === form) break;
    await page.keyboard.press("l", { delay: 33 });
    await expect(canvas).not.toHaveAttribute(
      "data-omnitrix-selection",
      selection,
    );
    await expect(canvas).toHaveAttribute("data-omnitrix-form", before);
  }
  await page.keyboard.down("l");
  try {
    await expect(canvas).toHaveAttribute("data-omnitrix-form", form);
  } finally {
    await page.keyboard.up("l");
  }
  await expect(canvas).toHaveAttribute("data-omnitrix-selection", form);
}

test("renders all eleven Omnitrix portraits and separates the selected and active forms", async ({
  page,
}, info) => {
  test.setTimeout(70000);
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      if (
        source instanceof HTMLImageElement &&
        source.src.includes("/ben/omnitrix/")
      ) {
        window.lastPortrait = source.src.split("/").at(-1);
      }
      return original.call(this, source, ...args);
    };
  });
  const c = await launch(page, "training");
  const ids = [
    "xlr8",
    "fourArms",
    "feedback",
    "gravattack",
    "ghostfreak",
    "bigChill",
    "nrg",
    "diamondhead",
    "echoEcho",
    "heatblast",
    "humungousaur",
  ];
  for (const [index, id] of ids.entries()) {
    await expect(c).toHaveAttribute("data-omnitrix-selection", id);
    await expect(c).toHaveAttribute("data-omnitrix-form", "human");
    await expect
      .poll(() => page.evaluate(() => window.lastPortrait))
      .toBe(id + ".png");
    if ([0, 4, 6, 10].includes(index))
      await c.screenshot({ path: info.outputPath("omnitrix-" + id + ".png") });
    await page.keyboard.press("l", { delay: 35 });
  }
  await expect(c).toHaveAttribute("data-omnitrix-selection", "xlr8");
  await transform(page, c, "xlr8");
  await page.keyboard.press("l", { delay: 35 });
  await expect(c).toHaveAttribute("data-omnitrix-selection", "fourArms");
  await expect(c).toHaveAttribute("data-omnitrix-form", "xlr8");
  await c.screenshot({
    path: info.outputPath("omnitrix-selected-vs-active.png"),
  });
});

test("plays Ben, NRG and a confirmed Alien X in production training", async ({
  page,
}, info) => {
  test.setTimeout(80000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const c = await launch(page, "training");
  await page.locator("#infinite-health").uncheck();
  await page.locator("#unlimited-meter").uncheck();
  await page.click("#fill-meter");
  await c.focus();
  await page.keyboard.press("r");
  await expect(c).toHaveAttribute("data-move", "alienX");
  await expect(c).toHaveAttribute("data-physics-state", "idle");
  await expect(c).toHaveAttribute("data-meter", "0");
  await expect(c).toHaveAttribute("data-alien-x-phase", "");

  await page.keyboard.down("d");
  await expect(c).toHaveAttribute("data-animation", "walkForward");
  await expect(c).toHaveAttribute(
    "data-omnitrix-sheet",
    "ben/human-motion.png",
  );
  await page.keyboard.up("d");
  await transform(page, c, "nrg");
  for (const [key, clip] of [
    ["a", "walkBack"],
    ["d", "walkForward"],
  ]) {
    await page.keyboard.down(key);
    await expect(c).toHaveAttribute("data-animation", clip);
    await expect(c).toHaveAttribute(
      "data-omnitrix-sheet",
      "ben/nrg/walk-final.png",
    );
    await c.screenshot({ path: info.outputPath("nrg-" + clip + ".png") });
    await page.keyboard.up(key);
  }

  await page.keyboard.down("d");
  try {
    await page.waitForFunction(() => {
      const d = document.querySelector("canvas").dataset;
      return Math.abs(Number(d.rivalX) - Number(d.rootX)) <= 125;
    });
  } finally {
    await page.keyboard.up("d");
  }
  await page.click("#fill-meter");
  await c.focus();
  const health = Number(await c.getAttribute("data-target-health"));
  await page.keyboard.press("r");
  await expect(c).toHaveAttribute("data-alien-x-phase", "watch");
  await expect(c).toHaveAttribute(
    "data-omnitrix-sheet",
    "ben/human-motion.png",
  );
  await page.waitForFunction(
    () => Number(document.querySelector("canvas").dataset.alienXTick) >= 15,
  );
  await c.screenshot({ path: info.outputPath("alien-x-omnitrix.png") });
  await expect(c).toHaveAttribute("data-alien-x-phase", "reveal");
  await expect(c).toHaveAttribute("data-omnitrix-sheet", "ben/alien-x.png");
  await expect(c).toHaveAttribute("data-alien-x-visual", "void");
  await expect(c).toHaveAttribute("data-alien-x-visual", "council");
  await page.waitForFunction(
    () => Number(document.querySelector("canvas").dataset.alienXTick) >= 136,
  );
  await c.screenshot({ path: info.outputPath("alien-x-conselho.png") });
  await expect(c).toHaveAttribute("data-alien-x-visual", "collapse");
  await expect(c).toHaveAttribute("data-alien-x-visual", "genesis");
  await c.screenshot({ path: info.outputPath("alien-x-big-bang.png") });
  await expect(c).toHaveAttribute("data-alien-x-visual", "rebuild");
  await c.screenshot({ path: info.outputPath("alien-x-recriacao.png") });
  await expect(c).toHaveAttribute("data-alien-x-phase", "");
  await expect(c).toHaveAttribute("data-omnitrix-form", "human");
  await expect(c).toHaveAttribute("data-meter", "0");
  await expect(c).toHaveAttribute("data-camera-zoom", "1");
  await page.keyboard.press("j");
  await expect(c).toHaveAttribute("data-physics-state", "attack");
  expect(Number(await c.getAttribute("data-target-health"))).toBe(health - 335);
  expect(errors).toEqual([]);
});

for (const mode of ["arcade", "versus"]) {
  test("selects Ben and fights in " + mode, async ({ page }) => {
    test.setTimeout(65000);
    const c = await launch(page, mode);
    const form = mode === "arcade" ? "echoEcho" : "xlr8";
    await transform(page, c, form);
    await page.keyboard.down("d");
    try {
      await expect(c).toHaveAttribute("data-animation", "walkForward");
    } finally {
      await page.keyboard.up("d");
    }
    await page.keyboard.press("j");
    await expect(c).toHaveAttribute(
      "data-omnitrix-sheet",
      mode === "arcade" ? "ben/echoEcho/stage7.png" : "ben/xlr8/idle.png",
    );
  });
}
