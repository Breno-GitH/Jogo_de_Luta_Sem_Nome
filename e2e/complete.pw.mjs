import { test, expect } from "@playwright/test";
import fs from "node:fs";
const clips = JSON.parse(
  fs.readFileSync("public/sprites/samurai/complete.json", "utf8"),
).clips;

test("203 new cells load in both palettes, with pause, precise boxes and frame stepping", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  await page.locator("#boxes").check();
  fs.mkdirSync("art/samurai/qa/complete", { recursive: true });
  for (const [name, clip] of Object.entries(clips)) {
    await page.selectOption("#animation", name);
    const frames = [];
    for (let i = 0; i < clip.count; i++) {
      await page
        .getByRole("button", { name: `Quadro ${i + 1}`, exact: true })
        .click();
      await expect(canvas).toHaveAttribute("data-frame", String(i));
      frames.push(await canvas.evaluate((node) => node.toDataURL()));
    }
    expect(new Set(frames).size).toBeGreaterThanOrEqual(
      clip.loop ? 3 : clip.count,
    );
    const frame =
      clip.combat?.poses?.findIndex((p) => p.phase === "active") ??
      Math.floor(clip.count / 2);
    await page
      .getByRole("button", {
        name: `Quadro ${Math.max(0, frame) + 1}`,
        exact: true,
      })
      .click();
    const red = await canvas.evaluate((node) => node.toDataURL());
    await canvas.screenshot({
      path: `art/samurai/qa/complete/${name}-boxes.png`,
    });
    await page.locator("#p2").check();
    expect(await canvas.evaluate((node) => node.toDataURL())).not.toBe(red);
    await page.locator("#p2").uncheck();
    await page.locator("#boxes").uncheck();
    await canvas.screenshot({ path: `art/samurai/qa/complete/${name}.png` });
    await page.locator("#boxes").check();
  }
  expect(errors).toEqual([]);
  await expect(page.locator("#error")).toBeEmpty();
});

test("all special strengths execute real directional input, hit the dummy and recover", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto("art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  for (const family of ["draw", "crescent"])
    for (const strength of ["light", "medium", "heavy"]) {
      const move = `${family}_${strength}`;
      await page.selectOption("#sequence", move);
      await page.locator("#test-sequence").click();
      await expect(canvas).toHaveAttribute("data-playing", "false");
      expect(JSON.parse(await canvas.getAttribute("data-visited"))).toContain(
        move,
      );
      await expect(canvas).toHaveAttribute(
        "data-target-health",
        String(1000 - clips[move].combat.damage),
      );
      await expect(canvas).toHaveAttribute("data-player-state", "idle");
    }
});

test("counter has entry, success, failure and loses to low attacks and throws", async ({
  page,
}) => {
  test.setTimeout(40000);
  await page.goto("art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  for (const scenario of [
    "counterHit",
    "counterMiss",
    "counterLow",
    "counterGrab",
  ]) {
    await page.selectOption("#sequence", scenario);
    await page.locator("#test-sequence").click();
    await expect(canvas).toHaveAttribute("data-playing", "false");
    const visited = JSON.parse(await canvas.getAttribute("data-visited"));
    expect(visited).toContain("counterEntry");
    expect(visited).toContain("counterWait");
    if (scenario === "counterHit") {
      expect(visited).toContain("counter_strike");
      await expect(canvas).toHaveAttribute("data-player-health", "1000");
      await expect(canvas).toHaveAttribute("data-target-health", "890");
    } else if (scenario === "counterMiss") {
      expect(visited).toContain("counterFail");
      await expect(canvas).toHaveAttribute("data-target-health", "1000");
    } else
      await expect(canvas).toHaveAttribute(
        "data-player-health",
        scenario === "counterLow" ? "960" : "880",
      );
    await expect(canvas).toHaveAttribute("data-player-state", "idle");
  }
});

test("ultimate confirms through guard, spends meter on whiff and completes knockdown", async ({
  page,
}) => {
  test.setTimeout(30000);
  await page.goto("art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  await page.locator("#arena").check();
  for (const scenario of ["ultimateHit", "ultimateBlock", "ultimateMiss"]) {
    await page.selectOption("#sequence", scenario);
    await page.locator("#test-sequence").click();
    if (scenario === "ultimateHit") {
      await expect(canvas).toHaveAttribute("data-capture", "ultimate");
      // Export the full actual canvas; the inspector's scroll viewport is
      // narrower than the arena and an element screenshot clips its right HUD.
      const pixels = await canvas.evaluate((node) =>
        node.toDataURL("image/png"),
      );
      fs.writeFileSync(
        "art/samurai/qa/complete/ultimate-cinematic.png",
        Buffer.from(pixels.split(",")[1], "base64"),
      );
    }
    await expect(canvas).toHaveAttribute("data-playing", "false");
    await expect(canvas).toHaveAttribute("data-meter", "0");
    await expect(canvas).toHaveAttribute(
      "data-capture-seen",
      String(scenario !== "ultimateMiss"),
    );
    await expect(canvas).toHaveAttribute(
      "data-target-health",
      scenario === "ultimateMiss" ? "1000" : "701",
    );
    if (scenario === "ultimateHit") {
      await expect(canvas).toHaveAttribute("data-max-combo", "10");
      const visited = JSON.parse(await canvas.getAttribute("data-visited"));
      for (const name of [
        "ultimate_start",
        "ultimateRush",
        "ultimateFinish",
        "ultimateRecover",
        "downed",
        "getup",
        "idle",
      ])
        expect(visited).toContain(name);
    }
  }
});

test("grabs, guard impacts, entrance, taunt, victory and defeat run through their states", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto("art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  const cases = {
    grab: ["throw", "grabHold", "grabbed", "throwRecover", "getup"],
    guardStand: ["guardStand", "guardImpactStand"],
    guardCrouch: ["guardCrouch", "guardImpactCrouch"],
    entrance: ["entrance", "idle"],
    taunt: ["taunt", "idle"],
    victory: ["victory", "ko", "defeat"],
    defeat: ["ko", "victory", "defeat"],
  };
  for (const [scenario, clips] of Object.entries(cases)) {
    await page.selectOption("#sequence", scenario);
    await page.locator("#test-sequence").click();
    await expect(canvas).toHaveAttribute("data-playing", "false");
    const visited = JSON.parse(await canvas.getAttribute("data-visited"));
    for (const clip of clips) expect(visited, scenario).toContain(clip);
    await expect(page.locator("#error")).toBeEmpty();
  }
});

test("keyboard performs the new motion in the playable match and menus stay honest", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.locator("#versus").click();
  await page.selectOption("#difficulty", "easy");
  await page.locator("#fight").click();
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-animation", "entrance");
  await expect(canvas).toHaveAttribute("data-animation", "idle");
  await page.keyboard.down("s");
  await expect(canvas).toHaveAttribute("data-input-down", "true");
  await page.keyboard.down("d");
  await expect(canvas).toHaveAttribute("data-input-direction", "1");
  await page.keyboard.up("s");
  await expect(canvas).toHaveAttribute("data-input-down", "false");
  await page.keyboard.press("l");
  await expect(canvas).toHaveAttribute("data-move", "draw_heavy");
  await page.keyboard.up("d");
  await page.locator("#boxes").click();
  await canvas.screenshot({
    path: "art/samurai/qa/complete/playable-special.png",
  });
  await page.keyboard.press("Escape");
  await expect(page.locator("#resume")).toBeVisible();
  await page.locator("#menu").click();
  await page.locator("#online").click();
  await expect(page.locator("#join-form")).toBeVisible();
  expect(errors).toEqual([]);
});
