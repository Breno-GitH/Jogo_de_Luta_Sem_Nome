import { expect, test } from "@playwright/test";

const motions = {
  bigChill: ["frostBreath", "iceDive", "ghostFlight"],
  ghostfreak: ["ghostCross", "spectralArms", "ghostPhase"],
  nrg: ["thermal", "nuclear", "nrgUnseal"],
  nrgReleased: ["radiantShot", "radiantWave", "nrgSeal"],
};

test("Stage 6 fights Samurai from the main menu and executes every command", async ({ page }, info) => {
  test.setTimeout(330000);
  const errors = [], assets = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    if (response.url().includes("/sprites/ben/") && !response.ok()) assets.push(response.url());
  });
  await page.goto(process.env.BEN_REFORM_URL ?? "./");
  await page.click("#training");
  await page.check('input[name="character"][value="ben"]');
  await page.click("#confirm-character");
  await page.check('input[name="opponent"][value="samurai"]');
  await page.click("#confirm-character");
  await page.click("#fight");
  const arena = page.locator("canvas");
  await expect(arena).toHaveAttribute("data-omnitrix-form", "human", { timeout: 45000 });
  await page.locator("#infinite-health").uncheck();
  const idle = () => expect(arena).toHaveAttribute("data-physics-state", "idle");
  const health = async () => Number(await arena.getAttribute("data-p2-health"));
  async function choose(id) {
    await idle();
    const active = await arena.getAttribute("data-omnitrix-form");
    for (let i = 0; i < 11; i++) {
      const selected = await arena.getAttribute("data-omnitrix-selection");
      if (selected === id) break;
      await page.keyboard.press("l");
      await expect(arena).not.toHaveAttribute("data-omnitrix-selection", selected);
      await expect(arena).toHaveAttribute("data-omnitrix-form", active);
    }
    await expect(arena).toHaveAttribute("data-omnitrix-selection", id);
    await page.keyboard.down("l");
    await expect(arena).toHaveAttribute("data-omnitrix-form", id);
    await page.keyboard.up("l");
    await expect(arena).toHaveAttribute("data-omnitrix-selection", id);
    await expect(arena).toHaveAttribute("data-omnitrix-sheet", new RegExp(`ben/${id}/stage6-`));
  }
  async function approach(limit = 80) {
    const distance = () => arena.evaluate(c => +c.dataset.rivalX - +c.dataset.rootX);
    const gap = await distance();
    if (Math.abs(gap) <= limit) return;
    const key = gap < 0 ? "a" : "d";
    await page.keyboard.down(key);
    try { await expect.poll(async () => Math.abs(await distance())).toBeLessThanOrEqual(limit); }
    finally { await page.keyboard.up(key); }
    await idle();
  }
  async function move(id, play) {
    await idle();
    await play();
    await expect(arena).toHaveAttribute("data-move", id);
    await expect(arena).toHaveAttribute("data-animation", new RegExp(`^${id}(Air)?$`));
    await idle();
  }
  async function motion(family, key) {
    const forward = (await arena.getAttribute("data-omnitrix-facing")) === "-1" ? "a" : "d";
    const end = family === 0 ? forward : forward === "a" ? "d" : "a";
    await page.keyboard.press("s", { delay: 50 });
    if (family === 2) {
      await page.waitForTimeout(48);
      await page.keyboard.down("s");
      await page.keyboard.press(key, { delay: 45 });
      await page.keyboard.up("s");
    } else {
      await page.keyboard.down(end);
      await page.keyboard.press(key, { delay: 48 });
      await page.keyboard.up(end);
    }
  }
  async function normals(beforeMove = async () => {}) {
    for (const [key, strength] of [["j", "light"], ["k", "medium"]]) {
      await beforeMove();
      await move("stand_" + strength, () => page.keyboard.press(key, { delay: 35 }));
      await beforeMove();
      await move("crouch_" + strength, async () => {
        await page.keyboard.down("s");
        await page.keyboard.press(key, { delay: 35 });
        await page.keyboard.up("s");
      });
      await beforeMove();
      await move("air_" + strength, async () => {
        await page.keyboard.press("w");
        await expect.poll(async () => Number(await arena.getAttribute("data-root-y"))).toBeLessThan(552);
        await page.keyboard.press(key, { delay: 32 });
      });
    }
    await beforeMove();
    await approach(78);
    await beforeMove();
    await move("throw", () => page.keyboard.press("u", { delay: 38 }));
  }
  async function specials(id, ignore = [], beforeMove = async () => {}) {
    for (let family = 0; family < 3; family++) for (const [key, strength] of [["j", "light"], ["k", "medium"]]) {
      const idMove = motions[id][family] + "_" + strength;
      if (ignore.includes(idMove)) continue;
      if (idMove === "ghostPhase_medium") await page.waitForTimeout(1450);
      await beforeMove();
      await move(idMove, () => motion(family, key));
    }
  }
  for (const form of ["bigChill", "ghostfreak", "nrg"]) {
    await choose(form);
    await page.click("#refill-health");
    await approach();
    const before = await health();
    await move("stand_light", () => page.keyboard.press("j", { delay: 35 }));
    expect(await health()).toBeLessThan(before);
    await page.locator("#dummy").selectOption("guard");
    await approach();
    const blocked = await health();
    await move("stand_light", () => page.keyboard.press("j", { delay: 35 }));
    expect(await health()).toBe(blocked);
    await page.locator("#dummy").selectOption("idle");
    await normals();
    await specials(form, ["nrgUnseal_light"]);
    await arena.screenshot({ path: info.outputPath(form + ".png") });
  }

  await page.click("#refill-health");
  await motion(2, "j");
  await expect(arena).toHaveAttribute("data-move", "nrgUnseal_light");
  await expect(arena).toHaveAttribute("data-nrg-mode", "released");
  await expect(arena).toHaveAttribute("data-omnitrix-form", "nrg");
  await expect(arena).toHaveAttribute("data-omnitrix-sheet", /ben\x2fnrgReleased\x2fstage6-/);
  await idle();
  await approach();
  const before = await health();
  await move("stand_light", () => page.keyboard.press("j", { delay: 35 }));
  expect(await health()).toBeLessThan(before);
  async function ensureReleased() {
    if (Number(await arena.getAttribute("data-nrg-ticks")) >= 125) return;
    await expect(arena).toHaveAttribute("data-nrg-mode", "contained", { timeout: 12000 });
    await expect(arena).toHaveAttribute("data-nrg-cooldown", "0", { timeout: 12000 });
    await idle();
    await motion(2, "j");
    await expect(arena).toHaveAttribute("data-nrg-mode", "released");
    await idle();
  }
  await normals(ensureReleased);
  await specials("nrgReleased", ["nrgSeal_medium"], ensureReleased);
  await ensureReleased();
  await motion(2, "k");
  await expect(arena).toHaveAttribute("data-move", "nrgSeal_medium");
  await expect(arena).toHaveAttribute("data-nrg-mode", "contained");
  await idle();
  await choose("ghostfreak");
  await choose("bigChill");
  expect(errors).toEqual([]);
  expect(assets).toEqual([]);
});

