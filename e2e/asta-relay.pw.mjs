import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const dir =
  process.env.ASTA_RELAY_EVIDENCE_DIR ?? "deployment/msfd-work/asta21-relay-captures";
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
  return c;
}
async function approach(page, gap = 90) {
  const c = page.locator("canvas");
  await c.focus();
  await page.keyboard.down("d");
  await page.waitForFunction((gap) => {
    const d = document.querySelector("canvas").dataset;
    return Math.abs(+d.rootX - +d.rivalX) <= gap;
  }, gap);
  await page.keyboard.up("d");
}
async function downDown(page, key) {
  await page.keyboard.down("s");
  await page.waitForTimeout(45);
  await page.keyboard.up("s");
  await page.waitForTimeout(45);
  await page.keyboard.down("s");
  await page.keyboard.press(key, { delay: 20 });
  await page.keyboard.up("s");
}
async function choose(page, sword) {
  const key = sword === "slayer" ? "d" : sword === "slasher" ? "a" : "s";
  await page.keyboard.down(key);
  await page.keyboard.press(sword === "destroyer" ? "k" : "j", { delay: 15 });
  await page.keyboard.up(key);
}
async function record(page) {
  await page.evaluate(() => {
    const c = document.querySelector("canvas"),
      chunks = [],
      rec = new MediaRecorder(c.captureStream(30), {
        mimeType: "video/webm;codecs=vp8",
      });
    window.relayMovie = { chunks, rec };
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
    window.relayFrames = [];
    let last = "";
    const end = performance.now() + 5000;
    function frame() {
      const d = c.dataset,
        key = [d.sheet, d.frame, d.astaRelayAction, d.astaRelayPhase].join("/");
      if (
        d.move === "astaDualBreak" &&
        d.physicsState === "attack" &&
        last !== key
      ) {
        window.relayFrames.push({
          key,
          sword: d.astaSword,
          stage: d.astaStage,
          phase: d.astaRelayPhase,
          extensions: d.astaRelayExtensions,
          action: d.astaRelayAction,
          contacts: d.astaRelayContacts,
          weapons: d.astaDrawnWeapons,
          rootX: d.rootX,
          rivalX: d.rivalX,
          png: c.toDataURL(),
        });
        last = key;
      }
      if (performance.now() < end) requestAnimationFrame(frame);
    }
    frame();
  });
}
async function save(page, name) {
  const data = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const { rec, chunks } = window.relayMovie;
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
  const frames = await page.evaluate(() => window.relayFrames);
  frames.forEach(({ png, ...meta }, i) =>
    writeFileSync(
      dir + "/" + name + "-" + i + ".png",
      Buffer.from(png.split(",")[1], "base64"),
    ),
  );
  writeFileSync(
    dir + "/" + name + ".json",
    JSON.stringify(
      frames.map(({ png, ...rest }) => rest),
      null,
      2,
    ),
  );
  return frames;
}
test("Relay chooses two swords with fresh real keyboard inputs from every opening", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await start(page);
  const routes = [
    ["slayer", "slasher", "destroyer"],
    ["slasher", "destroyer", "dweller"],
    ["dweller", "slayer", "slasher"],
    ["destroyer", "dweller", "slayer"],
  ];
  for (const [initial, first, second] of routes) {
    await page.locator("#reset-positions").click();
    await page.waitForTimeout(250);
    await page.locator("#asta-sword-0").selectOption(initial);
    await approach(page);
    await record(page);
    await downDown(page, "l");
    await expect(c).toHaveAttribute("data-move", "astaDualBreak");
    for (const [i, sword] of [first, second].entries()) {
      await page.waitForFunction(
        (i) => {
          const d = document.querySelector("canvas").dataset;
          return d.astaRelayWindow === "true" && +d.astaRelayExtensions === i;
        },
        i,
        { timeout: 2500, polling: "raf" },
      );
      await choose(page, sword);
      await expect(c).toHaveAttribute(
        "data-asta-relay-extensions",
        String(i + 1),
      );
      await expect(c).toHaveAttribute("data-asta-sword", sword);
    }
    await expect(c).toHaveAttribute("data-physics-state", "idle", {
      timeout: 5000,
    });
    await expect(c).toHaveAttribute("data-asta-relay-phase", "");
    await expect(c).toHaveAttribute("data-asta-sword", second);
    const frames = await save(page, initial + "-" + first + "-" + second);
    expect(new Set(frames.map((f) => f.action)).size).toBe(4);
    expect(frames.every((f) => f.weapons === "1")).toBe(true);
    expect(frames.some((f) => f.phase === "finish")).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("Black Slash real J pursuit is optional and physically closes distance", async ({
  page,
}) => {
  const c = await start(page);
  await approach(page, 220);
  await downDown(page, "j");
  await expect(c).toHaveAttribute("data-move", "astaBlackSlash");
  await page.waitForFunction(
    () => +document.querySelector("#combo-hits").textContent >= 1,
  );
  const x = +(await c.getAttribute("data-root-x"));
  await page.keyboard.press("j", { delay: 20 });
  await expect(c).toHaveAttribute("data-move", "astaBlackSlashPursuit");
  await page.waitForTimeout(140);
  await c.screenshot({ path: dir + "/black-slash-pursuit.png" });
  await expect(c).toHaveAttribute("data-physics-state", "idle");
  expect(+(await c.getAttribute("data-root-x"))).toBeGreaterThan(x + 55);
  await expect(c).toHaveAttribute("data-asta-sword", "dweller");
});
