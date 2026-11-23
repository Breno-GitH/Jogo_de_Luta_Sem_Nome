import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const dir =
  process.env.ASTA_DD_EVIDENCE_DIR ?? "deployment/msfd-work/asta22-dd";
mkdirSync(dir, { recursive: true });
async function start(page) {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.locator("#training").click();
  await page
    .getByRole("radio", { name: "Selecionar Asta", exact: true })
    .check();
  await page.locator("#confirm-character").click();
  await page
    .getByRole("radio", { name: "Selecionar Samurai", exact: true })
    .check();
  await page.locator("#confirm-character").click();
  await page.locator("#fight").click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "fight", {
    timeout: 45000,
  });
  const c = page.locator("canvas");
  await expect(c).toHaveAttribute("data-sheet", /^asta\//);
  await expect(c).toHaveAttribute("data-match-phase", "fight", {
    timeout: 45000,
  });
  await c.focus();
  return c;
}
async function cast(page, key) {
  await page.locator("canvas").focus();
  await page.keyboard.down("s");
  await page.waitForTimeout(45);
  await page.keyboard.up("s");
  await page.waitForTimeout(45);
  await page.keyboard.down("s");
  await page.keyboard.press(key, { delay: 20 });
  await page.keyboard.up("s");
}
async function record(page) {
  await page.evaluate(() => {
    const chunks = [],
      rec = new MediaRecorder(
        document.querySelector("canvas").captureStream(30),
        { mimeType: "video/webm;codecs=vp8" },
      );
    window.ddMovie = { rec, chunks };
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
  });
}
async function save(page, name) {
  const data = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const { rec, chunks } = window.ddMovie;
        rec.onstop = () => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(new Blob(chunks, { type: "video/webm" }));
        };
        rec.stop();
      }),
  );
  writeFileSync(
    dir + "/" + name + ".webm",
    Buffer.from(data.split(",")[1], "base64"),
  );
}
test("Black Slash visibly prepares then travels across long range without a pursuit", async ({
  page,
}) => {
  const c = await start(page);
  await page.keyboard.down("a");
  await page.waitForTimeout(1050);
  await page.keyboard.up("a");
  await page.waitForTimeout(120);
  const x = +(await c.getAttribute("data-root-x"));
  await record(page);
  await cast(page, "j");
  await expect(c).toHaveAttribute("data-move", "astaBlackSlash");
  await page.waitForTimeout(190);
  await c.screenshot({ path: dir + "/black-slash-preparation.png" });
  await page.waitForTimeout(400);
  await c.screenshot({ path: dir + "/black-slash-flight.png" });
  await expect(c).toHaveAttribute("data-asta-volley-shots", "3");
  await c.screenshot({ path: dir + "/black-slash-volley.png" });
  await expect(page.locator("#total-damage")).not.toHaveText("0", {
    timeout: 5000,
  });
  await expect(c).toHaveAttribute("data-physics-state", "idle");
  expect(+(await c.getAttribute("data-root-x"))).toBeCloseTo(x, 2);
  await expect(c).toHaveAttribute("data-asta-sword", "dweller");
  await page.waitForTimeout(400);
  await save(page, "black-slash-long-range");
});
test("All three Black Slash cuts are guardable and stop without damage or endless blockstun", async ({
  page,
}) => {
  const c = await start(page);
  await page.locator("#infinite-health").uncheck();
  await page.locator("#dummy").selectOption("guard");
  await c.focus();
  await page.keyboard.down("a");
  await page.waitForTimeout(900);
  await page.keyboard.up("a");
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const ids = new Set();
    window.volleyGuard = { ids, active: true };
    const s = window.volleyGuard;
    function poll() {
      const d = document.querySelector("canvas").dataset;
      for (const w of JSON.parse(d.astaWaves))
        if (w.state === "impact" && d.targetState === "blockstun")
          ids.add(w.id);
      if (s.active) requestAnimationFrame(poll);
    }
    poll();
  });
  await record(page);
  await cast(page, "j");
  await expect(c).toHaveAttribute("data-asta-volley-shots", "3");
  await page.waitForTimeout(1600);
  const guarded = await page.evaluate(() => {
    window.volleyGuard.active = false;
    return window.volleyGuard.ids.size;
  });
  expect(guarded).toBe(3);
  await expect(c).toHaveAttribute("data-p2-health", "1000");
  await expect(page.locator("#total-damage")).toHaveText("0");
  await expect(c).toHaveAttribute("data-target-state", /idle|walk/);
  await c.screenshot({ path: dir + "/black-slash-three-guarded.png" });
  await save(page, "black-slash-three-guarded");
});
test("Causality visibly restores recent damage actually received from the training BOT", async ({
  page,
}) => {
  test.setTimeout(35000);
  const c = await start(page);
  await page.locator("#infinite-health").uncheck();
  await page.locator("#dummy").selectOption("bot");
  await page.waitForFunction(
    () => +document.querySelector("canvas").dataset.p1Health < 950,
    null,
    { timeout: 15000 },
  );
  await page.locator("#dummy").selectOption("idle");
  await record(page);
  await expect(c).toHaveAttribute("data-physics-state", "idle", {
    timeout: 5000,
  });
  await page.waitForTimeout(250);
  const before = +(await c.getAttribute("data-p1-health"));
  expect(before).toBeGreaterThan(0);
  await cast(page, "k");
  await expect(c).toHaveAttribute("data-move", "astaCausalityBreak");
  await page.waitForTimeout(230);
  await c.screenshot({ path: dir + "/causality-tendrils.png" });
  await page.waitForFunction(
    () => +document.querySelector("canvas").dataset.astaRestored > 0,
    null,
    { timeout: 2500, polling: "raf" },
  );
  const after = +(await c.getAttribute("data-p1-health")),
    healed = +(await c.getAttribute("data-asta-restored"));
  expect(healed).toBeGreaterThan(0);
  expect(healed).toBeLessThanOrEqual(60);
  expect(after).toBe(before + healed);
  await c.screenshot({ path: dir + "/causality-real-hp-restored.png" });
  await expect(c).toHaveAttribute("data-physics-state", "idle");
  expect(
    +(await c.getAttribute("data-asta-restoration-cooldown")),
  ).toBeGreaterThan(1100);
  writeFileSync(
    dir + "/causality-real-hp.json",
    JSON.stringify(
      {
        before,
        after,
        healed,
        cooldown: await c.getAttribute("data-asta-restoration-cooldown"),
      },
      null,
      2,
    ),
  );
  await save(page, "causality-real-recent-damage");
});
