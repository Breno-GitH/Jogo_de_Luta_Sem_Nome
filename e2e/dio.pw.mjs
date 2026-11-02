import { test, expect } from "@playwright/test";
import fs from "node:fs";

const manifests = Object.fromEntries(
  ["dio", "the-world"].map((name) => [
    name,
    JSON.parse(fs.readFileSync(`public/sprites/${name}/movement.json`, "utf8")),
  ]),
);
async function begin(page) {
  await page.goto(process.env.DIO_PREVIEW_URL ?? "/");
  await page.locator("#dio-preview-link").click();
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  fs.mkdirSync("art/dio/qa/movement", { recursive: true });
  return canvas;
}
async function saveCanvas(canvas, file) {
  fs.writeFileSync(
    file,
    Buffer.from(
      (await canvas.evaluate((n) => n.toDataURL("image/png"))).split(",")[1],
      "base64",
    ),
  );
}

test("all 178 revised movement poses load, pause, step, download and render independently", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const canvas = await begin(page);
  await page.selectOption("#speed", "0.25");
  const rendered = {};
  for (const [entity, manifest] of Object.entries(manifests)) {
    await page.selectOption("#entity", entity);
    for (const [name, clip] of Object.entries(manifest.clips)) {
      await page.selectOption("#animation", name);
      const frames = [];
      for (let i = 0; i < clip.count; i++) {
        await page
          .getByRole("button", { name: `Quadro ${i + 1}`, exact: true })
          .click();
        await expect(canvas).toHaveAttribute("data-animation", name);
        await expect(canvas).toHaveAttribute("data-frame", String(i));
        await expect(canvas).toHaveAttribute("data-paused", "true");
        frames.push(await canvas.evaluate((n) => n.toDataURL()));
      }
      expect(new Set(frames).size, `${entity}/${name}`).toBe(clip.count);
      await expect(page.locator("#download")).toHaveAttribute(
        "href",
        new RegExp(`${entity}/${name}\\.png$`),
      );
      await page.getByRole("button", { name: "Quadro 1", exact: true }).click();
      await page.locator("#frame-next").click();
      await expect(canvas).toHaveAttribute(
        "data-frame",
        String(clip.count === 1 ? 0 : 1),
      );
      await page.locator("#frame-previous").click();
      await expect(canvas).toHaveAttribute("data-frame", "0");
      await saveCanvas(canvas, `art/dio/qa/movement/${entity}-${name}.png`);
      rendered[`${entity}/${name}`] = frames.length;
    }
  }
  fs.writeFileSync(
    "art/dio/qa/movement/browser-frames.json",
    JSON.stringify(rendered, null, 2),
  );
  await expect(page.locator("#error")).toBeEmpty();
  expect(errors).toEqual([]);
});

test("keyboard walks, crouches, dashes in either key order, jumps and keeps the Stand off the floor", async ({
  page,
}) => {
  test.setTimeout(45000);
  const canvas = await begin(page);
  await page.locator("#guides").check();
  await canvas.click();
  await page.keyboard.down("d");
  await expect(canvas).toHaveAttribute("data-owner-state", "walkForward");
  await expect(canvas).toHaveAttribute("data-stand-animation", "followForward");
  await page.waitForTimeout(130);
  await saveCanvas(canvas, "art/dio/qa/movement/duo-walking-debug.png");
  await page.keyboard.up("d");
  await page.keyboard.down("a");
  await expect(canvas).toHaveAttribute("data-owner-state", "walkBack");
  await expect(canvas).toHaveAttribute("data-facing", "1");
  await expect(canvas).toHaveAttribute(
    "data-stand-animation",
    "followBackward",
  );
  await page.keyboard.up("a");
  await page.keyboard.down("s");
  await expect(canvas).toHaveAttribute("data-owner-state", "crouchIdle");
  await page.keyboard.up("s");
  await expect
    .poll(() => canvas.getAttribute("data-owner-state"), { intervals: [10] })
    .toBe("crouchEnd");
  await expect(canvas).toHaveAttribute("data-owner-state", "idle");
  await page.keyboard.down("Shift");
  await page.waitForTimeout(50);
  await page.keyboard.down("d");
  await expect
    .poll(() => canvas.getAttribute("data-owner-state"), { intervals: [10] })
    .toBe("dashForward");
  await expect(canvas).toHaveAttribute("data-stand-animation", "dashFollow");
  await page.keyboard.up("d");
  await page.keyboard.up("Shift");
  await expect(canvas).toHaveAttribute("data-owner-state", "idle");
  await page.keyboard.down("a");
  await expect(canvas).toHaveAttribute("data-owner-state", "walkBack");
  await page.keyboard.down("Shift");
  await expect
    .poll(() => canvas.getAttribute("data-owner-state"), { intervals: [10] })
    .toBe("backdash");
  await page.keyboard.up("Shift");
  await page.keyboard.up("a");
  await expect(canvas).toHaveAttribute("data-owner-state", "idle");
  await page.selectOption("#speed", "0.5");
  await canvas.click();
  await page.keyboard.press("w");
  await expect
    .poll(() => canvas.getAttribute("data-owner-state"), { intervals: [10] })
    .toBe("jumpRise");
  await expect(canvas).toHaveAttribute("data-stand-animation", "jumpFollow");
  const phases = new Set(),
    roots = [];
  for (let i = 0; i < 120; i++) {
    const sample = await canvas.evaluate((n) => ({ ...n.dataset }));
    phases.add(sample.ownerState);
    roots.push(Number(sample.ownerY));
    expect(Number(sample.standY)).toBeLessThan(Number(sample.ownerY) - 7);
    expect(Number(sample.spriteTop)).toBeGreaterThanOrEqual(89);
    expect(Number(sample.spriteLeft)).toBeGreaterThanOrEqual(79);
    expect(Number(sample.spriteRight)).toBeLessThanOrEqual(1201);
    if (sample.ownerState === "jumpApex")
      await saveCanvas(canvas, "art/dio/qa/movement/duo-jump-debug.png");
    if (i > 15 && sample.ownerState === "idle") break;
    await page.waitForTimeout(20);
  }
  for (const phase of ["jumpRise", "jumpApex", "jumpFall", "landing", "idle"])
    expect(phases.has(phase), phase).toBe(true);
  expect(Math.min(...roots)).toBeLessThan(440);
  expect(roots.at(-1)).toBe(580);
  await page.selectOption("#speed", "1");
  await page.locator("#reset").click();
  await page.locator("#flip").click();
  await expect(canvas).toHaveAttribute("data-facing", "-1");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-stand-x")), {
      intervals: [20],
    })
    .toBe(550);
  await expect(canvas).toHaveAttribute("data-order", "the-world,dio");
  await expect(page.locator("#debug-info")).toContainText("Alvo");
  await saveCanvas(canvas, "art/dio/qa/movement/duo-left-debug.png");
  await page.selectOption("#speed", "2");
  await canvas.click();
  await page.keyboard.down("a");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-owner-x")), {
      intervals: [20, 40],
      timeout: 11000,
    })
    .toBe(80);
  await page.keyboard.up("a");
  expect(
    Number(await canvas.getAttribute("data-sprite-left")),
  ).toBeGreaterThanOrEqual(79);
  await page.keyboard.down("d");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-owner-x")), {
      intervals: [20, 40],
      timeout: 11000,
    })
    .toBe(1200);
  await page.keyboard.up("d");
  expect(
    Number(await canvas.getAttribute("data-sprite-right")),
  ).toBeLessThanOrEqual(1201);
});

test("independent pause, fixed-tick stepping, front deployment and return preserve separate layers", async ({
  page,
}) => {
  const canvas = await begin(page);
  await page.locator("#pause").click();
  const tick = Number(await canvas.getAttribute("data-stand-tick"));
  await page.waitForTimeout(100);
  await expect(canvas).toHaveAttribute("data-stand-tick", String(tick));
  await page.locator("#next").click();
  await expect(canvas).toHaveAttribute("data-stand-tick", String(tick + 1));
  await page.locator("#pause").click();
  await page.locator("#freeze-stand").check();
  const frozen = await canvas.getAttribute("data-stand-tick"),
    before = Number(await canvas.getAttribute("data-dio-tick"));
  await page.waitForTimeout(100);
  await expect(canvas).toHaveAttribute("data-stand-tick", frozen);
  expect(Number(await canvas.getAttribute("data-dio-tick"))).toBeGreaterThan(
    before,
  );
  await page.locator("#freeze-stand").uncheck();
  await page.locator("#compare").check();
  await page.locator("#reset").click();
  await saveCanvas(canvas, "art/dio/qa/movement/duo-neutral.png");
  await page.locator("#deploy").click();
  await expect
    .poll(() => canvas.getAttribute("data-stand-state"), {
      intervals: [10, 20, 30],
    })
    .toBe("hold");
  await page.locator("#pause").click();
  await expect(canvas).toHaveAttribute("data-order", "dio,samurai,the-world");
  await saveCanvas(canvas, "art/dio/qa/movement/duo-front.png");
  await page.locator("#pause").click();
  await expect(canvas).toHaveAttribute("data-stand-state", "hover");
  await expect(canvas).toHaveAttribute("data-order", "the-world,dio,samurai");
});
