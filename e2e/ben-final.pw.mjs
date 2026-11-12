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
  await expect(canvas).toHaveAttribute("data-match-phase", "fight", { timeout: 45000 });
  await canvas.focus();
  return canvas;
}

async function transform(page, canvas, form) {
  const before = await canvas.getAttribute("data-omnitrix-form");
  for (let i = 0; i < 11; i++) {
    const selection = await canvas.getAttribute("data-omnitrix-selection");
    if (selection === form) break;
    await page.keyboard.press("l", { delay: 33 });
    await expect(canvas).not.toHaveAttribute("data-omnitrix-selection", selection);
    await expect(canvas).toHaveAttribute("data-omnitrix-form", before);
  }
  await page.keyboard.down("l");
  try { await expect(canvas).toHaveAttribute("data-omnitrix-form", form); }
  finally { await page.keyboard.up("l"); }
  await expect(canvas).toHaveAttribute("data-omnitrix-selection", form);
}

test("plays Ben, NRG and a confirmed Alien X in production training", async ({ page }, info) => {
  test.setTimeout(80000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
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
  await expect(c).toHaveAttribute("data-omnitrix-sheet", "ben/human-motion.png");
  await page.keyboard.up("d");
  await transform(page, c, "nrg");
  for (const [key, clip] of [["a", "walkBack"], ["d", "walkForward"]]) {
    await page.keyboard.down(key);
    await expect(c).toHaveAttribute("data-animation", clip);
    await expect(c).toHaveAttribute("data-omnitrix-sheet", "ben/nrg/walk-final.png");
    await c.screenshot({ path: info.outputPath("nrg-" + clip + ".png") });
    await page.keyboard.up(key);
  }

  await page.keyboard.down("d");
  try {
    await page.waitForFunction(() => {
      const d = document.querySelector("canvas").dataset;
      return Math.abs(Number(d.rivalX) - Number(d.rootX)) <= 125;
    });
  } finally { await page.keyboard.up("d"); }
  await page.click("#fill-meter");
  await c.focus();
  const health = Number(await c.getAttribute("data-target-health"));
  await page.keyboard.press("r");
  await expect(c).toHaveAttribute("data-alien-x-phase", "watch");
  await expect(c).toHaveAttribute("data-omnitrix-sheet", "ben/human-motion.png");
  await expect(c).toHaveAttribute("data-alien-x-phase", "reveal");
  await expect(c).toHaveAttribute("data-omnitrix-sheet", "ben/alien-x.png");
  await expect(c).toHaveAttribute("data-alien-x-phase", "grasp");
  await c.screenshot({ path: info.outputPath("alien-x-dimensao.png") });
  await expect(c).toHaveAttribute("data-alien-x-phase", "");
  await expect(c).toHaveAttribute("data-omnitrix-form", "human");
  await expect(c).toHaveAttribute("data-meter", "0");
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
    } finally { await page.keyboard.up("d"); }
    await page.keyboard.press("j");
    await expect(c).toHaveAttribute("data-omnitrix-sheet", mode === "arcade" ? "ben/echoEcho/stage7.png" : "ben/xlr8/idle.png");
  });
}

