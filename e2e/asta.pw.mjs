import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const evidence = process.env.ASTA_BASE_EVIDENCE_DIR ?? "deployment/audit/asta";
mkdirSync(evidence, { recursive: true });
async function start(page, mode = "training", opponent = "Samurai") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/sprites/asta/"))
      errors.push(r.url());
  });
  await page.goto("./", { waitUntil: "domcontentloaded", timeout: 35000 });
  await page.locator("#" + mode).click();
  await page
    .getByRole("radio", { name: "Selecionar Asta", exact: true })
    .check();
  await page.locator("#confirm-character").click();
  if (mode !== "arcade") {
    await page
      .getByRole("radio", { name: "Selecionar " + opponent, exact: true })
      .check();
    await page.locator("#confirm-character").click();
  }
  await page.locator("#fight").click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen","fight",{timeout:45000});
  const c = page.locator("canvas");
  await expect(c).toHaveAttribute("data-sheet",/^asta\//);
  await expect(c).toHaveAttribute("data-match-phase", "fight", {
    timeout: 45000,
  });
  await c.focus();
  return { c, errors };
}
async function shot(page, name) {
  const data = await page.locator("canvas").evaluate((c) => c.toDataURL());
  writeFileSync(
    evidence + "/" + name + ".png",
    Buffer.from(data.split(",")[1], "base64"),
  );
}
test("Asta four swords, movement and all 36 authored normals", async ({
  page,
}) => {
  test.setTimeout(140000);
  const { c, errors } = await start(page);
  await expect(c).toHaveAttribute("data-asta-sword", "slayer");
  await page.evaluate(() => {
    const chunks = [];
    const rec = new MediaRecorder(
      document.querySelector("canvas").captureStream(30),
      { mimeType: "video/webm;codecs=vp8" },
    );
    window.astaRecording = { rec, chunks };
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
  });
  for (const sword of ["slayer", "slasher", "dweller", "destroyer"]) {
    await page.locator("#asta-sword-0").selectOption(sword);
    await c.focus();
    await expect(c).toHaveAttribute("data-asta-sword", sword);
    await shot(page, sword + "-idle");
    await page.keyboard.down("d");
    await expect(c).toHaveAttribute("data-animation", "walkForward");
    await shot(page, sword + "-walk");
    await page.keyboard.up("d");
    for (const [posture, key] of [
      ["stand", ""],
      ["crouch", "s"],
      ["air", "w"],
    ]) {
      for (const [rank, button] of [
        ["light", "j"],
        ["medium", "k"],
        ["heavy", "l"],
      ]) {
        await page.waitForTimeout(700);
        await c.focus();
        if (key === "s") await page.keyboard.down(key);
        if (key === "w") {
          await page.keyboard.press(key);
          await expect(c).toHaveAttribute("data-physics-state", "air");
        }
        const active = page.waitForFunction(
          () =>
            document.querySelector("canvas").dataset.phase === "active"
              ? document.querySelector("canvas").toDataURL()
              : null,
          null,
          { polling: "raf", timeout: 3500 },
        );
        await page.keyboard.press(button, { delay: 25 });
        await expect(c).toHaveAttribute("data-move", posture + "_" + rank);
        const data = await (await active).jsonValue();
        writeFileSync(
          evidence + "/" + sword + "-" + posture + "-" + rank + ".png",
          Buffer.from(data.split(",")[1], "base64"),
        );
        if (key === "s") await page.keyboard.up(key);
      }
    }
    await page.waitForTimeout(850);
  }
  const movie = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const { rec, chunks } = window.astaRecording;
        rec.onstop = () => {
          const f = new FileReader();
          f.onload = () => resolve(f.result);
          f.readAsDataURL(new Blob(chunks, { type: "video/webm" }));
        };
        rec.stop();
      }),
  );
  writeFileSync(
    evidence + "/quatro-espadas.webm",
    Buffer.from(movie.split(",")[1], "base64"),
  );
  expect(errors).toEqual([]);
});
for (const mode of ["arcade", "versus"])
  test("Asta plays " + mode, async ({ page }) => {
    const { c, errors } = await start(page, mode);
    await page.keyboard.press("j", { delay: 30 });
    await expect(c).toHaveAttribute("data-move", "stand_light");
    await expect(c).toHaveAttribute("data-physics-state", "idle");
    await page.keyboard.press("w", { delay: 40 });
    await expect(c).toHaveAttribute("data-physics-state", "air");
    await shot(page, mode);
    expect(errors).toEqual([]);
  });

test("Asta confirms a real ground combo and aerial pursuit", async ({
  page,
}) => {
  const { c, errors } = await start(page);
  async function close() {
    await c.focus();
    await page.keyboard.down("d");
    await page.waitForFunction(() => {
      const d = document.querySelector("canvas").dataset;
      return Math.abs(Number(d.rivalX) - Number(d.rootX)) <= 92;
    });
    await page.keyboard.up("d");
  }
  await close();
  await page.keyboard.press("j", { delay: 35 });
  await expect(c).toHaveAttribute("data-combo", "1");
  await page.keyboard.press("k", { delay: 35 });
  await expect(c).toHaveAttribute("data-combo", "2");
  await page.keyboard.press("l", { delay: 35 });
  await expect(c).toHaveAttribute("data-combo", "3");
  await shot(page, "ground-combo");
  await page.locator("#reset-positions").click();
  await close();
  await page.keyboard.down("s");
  await page.keyboard.press("l", { delay: 35 });
  await page.keyboard.up("s");
  await expect(c).toHaveAttribute("data-combo", "1");
  await page.keyboard.down("d");
  await page.keyboard.press("w", { delay: 35 });
  await page.keyboard.up("d");
  await expect(c).toHaveAttribute("data-physics-state", "air");
  await page.keyboard.press("j", { delay: 35 });
  await expect(c).toHaveAttribute("data-combo", "2");
  await page.keyboard.press("k", { delay: 35 });
  await expect(c).toHaveAttribute("data-combo", "3");
  await page.keyboard.press("l", { delay: 35 });
  await expect(c).toHaveAttribute("data-combo", "4");
  await shot(page, "air-combo");
  expect(errors).toEqual([]);
});

for(const opponent of ['Dio Brando','Goku'])test('Asta scale beside '+opponent,async({page})=>{
 const {c,errors}=await start(page,'training',opponent);await expect(c).toHaveAttribute('data-asta-sword','slayer');await shot(page,'comparison-'+opponent.split(' ')[0]);expect(errors).toEqual([]);
});