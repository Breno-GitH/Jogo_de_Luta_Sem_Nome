import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const ids = ["dojo", "budokai", "cairo", "enies", "uchiha", "anteiku", "undertown", "godvalley", "clover"];

test("nine arenas render in the real training match and keep animating", async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const dir = "docs/arenas/evidencias/renderizado";
  await mkdir(dir, { recursive: true });
  for (const id of ids) {
    await page.goto("./", { waitUntil: "domcontentloaded" });
    await page.click("#training");
    await page.check("#character-samurai");
    await page.click("#confirm-character");
    await page.check("#opponent-goku");
    await page.click("#confirm-character");
    await page.selectOption("#arena-select", id);
    await page.selectOption("#arena-mode", "interativo");
    await expect(page.locator("#arena-preview")).toHaveAttribute("src", new RegExp(`/arenas/${id}${["undertown", "clover"].includes(id) ? "-open" : ""}\\.png$`));
    await page.click("#fight");
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveAttribute("data-arena", id, { timeout: 60000 });
    await expect(canvas).toHaveAttribute("data-match-phase", "fight", { timeout: 60000 });
    await canvas.screenshot({ path: `${dir}/${id}-inicio.png` });
    const video = await canvas.evaluate(async element => {
      const stream = element.captureStream(20);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const finished = new Promise(resolve => {
        recorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.readAsDataURL(new Blob(chunks, { type: "video/webm" }));
        };
      });
      recorder.start();
      await new Promise(resolve => setTimeout(resolve, 1200));
      recorder.stop();
      return finished;
    });
    await writeFile(`${dir}/${id}-vivo.webm`, Buffer.from(video, "base64"));
    await canvas.screenshot({ path: `${dir}/${id}-vivo.png` });
    expect(await canvas.getAttribute("data-arena-mode")).toBe("interativo");
  }
  expect(errors).toEqual([]);
});
