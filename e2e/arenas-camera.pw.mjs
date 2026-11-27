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

test("all nine arena interactions paint their damaged or active state", async ({ page }) => {
  test.setTimeout(120000);
  await mkdir("docs/arenas/evidencias/interacoes", { recursive: true });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  const kinds = { dojo: "floor", cairo: "debris", enies: "fall", uchiha: "debris",
    anteiku: "debris", undertown: "surge", godvalley: "fall", clover: "surge" };
  for (const id of ids) {
    const pixels = await page.evaluate(async ({ id, kind }) => {
      const [{ drawArena }, { drawArenaLife }, { createArena }] = await Promise.all([
        import("/src/render/arena.ts"), import("/src/render/arena-life.ts"), import("/src/engine/arenas.ts"),
      ]);
      const image = new Image(); image.src = `/arenas/${id}.png`; await image.decode();
      const variantId = id === "dojo" ? "dojo-damaged" : id === "uchiha" ? "uchiha-ruin" : "";
      const variant = variantId ? new Image() : undefined;
      if (variant) { variant.src = `/arenas/${variantId}.png`; await variant.decode(); }
      const canvas = document.querySelector("#interaction-proof") ?? document.createElement("canvas");
      canvas.id = "interaction-proof"; canvas.width = 1280; canvas.height = 720;
      if (!canvas.isConnected) document.body.append(canvas);
      const c = canvas.getContext("2d", { willReadFrequently: true });
      c.clearRect(0, 0, 1280, 720);
      const arena = createArena(id, "caotico");
      arena.tick = 120; arena.phase = 4; arena.phaseStart = 1;
      arena.integrity = 9; arena.reactionX = 640; arena.reactionUntil = 150;
      if (kind) arena.hazard = { kind, x: 640, phase: "active", ticks: 20, affected: [false, false] };
      if (kind === "fall") arena.collapsed = [640];
      if (id === "budokai") arena.falling[1] = { kind: "ringout", tick: 15, x: 65 };
      drawArena(c, arena, image, 0, variant);
      drawArenaLife(c, arena, undefined, image);
      const rgba = c.getImageData(0, 0, 1280, 720).data;
      let transparent = 0;
      for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) transparent++;
      return transparent;
    }, { id, kind: kinds[id] });
    expect(pixels, id).toBe(0);
    await page.locator("#interaction-proof").screenshot({ path: `docs/arenas/evidencias/interacoes/${id}-caotico.png` });
  }
});
