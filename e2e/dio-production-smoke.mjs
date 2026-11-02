// Production-only smoke check, run after npm run build / npm start.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("http://127.0.0.1:3001/art/dio.html");
  const preview = page.locator("#preview");
  await preview.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("#preview").dataset.loaded === "true",
  );
  assert.equal(await preview.getAttribute("data-revision"), "2");
  await page.selectOption("#animation", "walkForward");
  await page.getByRole("button", { name: "Quadro 40", exact: true }).click();
  assert.equal(await preview.getAttribute("data-frame"), "39");
  await page.locator("#previous").check();
  await page.locator("#guides").check();
  await preview.screenshot({
    path: "art/dio/qa/revision/production-comparison.png",
  });
  // Record genuine production Canvas frames, with a stable camera region.
  await page.selectOption("#mode", "live");
  await page.selectOption("#zoom", "3");
  await page.locator("#guides").uncheck();
  await preview.focus();
  await page.keyboard.down("d");
  await page.clock.runFor(4100);
  await page.keyboard.up("d");
  await page.locator("#pause").click();
  await page.keyboard.down("d");
  const directory = "art/dio/qa/revision/walk-recording";
  fs.mkdirSync(directory, { recursive: true });
  const trace = [];
  for (let i = 0; i < 80; i++) {
    await page.locator("#next").click();
    fs.writeFileSync(
      `${directory}/${String(i).padStart(3, "0")}.png`,
      Buffer.from(
        (await preview.evaluate((c) => c.toDataURL("image/png"))).split(",")[1],
        "base64",
      ),
    );
    trace.push(await preview.evaluate((c) => ({ ...c.dataset })));
  }
  await page.keyboard.up("d");
  assert.equal(new Set(trace.map((s) => s.dioFrame)).size, 40);
  fs.writeFileSync(
    "art/dio/qa/revision/walk-trace.json",
    JSON.stringify(trace, null, 2),
  );
  await page.goto("http://127.0.0.1:3001/");
  await page.locator("#training").click();
  await page.getByRole("radio", { name: "Selecionar Dio Brando" }).check();
  await page.locator("#fight").click();
  await page.waitForFunction(
    () => document.querySelector("#app").dataset.screen === "fight",
  );
  const arena = page.locator("canvas");
  assert.equal(await arena.getAttribute("data-character"), "dio");
  await page.keyboard.down("d");
  await page.clock.runFor(350);
  await page.keyboard.up("d");
  assert.equal(await arena.getAttribute("data-animation"), "walkForward");
  await page.clock.runFor(100);
  await page.keyboard.press("w");
  await page.clock.runFor(250);
  assert.ok(
    (await arena.getAttribute("data-animation")).startsWith("jumpRise"),
  );
  assert.ok(
    Number(await arena.getAttribute("data-companion-y")) <
      Number(await arena.getAttribute("data-root-y")) - 7,
  );
  fs.writeFileSync(
    "art/dio/qa/revision/production-dio.png",
    Buffer.from(
      (await arena.evaluate((c) => c.toDataURL("image/png"))).split(",")[1],
      "base64",
    ),
  );
  await page.clock.runFor(1000);
  assert.equal(await arena.getAttribute("data-animation"), "idle");
  for (const path of [
    "/downloads/dio-the-world-movement.zip",
    "/downloads/dio-normal-attacks.zip",
    "/sprites/previous-movement/dio/animations.json",
  ]) {
    assert.equal(
      (await page.request.get("http://127.0.0.1:3001" + path)).status(),
      200,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Production Dio: sprites, comparison, selection, walk, jump, Stand follow, idle and downloads passed.",
  );
} finally {
  await browser.close();
}
