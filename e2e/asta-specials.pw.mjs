import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const dir = process.env.ASTA_EVIDENCE_DIR ?? "deployment/audit/asta-specials";
mkdirSync(dir, { recursive: true });
const moves = [
  ["astaBlackRush", 0, "j", "slayer"],
  ["astaRisingDemon", 0, "k", "slayer"],
  ["astaBlackDivider", 0, "l", "slayer"],
  ["astaIaiSlash", 1, "j", "slasher"],
  ["astaFlashSteps", 1, "k", "slasher"],
  ["astaSeveringLine", 1, "l", "slasher"],
  ["astaBlackSlash", 2, "j", "dweller"],
  ["astaCausalityBreak", 2, "k", "destroyer"],
  ["astaDualBreak", 2, "l", "destroyer"],
];
async function start(page, mode = "training") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("sprites/asta"))
      errors.push(r.url());
  });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.locator("#" + mode).click();
  await page
    .getByRole("radio", { name: "Selecionar Asta", exact: true })
    .check();
  await page.locator("#confirm-character").click();
  if (mode !== "arcade") {
    await page
      .getByRole("radio", { name: "Selecionar Samurai", exact: true })
      .check();
    await page.locator("#confirm-character").click();
  }
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
  return { c, errors };
}
async function motion(page, family, key) {
  await page.keyboard.down("s");
  await page.waitForTimeout(55);
  if (family === 2) {
    await page.keyboard.up("s");
    await page.waitForTimeout(50);
    await page.keyboard.down("s");
  } else {
    await page.keyboard.down(family === 0 ? "d" : "a");
    await page.waitForTimeout(45);
    await page.keyboard.up("s");
  }
  await page.keyboard.press(key, { delay: 30 });
  await page.keyboard.up("s");
  await page.keyboard.up("a");
  await page.keyboard.up("d");
}
async function collect(page, id) {
  await page.evaluate((id) => {
    window.astaFrames = [];
    let last = "";
    const until = performance.now() + 1400;
    function tick() {
      const c = document.querySelector("canvas"),
        d = c.dataset;
      if (d.move === id && d.physicsState === "attack") {
        const key = d.sheet + "/" + d.frame;
        if (last !== key) {
          window.astaFrames.push({
            key,
            phase: d.phase,
            sword: d.astaSword,
            stage: d.astaStage,
            count: d.astaDrawnWeapons,
            png: c.toDataURL(),
          });
          last = key;
        }
      }
      if (performance.now() < until) requestAnimationFrame(tick);
    }
    tick();
  }, id);
}
test("nine real input specials, correct retained swords, Relay retains its opening weapon and code FX toggle", async ({
  page,
}) => {
  test.setTimeout(100000);
  const { c, errors } = await start(page);
  await page.evaluate(() => {
    const chunks = [],
      rec = new MediaRecorder(
        document.querySelector("canvas").captureStream(30),
        { mimeType: "video/webm;codecs=vp8" },
      );
    window.astaMovie = { chunks, rec };
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
  });
  for (const fx of [true, false]) {
    await page.locator("#asta-fx").setChecked(fx);
    for (const [id, family, key, sword] of moves) {
      await page.locator("#reset-positions").click();
      await page.waitForTimeout(450);
      const initial=sword === "slayer" ? "destroyer" : "slayer";
      await page.locator("#asta-sword-0").selectOption(initial);
      await c.focus();
      await page.keyboard.down("d");
      await page.waitForFunction(
        () =>
          Math.abs(
            +document.querySelector("canvas").dataset.rootX -
              +document.querySelector("canvas").dataset.rivalX,
          ) < 94,
      );
      await page.keyboard.up("d");
      await collect(page, id);
      await motion(page, family, key);
      await expect(c).toHaveAttribute("data-move", id);
      await page.waitForTimeout(1500);
      await expect(c).toHaveAttribute("data-asta-sword", id==="astaDualBreak"?initial:sword);
      await expect(c).toHaveAttribute("data-physics-state", /idle|crouch|walk/);
      const frames = await page.evaluate(() => window.astaFrames);
      expect(frames.length, id).toBeGreaterThanOrEqual(
        id === "astaFlashSteps" || id === "astaSeveringLine" ? 9 : 4,
      );
      expect(frames.every((f) => Number(f.count) <= 1)).toBe(true);
      if (id === "astaDualBreak") {
        expect(frames.every((f) => f.stage === initial)).toBe(true);
      }
      for (let i = 0; i < frames.length; i++) {
        const { png, ...meta } = frames[i];
        writeFileSync(
          dir + "/" + id + "-" + (fx ? "fx" : "body") + "-" + i + ".png",
          Buffer.from(png.split(",")[1], "base64"),
        );
      }
      writeFileSync(
        dir + "/" + id + "-" + (fx ? "fx" : "body") + ".json",
        JSON.stringify(
          frames.map(({ png, ...rest }) => rest),
          null,
          2,
        ),
      );
    }
  }
  const movie = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const { rec, chunks } = window.astaMovie;
        rec.onstop = () => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(new Blob(chunks, { type: "video/webm" }));
        };
        rec.stop();
      }),
  );
  writeFileSync(
    dir + "/nove-especiais.webm",
    Buffer.from(movie.split(",")[1], "base64"),
  );
  expect(errors).toEqual([]);
});
for (const mode of ["arcade", "versus"])
  test("Asta special in " + mode, async ({ page }) => {
    const { c, errors } = await start(page, mode);
    await motion(page, 1, "j");
    await expect(c).toHaveAttribute("data-move", "astaIaiSlash");
    await expect(c).toHaveAttribute("data-asta-sword", "slasher");
    await expect(c).toHaveAttribute(
      "data-physics-state",
      /idle|walk|hitstun|blockstun/,
    );
    expect(errors).toEqual([]);
  });
