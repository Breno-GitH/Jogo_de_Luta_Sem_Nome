import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "art/goku/rebuild/qa";
fs.mkdirSync(qa, { recursive: true });

test("every rebuilt cel is inspectable with exact index, bounds, timing and optional anatomical guides", async ({
  page,
}) => {
  test.setTimeout(120000);
  const epoch = new Date("2026-11-01T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/goku.html");
  const c = page.locator("#arena"),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(c).toHaveAttribute("data-loaded", "true");
  const m = JSON.parse(
    fs.readFileSync("public/sprites/goku/movement.json", "utf8"),
  );
  let count = 0;
  fs.mkdirSync(`${qa}/inspected`, { recursive: true });
  for (const [key, meta] of Object.entries(m.clips)) {
    await page.selectOption("#animation", key);
    await page.locator("#pause").click();
    for (let i = 0; i < meta.count; i++) {
      await page
        .getByRole("button", { name: `Quadro ${i + 1}`, exact: true })
        .click();
      await expect(c).toHaveAttribute("data-frame", String(i));
      await expect(c).toHaveAttribute("data-bounds", meta.bounds[i].join(","));
      await expect(c).toHaveAttribute(
        "data-drawing-ticks",
        String(meta.durations[i]),
      );
      const expected = meta.durations.slice(0, i).reduce((s, t) => s + t, 0);
      await expect(c).toHaveAttribute("data-animation-tick", String(expected));
      fs.writeFileSync(
        `${qa}/inspected/${key}-${String(i).padStart(2, "0")}.png`,
        Buffer.from(
          (await c.evaluate((n) => n.toDataURL())).split(",")[1],
          "base64",
        ),
      );
      count++;
    }
  }
  await page.selectOption("#animation", "idle");
  await page.getByRole("button", { name: "Quadro 1", exact: true }).click();
  const before = await c.evaluate((n) => n.toDataURL());
  await page.locator("#landmarks").check();
  expect(await c.evaluate((n) => n.toDataURL())).not.toBe(before);
  await page.locator("#bounds").uncheck();
  await page.locator("#guides").uncheck();
  await page.locator("#compare").check();
  await page.locator("#flip").click();
  await expect(c).toHaveAttribute("data-facing", "-1");
  await expect(c).toHaveAttribute("data-smoothing", "false");
  expect(errors).toEqual([]);
  expect(await page.locator("#error").textContent()).toBe("");
  fs.writeFileSync(
    `${qa}/all-cels-browser.json`,
    JSON.stringify(
      {
        clips: Object.keys(m.clips).length,
        cels: count,
        bounds: true,
        pivot: true,
        individualTiming: true,
        frameStepping: true,
        anatomicalGuide: true,
        errors,
      },
      null,
      2,
    ),
  );
});

test("authored locomotion transitions handle partial crouches, quick reversals, idle and inspection", async ({
  page,
}) => {
  test.setTimeout(90000);
  const epoch = new Date("2026-11-01T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/goku.html");
  const c = page.locator("#arena"),
    trace = [];
  await expect(c).toHaveAttribute("data-loaded", "true");
  await page.clock.runFor(34);
  for (const mirrored of [false, true]) {
    if (mirrored) {
      await page.locator("#flip").click();
      await page.clock.runFor(34);
    }
    for (const direction of ["Forward", "Back"]) {
      const key =
        direction === "Forward" ? (mirrored ? "a" : "d") : mirrored ? "d" : "a";
      await c.focus();
      await page.keyboard.down(key);
      const entry = [];
      for (let n = 0; n < 6; n++) {
        await page.clock.runFor(1000 / 60 + 0.001);
        entry.push(await c.evaluate((n) => ({ ...n.dataset })));
      }
      fs.writeFileSync(
        `${qa}/entry-${mirrored}-${direction}.json`,
        JSON.stringify(entry, null, 2),
      );
      expect(entry.map((d) => d.animation)).toContain("idleToWalk" + direction);
      await page.clock.runFor(120);
      await expect(c).toHaveAttribute("data-animation", "walk" + direction);
      await page.keyboard.up(key);
      const exit = [];
      for (let n = 0; n < 6; n++) {
        await page.clock.runFor(1000 / 60 + 0.001);
        exit.push(await c.getAttribute("data-animation"));
      }
      expect(exit).toContain("walkToIdle" + direction);
      await page.clock.runFor(120);
      await expect(c).toHaveAttribute("data-animation", "idle");
      for (const hold of [3, 24]) {
        await page.keyboard.down("s");
        await page.clock.runFor((hold * 1000) / 60 + 0.01);
        await page.keyboard.up("s");
        await page.keyboard.down(key);
        const seen = new Set();
        for (let t = 0; t < 16; t++) {
          await page.clock.runFor(1000 / 60 + 0.001);
          const d = await c.evaluate((n) => ({ ...n.dataset }));
          trace.push(d);
          seen.add(d.animation);
          expect(d.rootY).toBe("580");
        }
        expect([...seen]).toContain("crouchWalk" + direction);
        await expect(c).toHaveAttribute("data-animation", "walk" + direction);
        await page.keyboard.up(key);
        await page.clock.runFor(200);
        await expect(c).toHaveAttribute("data-animation", "idle");
      }
    }
    for (let n = 0; n < 12; n++) {
      const key = n % 2 ? "a" : "d";
      await page.keyboard.down(key);
      await page.clock.runFor(50);
      await page.keyboard.up(key);
    }
    await page.clock.runFor(200);
    await expect(c).toHaveAttribute("data-animation", "idle");
  }
  const manifest = JSON.parse(
    fs.readFileSync("public/sprites/goku/movement.json", "utf8"),
  );
  for (const [key, meta] of Object.entries(manifest.clips).filter(
    ([, m]) => m.rebuildStage === "transitions",
  )) {
    await page.selectOption("#animation", key);
    await page.locator("#pause").click();
    for (let i = 0; i < meta.count; i++) {
      await page
        .getByRole("button", { name: `Quadro ${i + 1}`, exact: true })
        .click();
      await expect(c).toHaveAttribute("data-frame", String(i));
    }
  }
  await page.locator("#compare").check();
  await page.selectOption("#speed", "0.25");
  await page.selectOption("#zoom", "3");
  expect(await page.locator("#error").textContent()).toBe("");
  fs.writeFileSync(
    `${qa}/transitions-browser.json`,
    JSON.stringify(
      { bothFacings: true, partialCrouch: true, rapidReversals: true, trace },
      null,
      2,
    ),
  );
});

test("whole dash and backdash show impulse, recovery and safe interruption in both directions", async ({
  page,
}) => {
  const epoch = new Date("2026-11-01T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/goku.html");
  const c = page.locator("#arena"),
    trace = [];
  await expect(c).toHaveAttribute("data-loaded", "true");
  await page.clock.runFor(34);
  for (const mirror of [false, true]) {
    if (mirror) {
      await page.locator("#flip").click();
      await page.clock.runFor(34);
    }
    for (const forward of [true, false]) {
      await c.focus();
      const key = forward ? (mirror ? "a" : "d") : mirror ? "d" : "a",
        name = forward ? "dashForward" : "backdash";
      const before = Number(await c.getAttribute("data-player-x"));
      await page.keyboard.down(key);
      await page.keyboard.down("Shift");
      const seen = new Set();
      for (let t = 0; t < 23; t++) {
        await page.clock.runFor(1000 / 60 + 0.001);
        if (t === 1) {
          await page.keyboard.up("Shift");
          await page.keyboard.up(key);
        }
        const d = await c.evaluate((n) => ({ ...n.dataset }));
        seen.add(d.animation);
        trace.push(d);
        expect(d.rootY).toBe("580");
        if (t % 3 === 0)
          fs.writeFileSync(
            `${qa}/dash-${mirror}-${name}-${t}.png`,
            Buffer.from(
              (await c.evaluate((n) => n.toDataURL())).split(",")[1],
              "base64",
            ),
          );
      }
      expect([...seen]).toContain(name);
      expect([...seen]).toContain(name + "Recovery");
      expect(
        Math.abs(Number(await c.getAttribute("data-player-x")) - before),
      ).toBeGreaterThan(140);
      await expect(c).toHaveAttribute("data-animation", "idle");
    }
  }
  fs.writeFileSync(
    `${qa}/dash-browser.json`,
    JSON.stringify({ bothFacings: true, trace }, null, 2),
  );
});

test("whole jump phases follow physical trajectory and directional landings on both sides", async ({
  page,
}) => {
  test.setTimeout(90000);
  const epoch = new Date("2026-11-01T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/goku.html");
  const c = page.locator("#arena"),
    trace = [];
  await expect(c).toHaveAttribute("data-loaded", "true");
  await page.clock.runFor(34);
  for (const mirror of [false, true]) {
    if (mirror) {
      await page.locator("#flip").click();
      await page.clock.runFor(34);
    }
    for (const direction of ["", "Forward", "Backward"]) {
      await c.focus();
      const key = direction
        ? direction === "Forward"
          ? mirror
            ? "a"
            : "d"
          : mirror
            ? "d"
            : "a"
        : "";
      if (key) await page.keyboard.down(key);
      await page.keyboard.down("w");
      const phases = new Set();
      for (let tick = 0; tick < 65; tick++) {
        await page.clock.runFor(1000 / 60 + 0.001);
        if (tick === 8) await page.keyboard.up("w");
        const d = await c.evaluate((n) => ({ ...n.dataset }));
        trace.push({ mirror, direction, tick, ...d });
        phases.add(d.animation);
        if (d.animation.startsWith("landing"))
          expect(Number(d.rootY)).toBe(580);
        if (d.physicsState === "air") expect(Number(d.rootY)).toBeLessThan(580);
        if (tick % 6 === 0)
          fs.writeFileSync(
            `${qa}/jump-${mirror}-${direction || "neutral"}-${tick}.png`,
            Buffer.from(
              (await c.evaluate((n) => n.toDataURL())).split(",")[1],
              "base64",
            ),
          );
      }
      if (key) await page.keyboard.up(key);
      expect([...phases]).toContain("jumpStart");
      for (const phase of ["jumpRise", "jumpApex", "jumpFall", "landing"])
        expect([...phases]).toContain(phase + direction);
      await page.clock.runFor(250);
      await expect(c).toHaveAttribute("data-animation", "idle");
      await expect(c).toHaveAttribute("data-root-y", "580");
    }
  }
  expect(await page.locator("#error").textContent()).toBe("");
  fs.writeFileSync(
    `${qa}/jump-browser.json`,
    JSON.stringify(
      { bothFacings: true, neutralForwardBackward: true, trace },
      null,
      2,
    ),
  );
});
test("whole crouch drawings support repeated full and interrupted squats on both sides", async ({
  page,
}) => {
  const epoch = new Date("2026-11-01T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("/art/goku.html");
  const c = page.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true");
  await page.clock.runFor(34);
  const trace = [];
  for (const mirror of [false, true]) {
    if (mirror) {
      await page.locator("#flip").click();
      await page.clock.runFor(34);
    }
    await c.focus();
    for (const ticks of [2, 4, 6, 12, 40]) {
      await page.keyboard.down("s");
      await page.clock.runFor((ticks * 1000) / 60 + 0.01);
      const before = await c.evaluate((n) => ({ ...n.dataset }));
      trace.push(before);
      expect(before.animation).toBe(ticks < 8 ? "crouchStart" : "crouchIdle");
      expect(before.rootY).toBe("580");
      await page.keyboard.up("s");
      await page.clock.runFor(34);
      expect(await c.getAttribute("data-animation")).toMatch(
        /^(crouchEnd|idle)$/,
      );
      await page.clock.runFor(180);
      await expect(c).toHaveAttribute("data-animation", "idle");
      await expect(c).toHaveAttribute("data-root-y", "580");
    }
    await page.keyboard.down("s");
    await page.clock.runFor(180);
    await page.keyboard.up("s");
    await page.clock.runFor(34);
    await page.keyboard.down("s");
    await page.clock.runFor(180);
    await expect(c).toHaveAttribute("data-animation", "crouchIdle");
    await page.keyboard.up("s");
    await page.clock.runFor(200);
    await expect(c).toHaveAttribute("data-animation", "idle");
  }
  for (const key of ["crouchStart", "crouchIdle", "crouchEnd"]) {
    await page.selectOption("#animation", key);
    await page.locator("#pause").click();
    const count = await page.locator("#strip button").count();
    for (let n = 0; n < count; n++) {
      await page
        .getByRole("button", { name: `Quadro ${n + 1}`, exact: true })
        .click();
      await expect(c).toHaveAttribute("data-frame", String(n));
      fs.writeFileSync(
        `${qa}/${key}-${String(n).padStart(2, "0")}.png`,
        Buffer.from(
          (await c.evaluate((node) => node.toDataURL("image/png"))).split(
            ",",
          )[1],
          "base64",
        ),
      );
    }
  }
  expect(await page.locator("#error").textContent()).toBe("");
  fs.writeFileSync(
    `${qa}/crouch-browser.json`,
    JSON.stringify(
      {
        bothFacings: true,
        partialAndFull: true,
        recrouchDuringRise: true,
        frameByFrame: true,
        trace,
      },
      null,
      2,
    ),
  );
});
test("whole-pose foundation holds a living idle in the real renderer, pauses and exposes all six complete drawings", async ({
  page,
}) => {
  const epoch = new Date("2026-11-01T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/art/goku.html");
  const c = page.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true");
  await page.clock.runFor(34);
  await expect(c).toHaveAttribute("data-revision", "5");
  const seen = new Set(),
    x = await c.getAttribute("data-player-x");
  for (let n = 0; n < 50; n++) {
    await page.clock.runFor(160);
    seen.add(await c.getAttribute("data-frame"));
    await expect(c).toHaveAttribute("data-animation", "idle");
    await expect(c).toHaveAttribute("data-root-y", "580");
    await expect(c).toHaveAttribute("data-player-x", x);
  }
  expect(seen.size).toBe(6);
  await page.locator("#pause").click();
  const frame = await c.getAttribute("data-frame");
  await page.clock.runFor(500);
  await expect(c).toHaveAttribute("data-frame", frame);
  await page.selectOption("#animation", "idle");
  await page.locator("#pause").click();
  for (let n = 0; n < 6; n++) {
    await page
      .getByRole("button", { name: `Quadro ${n + 1}`, exact: true })
      .click();
    await expect(c).toHaveAttribute("data-frame", String(n));
    fs.writeFileSync(
      `${qa}/idle-${String(n).padStart(2, "0")}.png`,
      Buffer.from(
        (await c.evaluate((node) => node.toDataURL("image/png"))).split(",")[1],
        "base64",
      ),
    );
  }
  await page.selectOption("#speed", "0.25");
  await page.selectOption("#animation", "idle");
  await page.clock.runFor(2000);
  expect(Number(await c.getAttribute("data-frame"))).toBeLessThan(6);
  expect(errors).toEqual([]);
  fs.writeFileSync(
    `${qa}/foundation-browser.json`,
    JSON.stringify(
      {
        idleSeconds: 8,
        uniqueDrawings: seen.size,
        paused: true,
        frameByFrame: true,
        slow: true,
        errors,
      },
      null,
      2,
    ),
  );
});
