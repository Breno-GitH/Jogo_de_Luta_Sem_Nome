import { test, expect } from "@playwright/test";
import fs from "node:fs";
test.skip(
  process.env.GOKU_PRODUCTION !== "1",
  "Requires the Apache production build and LAN backend.",
);
test("compiled Goku specials serve exact body/FX assets and resolve all variants without a cinematic", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const epoch = new Date("2026-11-02T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("art/goku-specials.html");
  const c = page.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true", { timeout: 20000 });
  await page.clock.runFor(34);
  const m = JSON.parse(
      fs.readFileSync("public/sprites/goku/specials/manifest.json", "utf8"),
    ),
    fx = JSON.parse(fs.readFileSync("src/data/goku-special-fx.json", "utf8"));
  for (const clip of Object.values(m.clips)) {
    const p = "sprites/goku/specials/" + clip.sheet,
      r = await page.request.get(p);
    expect(r.status()).toBe(200);
    expect((await r.body()).equals(fs.readFileSync("public/" + p))).toBe(true);
  }
  for (const clip of Object.values(fx.clips)) {
    const p = "sprites/" + clip.sheet,
      r = await page.request.get(p);
    expect((await r.body()).equals(fs.readFileSync("public/" + p))).toBe(true);
  }
  const report = [];
  for (const mirror of [false, true]) {
    if (Number(await c.getAttribute("data-facing")) !== (mirror ? -1 : 1))
      await page.locator("#flip").click();
    for (const family of ["ki", "kamehameha", "teleport"])
      for (const strength of ["light", "medium", "heavy"]) {
        const key = family + "_" + strength;
        await page.selectOption("#scenario", key);
        await page.locator("#execute").click();
        await page.clock.runFor(2200);
        const d = await c.evaluate((n) => ({ ...n.dataset }));
        expect(d.moves).toContain(key);
        expect(d.capture).toBe("none");
        expect(d.roadPhase).toBe("none");
        expect(d.beams).toBe("0");
        expect(d.kiProjectiles).toBe("0");
        expect(Number(d.hitCount)).toBe(
          family === "ki"
            ? strength === "medium"
              ? 2
              : 1
            : family === "kamehameha"
              ? { light: 2, medium: 4, heavy: 6 }[strength]
              : 0,
        );
        report.push({ key, mirror, ...d });
      }
  }
  for (const p of [
    "downloads/goku-specials.zip",
    "previews/goku-specials-gameplay.png",
    "previews/goku-specials-gameplay.gif",
  ]) {
    const r = await page.request.get(p);
    expect(r.status()).toBe(200);
    expect((await r.body()).equals(fs.readFileSync("public/" + p))).toBe(true);
  }
  const health = await (await page.request.get("api/health")).json(),
    version = fs
      .readFileSync("src/net/version.ts", "utf8")
      .match(/ENGINE_VERSION = "([^"]+)"/)[1];
  expect(health.version).toBe(version);
  expect(errors).toEqual([]);
  fs.writeFileSync(
    "art/goku/specials/stage3/qa/production.json",
    JSON.stringify({ version, exactAssets: true, report, errors }, null, 2),
  );
});
