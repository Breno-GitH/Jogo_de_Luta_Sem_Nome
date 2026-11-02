import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "art/goku/rebuild/qa/full";
fs.mkdirSync(qa, { recursive: true });
async function start(page) {
  const epoch = new Date("2026-10-31T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/goku.html");
  const c = page.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true");
  await page.clock.runFor(34);
  await c.focus();
  return c;
}
async function save(c, f) {
  fs.writeFileSync(
    f,
    Buffer.from(
      (await c.evaluate((n) => n.toDataURL("image/png"))).split(",")[1],
      "base64",
    ),
  );
}

test("compares archived and redrawn Goku, steps both ways, slows playback and stops a non-looping inspection", async ({
  page,
}) => {
  const c = await start(page);
  await page.locator("#compare").check();
  await expect(c).toHaveAttribute("data-mode", "inspect");
  await expect(c).toHaveAttribute("data-compare", "true");
  for (const key of [
    "idle",
    "walkForward",
    "walkBack",
    "crouchIdle",
    "jumpRise",
    "jumpApex",
    "jumpFall",
    "landing",
    "crouchWalkForward",
  ]) {
    await page.selectOption("#animation", key);
    await page.clock.runFor(67);
    await expect(c).toHaveAttribute("data-revision", "5");
    await expect(page.locator("#error")).toBeEmpty();
  }
  await page.selectOption("#animation", "walkForward");
  await page.locator("#pause").click();
  await page.getByRole("button", { name: "Quadro 8", exact: true }).click();
  await page.locator("#frame-prev").click();
  await expect(c).toHaveAttribute("data-frame", "6");
  await page.locator("#frame-next").click();
  await expect(c).toHaveAttribute("data-frame", "7");
  await page.selectOption("#speed", "0.25");
  await page.selectOption("#animation", "crouchStart");
  await page.locator("#repeat").uncheck();
  await page.clock.runFor(1000);
  await expect(c).toHaveAttribute("data-frame", "5");
  await expect(page.locator("#pause")).toHaveText("Reproduzir");
  await page.locator("#repeat").check();
  await page.locator("#pause").click();
  await page.clock.runFor(150);
  await page.selectOption("#animation", "walkForward");
  await page.selectOption("#zoom", "3");
  await page.clock.runFor(134);
  await save(c, `${qa}/comparison-in-game.png`);
});

test("holds a stable long idle, repeats dash/backdash and rises directly into a real step", async ({
  page,
}) => {
  const c = await start(page);
  const x = await c.getAttribute("data-player-x");
  await page.clock.runFor(6500);
  await expect(c).toHaveAttribute("data-animation", "idle");
  await expect(c).toHaveAttribute("data-player-x", x);
  await expect(c).toHaveAttribute("data-root-y", "580");
  for (let n = 0; n < 3; n++)
    for (const key of ["d", "a"]) {
      await page.keyboard.down("Shift");
      await page.keyboard.down(key);
      await page.clock.runFor(34);
      await expect(c).toHaveAttribute(
        "data-animation",
        key === "d" ? "dashForward" : "backdash",
      );
      await page.keyboard.up(key);
      await page.keyboard.up("Shift");
      await page.clock.runFor(400);
      await expect(c).toHaveAttribute("data-animation", "idle");
    }
  for (const key of ["d", "a"]) {
    await page.keyboard.down("s");
    await page.clock.runFor(300);
    await page.keyboard.up("s");
    await page.keyboard.down(key);
    await page.clock.runFor(34);
    await expect(c).toHaveAttribute(
      "data-animation",
      key === "d" ? "crouchWalkForward" : "crouchWalkBack",
    );
    await page.clock.runFor(220);
    await expect(c).toHaveAttribute(
      "data-animation",
      key === "d" ? "walkForward" : "walkBack",
    );
    await page.keyboard.up(key);
    await page.clock.runFor(100);
  }
});
test("all Goku movement sheets are inspectable, transparent PNGs, and support pause, stepping, speed, pivot and flip", async ({
  page,
}) => {
  const c = await start(page),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const manifest = JSON.parse(
    fs.readFileSync("public/sprites/goku/movement.json", "utf8"),
  );
  const results = [];
  for (const [key, clip] of Object.entries(manifest.clips)) {
    if (clip.internal) continue;
    await page.selectOption("#animation", key);
    await page
      .getByRole("button", { name: `Quadro ${clip.count}`, exact: true })
      .click();
    await expect(c).toHaveAttribute("data-frame", String(clip.count - 1));
    await expect(c).toHaveAttribute("data-smoothing", "false");
    await expect(c).toHaveAttribute("data-mode", "inspect");
    const tick = await c.getAttribute("data-preview-tick");
    await page.clock.runFor(100);
    await expect(c).toHaveAttribute("data-preview-tick", tick);
    results.push({ key, count: clip.count });
  }
  await page.selectOption("#animation", "crouchIdle");
  await page.selectOption("#zoom", "4");
  await page.locator("#boxes").check();
  await save(c, `${qa}/crouch-inspection.png`);
  await page.locator("#flip").click();
  await expect(c).toHaveAttribute("data-facing", "-1");
  await page.locator("#frame-next").click();
  await page.locator("#step").click();
  await expect(page.locator("#error")).toBeEmpty();
  expect(errors).toEqual([]);
  expect(
    (await page.request.get("/downloads/goku-movement.zip")).status(),
  ).toBe(200);
  fs.writeFileSync(`${qa}/inspection.json`, JSON.stringify(results, null, 2));
});
test("live Goku walks forward and backward, reverses, crouches repeatedly, dashes and jumps in all directions", async ({
  page,
}) => {
  const c = await start(page),
    seen = new Set();
  for (const key of ["d", "a", "d", "a"]) {
    await page.keyboard.down(key);
    await page.clock.runFor(170);
    seen.add(await c.getAttribute("data-animation"));
    await page.keyboard.up(key);
    await page.clock.runFor(50);
  }
  expect(seen).toContain("walkForward");
  expect(seen).toContain("walkBack");
  for (let n = 0; n < 3; n++) {
    await page.keyboard.down("s");
    await page.clock.runFor(34);
    await expect(c).toHaveAttribute("data-animation", "crouchStart");
    await page.clock.runFor(130);
    await expect(c).toHaveAttribute("data-animation", "crouchIdle");
    await page.keyboard.up("s");
    await page.clock.runFor(34);
    await expect(c).toHaveAttribute("data-animation", "crouchEnd");
    await page.clock.runFor(150);
    await expect(c).toHaveAttribute("data-animation", "idle");
  }
  for (const dir of ["d", "a"]) {
    await page.keyboard.down("Shift");
    await page.keyboard.down(dir);
    await page.clock.runFor(34);
    await expect(c).toHaveAttribute(
      "data-animation",
      dir === "d" ? "dashForward" : "backdash",
    );
    await page.keyboard.up(dir);
    await page.keyboard.up("Shift");
    await page.clock.runFor(400);
    await expect(c).toHaveAttribute("data-animation", "idle");
  }
  for (const dir of ["", "d", "a"]) {
    if (dir) await page.keyboard.down(dir);
    await page.keyboard.press("w");
    await page.clock.runFor(34);
    await expect(c).toHaveAttribute("data-animation", "jumpStart");
    await page.clock.runFor(220);
    await expect(c).toHaveAttribute("data-root-y", /^(?!580$)/);
    expect(await c.getAttribute("data-animation")).toContain("jumpRise");
    await save(c, `${qa}/jump-${dir || "neutral"}.png`);
    await page.clock.runFor(1100);
    if (dir) await page.keyboard.up(dir);
    await page.clock.runFor(50);
    await expect(c).toHaveAttribute("data-root-y", "580");
    await expect(c).toHaveAttribute("data-vy", "0");
    await page.clock.runFor(150);
    await expect(c).toHaveAttribute("data-animation", "idle");
  }
  await page.locator("#flip").click();
  await c.focus();
  await page.keyboard.down("a");
  await page.clock.runFor(150);
  await expect(c).toHaveAttribute("data-animation", "walkForward");
  await page.keyboard.up("a");
  await expect(page.locator("#error")).toBeEmpty();
});
test("Goku remains controllable in training after promotion to local combat modes", async ({
  page,
}) => {
  const epoch = new Date("2026-10-31T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/");
  await page.locator("#versus").click();
  await expect(
    page.getByRole("radio", { name: "Selecionar Goku" }),
  ).toBeEnabled();
  await page.locator("#back").click();
  await page.locator("#training").click();
  await page.getByRole("radio", { name: "Selecionar Goku" }).check();
  await expect(page.locator("#goku-commands")).toBeVisible();
  await page.locator("#goku-commands").click();
  await save(page.locator("canvas").first(), `${qa}/menu-background.png`);
  await page.screenshot({ path: `${qa}/selection.png` });
  await page.locator("#fight").click();
  await page.clock.runFor(50);
  const c = page.locator("canvas").first();
  await expect(c).toHaveAttribute("data-character", "goku");
  await expect(c).toHaveAttribute("data-animation", "idle");
  await c.focus();
  const x = Number(await c.getAttribute("data-player-x"));
  const walkingSpeed = JSON.parse(
    fs.readFileSync("src/data/goku-movement.json", "utf8"),
  ).speed;
  await page.keyboard.down("d");
  await page.clock.runFor(300);
  await page.keyboard.up("d");
  expect(Number(await c.getAttribute("data-player-x")) - x).toBeGreaterThan(
    walkingSpeed * 15,
  );
  await page.clock.runFor(100);
  await save(c, `${qa}/main-training.png`);
  await page.keyboard.press("j");
  await page.clock.runFor(100);
  await expect(c).toHaveAttribute("data-move", "stand_light");
  await page.clock.runFor(600);
  await page.keyboard.press("r");
  await page.clock.runFor(100);
  await expect(c).toHaveAttribute("data-move", "");
  await expect(c).toHaveAttribute("data-capture", "none");
  await page.selectOption("#dummy", "bot");
  await c.focus();
  await page.clock.runFor(10000);
  await expect(c).toHaveAttribute("data-character", "goku");
  expect(await c.getAttribute("data-animation")).not.toMatch(/^dio|samurai/);
  await page.keyboard.press("Escape");
  const f = await c.getAttribute("data-root-y");
  await page.clock.runFor(1000);
  await expect(c).toHaveAttribute("data-root-y", f);
  await expect(page.locator("#app")).toHaveAttribute("data-character", "goku");
});
test("records actual engine movement through all 13 phases using real keyboard input", async ({
  page,
}) => {
  test.setTimeout(180000);
  const c = await start(page),
    dir = `${qa}/recording`;
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir))
    if (/^\d{3}\.png$/.test(f)) fs.unlinkSync(`${dir}/${f}`);
  const trace = [];
  let i = 0;
  async function capture(ticks) {
    for (let n = 0; n < ticks; n += 2) {
      await page.clock.runFor(1000 / 30 + 0.001);
      await save(c, `${dir}/${String(i++).padStart(3, "0")}.png`);
      trace.push(await c.evaluate((n) => ({ ...n.dataset })));
    }
  }
  await capture(20);
  for (const key of ["d", "a"]) {
    await page.keyboard.down(key);
    await capture(24);
    await page.keyboard.up(key);
  }
  for (const key of ["d", "a"]) {
    await page.keyboard.down("Shift");
    await page.keyboard.down(key);
    await capture(2);
    await page.keyboard.up(key);
    await page.keyboard.up("Shift");
    await capture(16);
  }
  await page.keyboard.down("s");
  await capture(12);
  await page.keyboard.up("s");
  await capture(10);
  for (const key of ["", "d", "a"]) {
    if (key) await page.keyboard.down(key);
    await page.keyboard.press("w");
    await capture(68);
    if (key) await page.keyboard.up(key);
    await capture(4);
  }
  const phases = new Set(trace.map((x) => x.animation));
  for (const key of [
    "idle",
    "walkForward",
    "walkBack",
    "dashForward",
    "backdash",
    "crouchStart",
    "crouchIdle",
    "crouchEnd",
    "jumpStart",
    "jumpRise",
    "jumpApex",
    "jumpFall",
    "landing",
  ])
    expect(
      [...phases].some((x) => x.startsWith(key)),
      key,
    ).toBe(true);
  fs.writeFileSync(`${qa}/trace.json`, JSON.stringify(trace, null, 2));
});
