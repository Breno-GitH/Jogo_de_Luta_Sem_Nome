import { test, expect } from "@playwright/test";
import fs from "node:fs";
test.skip(
  process.env.GOKU_PRODUCTION !== "1",
  "Requires the compiled Node server and production configuration.",
);
test("compiled Goku combat serves exact assets, resolves all combos on both sides and returns from the grab", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const epoch = new Date("2026-11-02T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  await page.goto("art/goku-combat.html");
  const c = page.locator("#arena");
  await expect(c).toHaveAttribute("data-loaded", "true", { timeout: 20000 });
  await page.clock.runFor(34);
  const meta = JSON.parse(
    fs.readFileSync("public/sprites/goku/combat/manifest.json", "utf8"),
  );
  for (const [key, m] of Object.entries(meta.clips)) {
    const path = "sprites/goku/combat/" + m.sheet,
      r = await page.request.get(path);
    expect(r.status()).toBe(200);
    expect(
      (await r.body()).equals(fs.readFileSync("public/" + path)),
      path,
    ).toBe(true);
    await page.selectOption("#animation", key);
    await page
      .getByRole("button", { name: `Quadro ${m.count}`, exact: true })
      .click();
    await expect(c).toHaveAttribute("data-frame", String(m.count - 1));
  }
  const report = [];
  for (const side of [1, -1]) {
    if (Number(await c.getAttribute("data-facing")) !== side)
      await page.locator("#flip").click();
    for (const [scene, hits] of [
      ["groundCombo", 3],
      ["crouchCombo", 3],
      ["airCombo", 3],
      ["launcherCombo", 4],
      ["throw", 1],
    ]) {
      await page.selectOption("#scenario", scene);
      await page.locator("#execute").click();
      await page.clock.runFor(3000);
      expect(
        Number(await c.getAttribute("data-hit-count")),
        `${scene}/${side}`,
      ).toBe(hits);
      await expect(c).toHaveAttribute("data-capture", "none");
      await expect(c).toHaveAttribute("data-physics-state", scene === "crouchCombo" ? "crouch" : "idle");
      await expect(c).toHaveAttribute("data-move", "");
      report.push({
        scene,
        side,
        ...(await c.evaluate((n) => ({ ...n.dataset }))),
      });
    }
  }
  for (const path of [
    "downloads/goku-combat.zip",
    "previews/goku-combat-gameplay.png",
    "previews/goku-combat-gameplay.gif",
  ]) {
    const r = await page.request.get(path);
    expect(r.status()).toBe(200);
    expect(
      (await r.body()).equals(fs.readFileSync("public/" + path)),
      path,
    ).toBe(true);
  }
  const health = await (await page.request.get("api/health")).json(),
    version = fs
      .readFileSync("src/net/version.ts", "utf8")
      .match(/ENGINE_VERSION = "([^"]+)"/)[1];
  expect(health.version).toBe(version);
  expect(errors).toEqual([]);
  expect(await page.locator("#error").textContent()).toBe("");
  fs.mkdirSync("art/goku/combat/qa/production", { recursive: true });
  fs.writeFileSync(
    "art/goku/combat/qa/production/results.json",
    JSON.stringify(
      { version, exactAssets: true, clips: 31, report, errors },
      null,
      2,
    ),
  );
});
