import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "art/dio/qa/specials";
fs.mkdirSync(qa, { recursive: true });
async function start(page) {
  const epoch = new Date("2026-10-30T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/dio-specials.html");
  const c = page.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true");
  return c;
}
async function fresh(page, scenario, enemy = "samurai", mirror = false) {
  await page.selectOption("#scenario", scenario);
  await page.selectOption("#opponent", enemy);
  await page.locator("#mirror").setChecked(mirror);
  await page.locator("#reset").click();
}
async function save(c, file) {
  fs.writeFileSync(
    file,
    Buffer.from(
      (await c.evaluate((n) => n.toDataURL("image/png"))).split(",")[1],
      "base64",
    ),
  );
}

test("all six strength variants hit both enemies in both facings with real input sequences", async ({
  page,
}) => {
  test.setTimeout(140000);
  const c = await start(page),
    results = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const enemy of ["samurai", "dio"])
    for (const mirror of [false, true])
      for (const type of ["knives", "rush"])
        for (const [strength, n] of [
          ["light", type === "knives" ? 1 : 4],
          ["medium", type === "knives" ? 2 : 7],
          ["heavy", type === "knives" ? 3 : 10],
        ]) {
          await fresh(page, `${type}_${strength}`, enemy, mirror);
          await page.locator("#execute").click();
          await page.clock.runFor(3000);
          await expect(c).toHaveAttribute("data-hits", String(n));
          await expect(c).toHaveAttribute("data-owner-stand-state", "follow");
          await expect(c).toHaveAttribute("data-projectiles", "0");
          await expect(c).toHaveAttribute("data-capture", "none");
          results.push({
            enemy,
            mirror,
            type,
            strength,
            hits: n,
            damage: await c.getAttribute("data-damage"),
          });
        }
  expect(errors).toEqual([]);
  fs.writeFileSync(
    `${qa}/browser-attacks.json`,
    JSON.stringify(results, null, 2),
  );
});

test("the actual keyboard accepts diagonals, mirrors motions and prioritises the specials", async ({
  page,
}) => {
  test.setTimeout(90000);
  const c = await start(page);
  async function motion(type, mirror, key) {
    const forward = mirror ? "a" : "d",
      back = mirror ? "d" : "a";
    if (type === "time") {
      await page.keyboard.down(forward);
      await page.clock.runFor(50);
      await page.keyboard.down("s");
      await page.clock.runFor(50);
      await page.keyboard.up(forward);
    } else {
      await page.keyboard.down("s");
      await page.clock.runFor(50);
      await page.keyboard.down(type === "rush" ? back : forward);
      await page.clock.runFor(50);
      await page.keyboard.up("s");
    }
    await page.keyboard.press(key);
    // Allow two fixed updates before releasing the last cardinal direction.
    // Playwright's 16 ms rAF cadence need not land on a 60 Hz tick at 17 ms.
    await page.clock.runFor(34);
    await page.keyboard.up("s");
    await page.keyboard.up(forward);
    await page.keyboard.up(back);
  }
  for (const mirror of [false, true])
    for (const [type, key, id] of [
      ["knives", "j", "knives_light"],
      ["rush", "k", "rush_medium"],
      ["time", "l", "time_stop"],
    ]) {
      await fresh(page, id, "dio", mirror);
      await c.focus();
      await motion(type, mirror, key);
      await expect(c).toHaveAttribute("data-move", id);
      await expect(c).toHaveAttribute("data-meter", "0");
      await page.clock.runFor(2600);
      if (type === "time") {
        await expect(c).toHaveAttribute("data-time-uses", "1");
        expect(
          Number(await c.getAttribute("data-time-cooldown")),
        ).toBeGreaterThan(1100);
      }
    }
});

test("freeze keeps the enemy and its animation still while Dio moves and the UI works", async ({
  page,
}) => {
  const c = await start(page);
  await fresh(page, "time_stop", "dio");
  await page.selectOption("#dummy", "walk");
  await page.locator("#execute").click();
  await page.clock.runFor(650);
  expect(Number(await c.getAttribute("data-time-remaining"))).toBeGreaterThan(
    80,
  );
  const before = await c.evaluate((n) => ({ ...n.dataset }));
  await c.focus();
  await page.keyboard.down("a");
  await page.clock.runFor(400);
  await page.keyboard.up("a");
  const after = await c.evaluate((n) => ({ ...n.dataset }));
  for (const key of [
    "enemyX",
    "enemyY",
    "enemyTick",
    "enemyStandTick",
    "enemyStandX",
    "targetAnimation",
    "targetFrame",
  ])
    expect(after[key], key).toBe(before[key]);
  expect(after.playerX).not.toBe(before.playerX);
  expect(Number(after.timeRemaining)).toBeLessThan(
    Number(before.timeRemaining),
  );
  await page.locator("#pause").click();
  const paused = await c.getAttribute("data-time-remaining");
  await page.clock.runFor(2000);
  await expect(c).toHaveAttribute("data-time-remaining", paused);
  await page.locator("#step").click();
  await expect(c).toHaveAttribute(
    "data-time-remaining",
    String(Number(paused) - 1),
  );
  await save(c, `${qa}/time-freeze-debug.png`);
  await page.screenshot({ path: `${qa}/specials-tool.png`, fullPage: true });
  await page.locator("#pause").click();
  await page.clock.runFor(2500);
  await expect(c).toHaveAttribute("data-temporal-owner", "-1");
});

test("knives freeze in mid-air and resume their real trajectory", async ({
  page,
}) => {
  const c = await start(page);
  await fresh(page, "frozen_knives", "dio");
  await page.locator("#execute").click();
  await page.clock.runFor(1250);
  await expect(c).toHaveAttribute("data-projectiles", "1");
  expect(Number(await c.getAttribute("data-time-remaining"))).toBeGreaterThan(
    80,
  );
  const before = await c.getAttribute("data-projectile-state");
  await page.clock.runFor(600);
  await expect(c).toHaveAttribute("data-projectile-state", before);
  await page.clock.runFor(2400);
  await expect(c).toHaveAttribute("data-projectiles", "0");
  await expect(c).toHaveAttribute("data-hits", "1");
});

test("cooldown grows, survives a round and pause, and resets only on a new match", async ({
  page,
}) => {
  const c = await start(page);
  await fresh(page, "time_stop");
  await page.locator("#cast").click();
  await page.clock.runFor(2600);
  await expect(c).toHaveAttribute("data-time-uses", "1");
  expect(Number(await c.getAttribute("data-time-cooldown"))).toBeGreaterThan(
    1100,
  );
  await page.locator("#fast-cooldown").click();
  await expect(c).toHaveAttribute("data-time-cooldown", "0");
  await expect(c).toHaveAttribute("data-time-uses", "1");
  await page.locator("#pause").click();
  await page.locator("#cast").click();
  await page.clock.runFor(2600);
  await expect(c).toHaveAttribute("data-time-uses", "2");
  const cooldown = Number(await c.getAttribute("data-time-cooldown"));
  expect(cooldown).toBeGreaterThan(1700);
  await page.locator("#round").click();
  await expect(c).toHaveAttribute("data-round", "2");
  await expect(c).toHaveAttribute("data-time-uses", "2");
  expect(
    Number(await c.getAttribute("data-time-cooldown")),
  ).toBeGreaterThanOrEqual(cooldown - 1);
  const paused = await c.getAttribute("data-time-cooldown");
  await page.clock.runFor(5000);
  await expect(c).toHaveAttribute("data-time-cooldown", paused);
  await page.locator("#reset").click();
  await expect(c).toHaveAttribute("data-time-uses", "0");
  await expect(c).toHaveAttribute("data-time-cooldown", "0");
});

test("block, a normal-to-Rush cancel and temporal damage limits work in real matches", async ({
  page,
}) => {
  const c = await start(page);
  for (const [type, blocks] of [
    ["knives_heavy", 3],
    ["rush_heavy", 10],
  ]) {
    await fresh(page, type, "dio");
    await page.selectOption("#dummy", "guard");
    await page.locator("#execute").click();
    await page.clock.runFor(3000);
    await expect(c).toHaveAttribute("data-blocks", String(blocks));
    await expect(c).toHaveAttribute("data-damage", "0");
  }
  await page.selectOption("#dummy", "idle");
  await fresh(page, "normal_rush");
  await page.locator("#execute").click();
  await page.clock.runFor(3600);
  await expect(c).toHaveAttribute("data-hits", "11");
  await fresh(page, "time_rush", "dio");
  await page.locator("#execute").click();
  await page.clock.runFor(3000);
  expect(
    Number(await c.getAttribute("data-temporal-hits")),
  ).toBeLessThanOrEqual(8);
  expect(Number(await c.getAttribute("data-temporal-hits"))).toBeGreaterThan(0);
  expect(
    Number(await c.getAttribute("data-temporal-damage")),
  ).toBeLessThanOrEqual(220);
  await expect(c).toHaveAttribute("data-owner-stand-state", "follow");
});

test("every new sheet can be inspected frame by frame and downloaded", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/art/dio.html");
  const c = page.locator("#preview");
  await expect(c).toHaveAttribute("data-loaded", "true");
  await page.selectOption("#mode", "inspect");
  for (const who of ["dio", "the-world"]) {
    await page.selectOption("#entity", who);
    const clips = JSON.parse(
      fs.readFileSync(`public/sprites/${who}/specials.json`, "utf8"),
    ).clips;
    for (const [key, clip] of Object.entries(clips)) {
      await page.selectOption("#animation", key);
      await page
        .getByRole("button", { name: `Quadro ${clip.count}`, exact: true })
        .click();
      await expect(c).toHaveAttribute("data-frame", String(clip.count - 1));
      await expect(page.locator("#download")).toHaveAttribute(
        "href",
        new RegExp(`${who}/${key}\\.png$`),
      );
      await save(c, `${qa}/${who}-${key}.png`);
    }
  }
  const response = await page.request.get("/downloads/dio-specials.zip");
  expect(response.status()).toBe(200);
  await expect(page.locator("#error")).toBeEmpty();
});

test("records a genuine Rush from command to recovery in fixed ticks", async ({
  page,
}) => {
  test.setTimeout(90000);
  const c = await start(page);
  await fresh(page, "rush_heavy");
  await page.locator("#infinite").uncheck();
  await page.locator("#boxes").uncheck();
  await page.locator("#execute").click();
  await page.locator("#pause").click();
  const out = `${qa}/rush-recording`;
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out))
    if (/^\d{3}\.png$/.test(f)) fs.unlinkSync(`${out}/${f}`);
  const trace = [];
  let seen = false;
  for (let i = 0; i < 210; i++) {
    await page.locator("#step").click();
    await save(c, `${out}/${String(i).padStart(3, "0")}.png`);
    const s = await c.evaluate((n) => ({ ...n.dataset }));
    trace.push(s);
    if (s.move === "rush_heavy") seen = true;
    if (
      seen &&
      s.playerState === "idle" &&
      s.ownerStandState === "follow" &&
      Number(s.hits) === 10
    )
      break;
  }
  expect(trace.at(-1).hits).toBe("10");
  expect(trace.at(-1).ownerStandState).toBe("follow");
  fs.writeFileSync(`${qa}/rush-trace.json`, JSON.stringify(trace, null, 2));
});
