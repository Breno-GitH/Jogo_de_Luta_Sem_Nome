import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.env.MSFD_TEST_URL ?? "http://127.0.0.1:5180/";
const out = process.env.MSFD_ENTRANCE_EVIDENCE ?? "deployment/audit/entrances";
const ids = [
  "samurai",
  "dio",
  "goku",
  "luffy",
  "sasuke",
  "kaneki",
  "ben",
  "xebec",
  "asta",
];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const [i, id] of ids.entries()) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400 && r.url().includes("/sprites/"))
        errors.push(r.url());
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.locator("#training").click();
    await page.locator("#character-" + id).check();
    await page.locator("#confirm-character").click();
    await page.locator("#opponent-" + ids[(i + 1) % ids.length]).check();
    await page.locator("#confirm-character").click();
    // Observe the real rendered canvas, never inject match state or bypass the game loop.
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const s = (window.introAudit = {
        active: true,
        started: false,
        frames: [],
        trace: [],
        chunks: [],
      });
      const seen = new Set();
      function poll() {
        const d = Object.fromEntries(
          [
            "matchPhase",
            "introFull",
            "introTick",
            "introAge0",
            "introAge1",
            "introStage",
            "introVotes",
            "introSkipped",
            "frame",
            "animation",
            "sheet",
            "rivalSheet",
            "physicsState",
            "targetState",
            "p1Health",
            "p2Health",
            "playerX",
            "targetX",
            "astaSword",
            "astaForm",
            "companionClip",
            "omnitrixForm",
          ].map((k) => [k, canvas.dataset[k]]),
        );
        if (!s.started && d.matchPhase === "intro" && d.introFull === "true") {
          s.started = true;
          s.rec = new MediaRecorder(canvas.captureStream(30), {
            mimeType: "video/webm;codecs=vp8",
          });
          s.rec.ondataavailable = (e) => s.chunks.push(e.data);
          s.rec.start();
        }
        if (s.started) {
          if (s.trace.at(-1)?.introTick !== d.introTick) s.trace.push(d);
          for (const [seat, age] of [
            [0, +d.introAge0],
            [1, +d.introAge1],
          ]) {
            for (const at of [8, 30, 48, 66, 88, 110, 132, 158, 178]) {
              const key = `p${seat + 1}-${at}`;
              if (
                d.matchPhase === "intro" &&
                age >= at &&
                age < at + 5 &&
                !seen.has(key)
              ) {
                seen.add(key);
                s.frames.push({ key, png: canvas.toDataURL(), state: d });
              }
            }
          }
        }
        if (s.active) requestAnimationFrame(poll);
      }
      poll();
    });
    await page.locator("#fight").click();
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveAttribute("data-match-phase", "intro", {
      timeout: 45000,
    });
    await canvas.focus();
    await page.keyboard.down("j");
    await page.keyboard.down("r");
    await expect(canvas).toHaveAttribute("data-match-phase", "fight", {
      timeout: 30000,
    });
    await page.keyboard.up("j");
    await page.keyboard.up("r");
    await page.waitForTimeout(180);
    await expect(canvas).toHaveAttribute("data-physics-state", "idle");
    await expect(canvas).toHaveAttribute("data-capture", "none");
    await expect(canvas).toHaveAttribute("data-p1-health", "1000");
    await expect(canvas).toHaveAttribute("data-p2-health", "1000");
    if (id === "asta")
      await expect(canvas).toHaveAttribute("data-asta-sword", "slayer");
    const result = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const s = window.introAudit;
          s.active = false;
          s.rec.onstop = () => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                video: reader.result,
                frames: s.frames,
                trace: s.trace,
              });
            reader.readAsDataURL(new Blob(s.chunks, { type: "video/webm" }));
          };
          s.rec.stop();
        }),
    );
    expect(
      result.trace
        .filter((d) => d.matchPhase === "intro")
        .every(
          (d) =>
            d.p1Health === "1000" &&
            d.p2Health === "1000" &&
            !["attack", "hurt"].includes(d.physicsState),
        ),
    ).toBe(true);
    expect(
      new Set(
        result.trace
          .filter((d) => d.physicsState === "entrance")
          .map((d) => d.frame),
      ).size,
    ).toBeGreaterThanOrEqual(8);
    writeFileSync(
      `${out}/${id}.webm`,
      Buffer.from(result.video.split(",")[1], "base64"),
    );
    for (const f of result.frames)
      writeFileSync(
        `${out}/${id}-${f.key}.png`,
        Buffer.from(f.png.split(",")[1], "base64"),
      );
    await canvas.screenshot({ path: `${out}/${id}-idle.png` });
    // Quick training reset stays immediate; replay is an explicit separate action.
    await page.locator("#reset-positions").click();
    await expect(canvas).toHaveAttribute("data-match-phase", "fight");
    await page.locator("#replay-entrances").click();
    await expect(canvas).toHaveAttribute("data-match-phase", "intro");
    await canvas.focus();
    await page.keyboard.press("Enter");
    await expect(canvas).toHaveAttribute("data-intro-skipped", "true");
    await expect(canvas).toHaveAttribute("data-match-phase", "fight");
    await canvas.focus();
    await page.keyboard.press("j");
    await expect(canvas).toHaveAttribute("data-physics-state", "attack");
    expect(errors).toEqual([]);
    results.push({
      id,
      opponent: ids[(i + 1) % ids.length],
      errors,
      frames: result.frames.map(({ png, ...f }) => f),
      trace: result.trace,
    });
    await page.close();
    console.log(
      `${id}: body cels, props, safe controls, quick reset, replay and skip OK`,
    );
  }
  writeFileSync(
    `${out}/result.json`,
    JSON.stringify({ url, results }, null, 2),
  );
} finally {
  await browser.close();
}
