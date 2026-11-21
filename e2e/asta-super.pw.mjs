import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const dir =
  process.env.ASTA_SUPER_EVIDENCE_DIR ??
  "deployment/msfd-work/asta-super-arena";
mkdirSync(dir, { recursive: true });
async function start(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/sprites/asta/"))
      errors.push(r.url());
  });
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
  const c = page.locator("canvas");
  await expect(c).toHaveAttribute("data-match-phase", "fight", {
    timeout: 45000,
  });
  await page.locator("#infinite-health").uncheck();
  await page.locator("#unlimited-meter").uncheck();
  await page.locator("#fill-meter").click();
  await c.focus();
  return { c, errors };
}
async function record(page) {
  await page.evaluate(() => {
    const c = document.querySelector("canvas"),
      chunks = [],
      rec = new MediaRecorder(c.captureStream(30), {
        mimeType: "video/webm;codecs=vp8",
      });
    window.superCapture = { frames: [], trace: [], chunks, rec, active: true };
    const s = window.superCapture;
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
    const seen = new Set();
    function poll() {
      const d = { ...c.dataset },
        t = +d.astaUnionTick;
      s.trace.push(d);
      const key =
        t >= 0
          ? d.astaUnionPhase
          : d.move === "astaBlackMeteorite"
            ? "opener"
            : "";
      if (key && !seen.has(key)) {
        seen.add(key);
        s.frames.push({ key, png: c.toDataURL(), state: d });
      }
      if (t >= 230 && t <= 233 && !seen.has("impact")) {
        seen.add("impact");
        s.frames.push({ key: "impact", png: c.toDataURL(), state: d });
      }
      for (const at of [38, 70, 100, 126, 154, 184, 214, 236, 264]) {
        const key = "frame-" + at;
        if (t >= at && t <= at + 2 && !seen.has(key)) {
          seen.add(key);
          s.frames.push({ key, png: c.toDataURL(), state: d });
        }
      }
      if (s.active) requestAnimationFrame(poll);
    }
    poll();
  });
}
async function save(page, name) {
  const data = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const s = window.superCapture;
        s.active = false;
        s.rec.onstop = () => {
          const r = new FileReader();
          r.onload = () =>
            resolve({ video: r.result, frames: s.frames, trace: s.trace });
          r.readAsDataURL(new Blob(s.chunks, { type: "video/webm" }));
        };
        s.rec.stop();
      }),
  );
  writeFileSync(
    dir + "/" + name + ".webm",
    Buffer.from(data.video.split(",")[1], "base64"),
  );
  data.frames.forEach((f) =>
    writeFileSync(
      dir + "/" + name + "-" + f.key + ".png",
      Buffer.from(f.png.split(",")[1], "base64"),
    ),
  );
  writeFileSync(
    dir + "/" + name + ".json",
    JSON.stringify(
      { frames: data.frames.map(({ png, ...f }) => f), trace: data.trace },
      null,
      2,
    ),
  );
  return data;
}
test("Black Meteorite confirms into Liebe, four-sword Devil Union and Equinox, then restores combat", async ({
  page,
}) => {
  const { c, errors } = await start(page);
  await record(page);
  await page.keyboard.press("r");
  await expect(c).toHaveAttribute("data-capture", "astaUnion");
  await expect(c).toHaveAttribute("data-asta-form", "union", { timeout: 4000 });
  await expect(c).toHaveAttribute("data-capture", "none", { timeout: 8000 });
  await expect(c).toHaveAttribute("data-physics-state", "idle");
  await expect(c).toHaveAttribute("data-asta-form", "base");
  await expect(c).toHaveAttribute("data-asta-sword", "slasher");
  await expect(c).toHaveAttribute("data-meter", "0");
  await expect(c).toHaveAttribute("data-p2-health", "660");
  await page.waitForTimeout(1000);
  await page.keyboard.press("d", { delay: 90 });
  const data = await save(page, "complete");
  expect(
    new Set(
      data.frames.filter((f) => !f.key.startsWith("frame-")).map((f) => f.key),
    ),
  ).toEqual(
    new Set([
      "opener",
      "meteorite",
      "liebe",
      "union",
      "rush",
      "cross",
      "rise",
      "dive",
      "equinoxCharge",
      "equinox",
      "impact",
      "return",
    ]),
  );
  expect(
    new Set(
      data.trace.filter((d) => d.astaUnionTick !== "-1").map((d) => d.sheet),
    ).size,
  ).toBeGreaterThanOrEqual(7);
  expect(errors).toEqual([]);
  await c.screenshot({ path: dir + "/restored.png" });
});
test("Standing guard and long whiff refuse the cinematic and spend one Super", async ({
  page,
}) => {
  const { c, errors } = await start(page);
  await page.locator("#dummy").selectOption("guard");
  await c.focus();
  await record(page);
  await page.keyboard.press("r");
  await page.waitForTimeout(1600);
  await expect(c).toHaveAttribute("data-p2-health", "1000");
  await expect(c).toHaveAttribute("data-meter", "0");
  const guarded = await save(page, "guarded");
  expect(guarded.trace.some((d) => d.capture === "astaUnion")).toBe(false);
  await page.locator("#reset-positions").click();
  await page.locator("#fill-meter").click();
  await page.locator("#dummy").selectOption("idle");
  await c.focus();
  await page.keyboard.down("a");
  await page.waitForTimeout(1200);
  await page.keyboard.up("a");
  await record(page);
  await page.keyboard.press("r");
  await page.waitForTimeout(1600);
  const whiff = await save(page, "whiff");
  expect(whiff.trace.some((d) => d.capture === "astaUnion")).toBe(false);
  await expect(c).toHaveAttribute("data-p2-health", "1000");
  await expect(c).toHaveAttribute("data-physics-state", "idle");
  expect(errors).toEqual([]);
});
test("Body choreography, Liebe and distinct forms remain readable with anti-magic FX off", async ({
  page,
}) => {
  const { c, errors } = await start(page);
  await page.locator("#asta-fx").uncheck();
  await c.focus();
  await record(page);
  await page.keyboard.press("r");
  await expect(c).toHaveAttribute("data-capture", "astaUnion");
  await expect(c).toHaveAttribute("data-capture", "none", { timeout: 8000 });
  const data = await save(page, "no-fx");
  expect(
    data.frames.filter((f) =>
      ["rush", "rise", "dive", "equinox"].includes(f.key),
    ),
  ).toHaveLength(4);
  await expect(c).toHaveAttribute("data-p2-health", "660");
  expect(errors).toEqual([]);
});
