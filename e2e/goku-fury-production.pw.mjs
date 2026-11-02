import { test, expect } from "@playwright/test";
import fs from "node:fs";
test.skip(
  process.env.GOKU_PRODUCTION !== "1",
  "Requires the Apache production build and LAN backend.",
);
test("compiled Fury serves exact sheets and previews, confirms and returns to base with fresh network version", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const epoch = new Date("2026-11-02T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("art/goku-fury.html");
  const c = page.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true", { timeout: 30000 });
  await page.clock.runFor(34);
  const manifest = JSON.parse(
      fs.readFileSync("public/sprites/goku/fury/manifest.json", "utf8"),
    ),
    fx = JSON.parse(fs.readFileSync("src/data/goku-fury-fx.json", "utf8"));
  const paths = [
    ...Object.values(manifest.clips).map((m) => "sprites/goku/fury/" + m.sheet),
    ...Object.values(fx.clips).map((m) => "sprites/" + m.sheet),
    "downloads/goku-fury.zip",
    "previews/goku-fury-gameplay.png",
    "previews/goku-fury-gameplay.gif",
  ];
  for (const path of paths) {
    const r = await page.request.get(path);
    expect(r.status()).toBe(200);
    expect((await r.body()).equals(fs.readFileSync("public/" + path))).toBe(
      true,
    );
  }
  await page.uncheck("#infinite");
  await page.selectOption("#speed", "2");
  await page.click("#execute");
  await page.clock.runFor(1500);
  expect(await c.getAttribute("data-capture")).toBe("gokuFury");
  await page.clock.runFor(3500);
  expect(await c.getAttribute("data-capture")).toBe("none");
  expect(await c.getAttribute("data-transformed")).toBe("false");
  expect(Number(await c.getAttribute("data-hit-count"))).toBe(16);
  expect(Number(await c.getAttribute("data-meter"))).toBe(0);
  const health = await (await page.request.get("api/health")).json(),
    version = fs
      .readFileSync("src/net/version.ts", "utf8")
      .match(/ENGINE_VERSION = "([^"]+)"/)[1];
  expect(health.version).toBe(version);
  expect(errors).toEqual([]);
  fs.writeFileSync(
    "art/goku/fury/qa/production.json",
    JSON.stringify(
      {
        version,
        exactAssets: true,
        dataset: await c.evaluate((n) => ({ ...n.dataset })),
        errors,
      },
      null,
      2,
    ),
  );
});
