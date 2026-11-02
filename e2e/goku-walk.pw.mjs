import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";

const qa = "art/goku/qa/walk-clean";
fs.mkdirSync(qa, { recursive: true });
const canonical = (value) =>
  JSON.stringify(value, (_, current) =>
    current && typeof current === "object" && !Array.isArray(current)
      ? Object.fromEntries(
          Object.entries(current).sort(([a], [b]) => a.localeCompare(b, "en")),
        )
      : current,
  );
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function start(page, mirror = false) {
  const epoch = new Date("2026-11-01T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/goku.html");
  const canvas = page.locator("#arena");
  await expect(canvas).toHaveAttribute("data-loaded", "true", {
    timeout: 15000,
  });
  // Prime the fixed loop's first RAF timestamp before measuring input ticks.
  await page.clock.runFor(34);
  if (mirror) await page.locator("#flip").click();
  await expect(canvas).toHaveAttribute("data-facing", mirror ? "-1" : "1");
  await canvas.focus();
  return canvas;
}

async function save(canvas, name) {
  fs.writeFileSync(
    name,
    Buffer.from(
      (await canvas.evaluate((node) => node.toDataURL("image/png"))).split(
        ",",
      )[1],
      "base64",
    ),
  );
}

test("full Goku correction preserves Samurai, Dio and The World", () => {
  const baseline = JSON.parse(
    fs.readFileSync("art/goku/preservation.json", "utf8"),
  );
  for (const [file, expected] of Object.entries(baseline)) {
    expect(hash(fs.readFileSync(file)), file).toBe(expected);
  }
});

for (const mirror of [false, true]) {
  test(`continuous forward/back walking, idle transitions and real capture, facing=${mirror ? "left" : "right"}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const canvas = await start(page, mirror);
    const manifest = JSON.parse(
      fs.readFileSync("public/sprites/goku/movement.json", "utf8"),
    );
    const motion = JSON.parse(
      fs.readFileSync("src/data/goku-movement.json", "utf8"),
    );
    const trace = [];
    for (const forward of [true, false]) {
      const key = mirror === forward ? "a" : "d";
      const expected = forward ? "walkForward" : "walkBack";
      const folder = `${qa}/${mirror ? "left" : "right"}-${expected}`;
      fs.mkdirSync(folder, { recursive: true });
      const before = Number(await canvas.getAttribute("data-player-x"));
      const frames = new Set();
      let capture = 0;
      await page.keyboard.down(key);
      // Enter the requested physical state before sampling. A RAF may fall
      // just outside the first fractional 16.667 ms clock interval.
      await page.clock.runFor(100);
      await expect(canvas).toHaveAttribute("data-animation", expected);
      for (let tick = 0; tick < 72; tick++) {
        await page.clock.runFor(1000 / 60 + 0.001);
        const sample = await canvas.evaluate((node) => ({ ...node.dataset }));
        trace.push({ ...sample, request: expected, sampleTick: tick });
        expect(sample.physicsState).toBe("walk");
        expect(sample.rootY).toBe("580");
        expect(sample.facing).toBe(mirror ? "-1" : "1");
        expect(sample.smoothing).toBe("false");
        if (sample.animation === expected) frames.add(Number(sample.frame));
        if (tick % 3 === 0)
          await save(
            canvas,
            `${folder}/${String(capture++).padStart(3, "0")}.png`,
          );
      }
      await expect(canvas).toHaveAttribute("data-animation", expected);
      expect(frames.size).toBeGreaterThanOrEqual(
        Math.min(6, manifest.clips[expected].count),
      );
      const after = Number(await canvas.getAttribute("data-player-x"));
      expect(Math.abs(after - before)).toBeGreaterThan(
        (forward ? motion.speed : motion.backSpeed) * 65,
      );
      const sign = (forward ? 1 : -1) * (mirror ? -1 : 1);
      expect(Math.sign(after - before)).toBe(sign);
      await page.keyboard.up(key);
      await page.clock.runFor(180);
      await expect(canvas).toHaveAttribute("data-animation", "idle");
      await expect(canvas).toHaveAttribute("data-root-y", "580");
    }
    expect(errors).toEqual([]);
    fs.writeFileSync(
      `${qa}/trace-${mirror ? "left" : "right"}.json`,
      JSON.stringify(trace, null, 2),
    );
  });
}

test("rapid direction reversals preserve control and walk-to-dash/jump transitions recover", async ({
  page,
}) => {
  const canvas = await start(page);
  const reversals = [];
  for (let i = 0; i < 16; i++) {
    const key = i % 2 ? "a" : "d";
    await page.keyboard.down(key);
    await page.clock.runFor((1000 * 4) / 60 + 0.001);
    const sample = await canvas.evaluate((node) => ({ ...node.dataset }));
    reversals.push(sample);
    expect(sample.physicsState).toBe("walk");
    expect(sample.animation).toMatch(/^(walk|idleToWalk)/);
    expect(sample.rootY).toBe("580");
    await page.keyboard.up(key);
  }
  await page.clock.runFor(180);
  await expect(canvas).toHaveAttribute("data-animation", "idle");
  fs.writeFileSync(`${qa}/reversals.json`, JSON.stringify(reversals, null, 2));

  for (const [key, expected] of [
    ["d", "dashForward"],
    ["a", "backdash"],
  ]) {
    await page.locator("#reset").click();
    await canvas.focus();
    await page.keyboard.down(key);
    await page.clock.runFor(300);
    await page.keyboard.down("Shift");
    await page.clock.runFor(34);
    await expect(canvas).toHaveAttribute("data-animation", expected);
    await page.keyboard.up(key);
    await page.keyboard.up("Shift");
    await page.clock.runFor(400);
    await expect(canvas).toHaveAttribute("data-animation", "idle");
  }
  await page.locator("#reset").click();
  await canvas.focus();
  await page.keyboard.down("d");
  await page.clock.runFor(300);
  await page.keyboard.press("w");
  await page.clock.runFor(34);
  await expect(canvas).toHaveAttribute("data-animation", "jumpStart");
  await page.clock.runFor(200);
  expect(await canvas.getAttribute("data-animation")).toMatch(/^jumpRise/);
  await page.clock.runFor(1100);
  await page.keyboard.up("d");
  await page.clock.runFor(180);
  await expect(canvas).toHaveAttribute("data-root-y", "580");
  await expect(canvas).toHaveAttribute("data-animation", "idle");
  await expect(page.locator("#error")).toBeEmpty();
});
