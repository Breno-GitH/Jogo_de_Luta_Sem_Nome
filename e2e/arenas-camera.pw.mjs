import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const ids = ["dojo", "budokai", "cairo", "enies", "uchiha", "anteiku", "undertown", "godvalley", "clover"];
const cameras = [
  { name: "normal", x: 640, y: 360, scale: 1, width: 1280, height: 720 },
  { name: "zoom-out", x: 640, y: 360, scale: .58, width: 1280, height: 720 },
  { name: "left-edge", x: 65, y: 360, scale: .82, width: 1280, height: 720 },
  { name: "right-edge", x: 1212, y: 360, scale: .82, width: 1280, height: 720 },
  { name: "airborne", x: 700, y: 80, scale: .72, width: 1280, height: 720 },
  { name: "rotated-super", x: 950, y: 250, scale: .76, angle: .11, width: 1280, height: 720 },
  { name: "tall-screen", x: 640, y: 360, scale: .72, width: 1024, height: 768 },
];

test("every arena covers extreme camera views without transparent pixels", async ({ page }) => {
  test.setTimeout(180000);
  await mkdir("docs/arenas/evidencias/camera", { recursive: true });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  for (const id of ids) {
    for (const camera of cameras) {
      const result = await page.evaluate(async ({ id, camera }) => {
        const [{ drawArena, visibleWorldBounds }, { createArena }] = await Promise.all([
          import("/src/render/arena.ts"), import("/src/engine/arenas.ts"),
        ]);
        const image = new Image();
        image.src = `/arenas/${id}.png`;
        await image.decode();
        const canvas = document.querySelector("#camera-proof") ?? document.createElement("canvas");
        canvas.id = "camera-proof";
        canvas.width = camera.width;
        canvas.height = camera.height;
        if (!canvas.isConnected) document.body.append(canvas);
        const c = canvas.getContext("2d", { willReadFrequently: true });
        c.clearRect(0, 0, canvas.width, canvas.height);
        c.save();
        c.translate(camera.width / 2 + 17, camera.height / 2 - 13);
        if (camera.angle) c.rotate(camera.angle);
        c.scale(camera.scale, camera.scale);
        c.translate(-camera.x, -camera.y);
        const bounds = visibleWorldBounds(c);
        drawArena(c, createArena(id, "caotico"), image);
        c.restore();
        const pixels = c.getImageData(0, 0, canvas.width, canvas.height).data;
        let transparent = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) transparent++;
        return { transparent, bounds };
      }, { id, camera });
      expect(result.transparent, `${id} / ${camera.name} / ${JSON.stringify(result.bounds)}`).toBe(0);
      if (camera.name === "zoom-out")
        await page.locator("#camera-proof").screenshot({ path: `docs/arenas/evidencias/camera/${id}-zoom-out.png` });
    }
  }
});
