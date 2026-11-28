import { arenaPlatforms, descentProgress, lowerLevelOffset } from "../engine/arena-layouts";
import type { ArenaState } from "../engine/arenas";

const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Solid tops are exactly the collision surfaces; uprights remain in the background plane. */
export function drawArenaPlatforms(c: CanvasRenderingContext2D, a: ArenaState, image?: HTMLImageElement) {
  for (const p of arenaPlatforms(a)) {
    if (p.id.startsWith("crystal:") || p.id.startsWith("rubble:")) continue;
    const metal = p.material === "metal", y = p.y;
    if (!metal) {
      // Rooted outcrops: their stone continues into the main mesa instead of hovering.
      const baseX = Math.max(253, Math.min(944, p.x + 28));
      c.fillStyle = "#826047";
      c.beginPath(); c.moveTo(p.x, y + 3); c.lineTo(p.x + p.width, y + 3);
      c.lineTo(p.x + p.width - 8, y + 17); c.lineTo(p.x + p.width - 24, y + 26);
      c.lineTo(p.x + p.width - 18, y + 56); c.lineTo(baseX + 134, y + 78);
      c.lineTo(baseX + 125, 620); c.lineTo(baseX - 9, 620); c.lineTo(baseX - 17, y + 70); c.lineTo(p.x + 4, y + 32); c.closePath(); c.fill();
      if (image?.complete && image.naturalWidth) {
        c.save(); c.clip();
        c.drawImage(image, image.naturalWidth * .28, image.naturalHeight * .79,
          image.naturalWidth * .35, image.naturalHeight * .2, p.x - 3, y + 3, p.width + 6, 620 - y);
        c.restore();
      }
      c.fillStyle = "#b28a60";
      c.beginPath(); c.moveTo(p.x + 7, y + 8); c.lineTo(p.x + p.width - 18, y + 8);
      c.lineTo(baseX + 103, y + 36); c.lineTo(baseX + 82, 615); c.lineTo(baseX + 6, 615); c.closePath();
      if (!image?.complete) c.fill();
      for (let i = 0; i < 30; i++) {
        const yy = y + 17 + i * 19 % 136, xx = baseX + i * 37 % 108;
        if (!image?.complete) rect(c, ["#604738", "#d0ab79", "#9b704e", "#b8956d"][i % 4], xx, yy, 7 + i % 4 * 7, 3 + i % 3 * 3);
      }
      c.strokeStyle = "#514532"; c.lineWidth = 3; c.beginPath();
      c.moveTo(baseX + 95, y + 12); c.lineTo(baseX + 85, y + 47); c.lineTo(baseX + 96, y + 73); c.lineTo(baseX + 74, 614); c.stroke();
      rect(c, "#75804a", p.x - 3, y, p.width + 6, 5);
      rect(c, "#c1c88c", p.x + 2, y, p.width - 4, 2);
      for (let i = 0; i < 9; i++) rect(c, "#536b3c", p.x + i * p.width / 9, y + 5, 11, 6 + i % 3 * 3);
      continue;
    }
    for (const x of [p.x + 12, p.x + p.width - 18]) {
      rect(c, metal ? "#282a43" : "#555346", x, y + 14, metal ? 9 : 28, 580 - y);
      rect(c, metal ? "#686d85" : "#9b947d", x + 2, y + 14, metal ? 3 : 19, 580 - y);
      if (!metal) for (let yy = y + 23; yy < 580; yy += 22) {
        rect(c, "#4f5549", x, yy, 28, 3);
        rect(c, "#596c42", x + (yy % 3) * 5, yy + 2, 9, 5);
      }
    }
    rect(c, "#18212c", p.x - 3, y - 1, p.width + 6, 19);
    rect(c, metal ? "#627284" : "#9f987f", p.x, y + 2, p.width, 11);
    rect(c, metal ? "#a7dccb" : "#d9d0a8", p.x, y, p.width, 3);
    rect(c, metal ? "#343b53" : "#635f50", p.x + 3, y + 12, p.width - 6, 4);
    if (!metal) {
      rect(c, "#7b8257", p.x - 5, y + 13, p.width + 10, 6);
      for (let i = 0; i < 9; i++) rect(c, "#536b3c", p.x + i * p.width / 9, y + 15, 11, 6 + i % 3 * 3);
    }
    for (let x = p.x + 8; x < p.x + p.width - 3; x += metal ? 22 : 37) {
      rect(c, metal ? "#b9b8a2" : "#4a4c44", x, y + 6, metal ? 3 : 2, metal ? 3 : 7);
      if (metal) rect(c, "#b99551", x + 6, y + 8, 7, 3);
    }
  }
}

/** All particles derive from the shared tick. They never write into the simulation. */
export function drawLowerArenaLife(c: CanvasRenderingContext2D, a: ArenaState) {
  const bridge = a.id === "enies";
  for (let i = 0; i < 20; i++) {
    const x = (i * 137 + a.tick * (bridge ? .5 : .22)) % 1280;
    const y = 225 + (i * 83 % 320);
    rect(c, bridge ? "#80b5c966" : "#c0ad8166", x, y, bridge ? 7 : 3, 2);
  }
  if (bridge) for (let i = 0; i < 19; i++)
    rect(c, "#cee9ee", (i * 73 + Math.floor(a.tick / 5)) % 1280, 421 + i % 3 * 7, 9 + i % 4 * 3, 2);
  else for (let i = 0; i < 16; i++)
    rect(c, "#a7cbd8", (i * 89 + Math.floor(a.tick / 3)) % 1280, 472 + i % 3 * 3, 12, 2);
  // Upper wreckage remains visible in this level for the rest of the round.
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 148;
    rect(c, bridge ? "#424e63" : "#57463a", x, 27 + i % 3 * 14, 49, 10);
    rect(c, bridge ? "#8898a5" : "#978162", x + 6, 25 + i % 3 * 14, 28, 4);
  }
}

export function drawDescentDebris(c: CanvasRenderingContext2D, a: ArenaState) {
  if (!a.transition) return;
  const p = descentProgress(a), tick = a.transition.tick;
  for (let i = 0; i < 36; i++) {
    const x = (i * 89 + a.transition.x) % 1280;
    const y = 588 + p * lowerLevelOffset + Math.sin(i * 11) * 87 + (tick % 7) * 2;
    rect(c, i % 2 ? "#8b806e" : "#c9bca0", x, y, 7 + i % 4 * 5, 4 + i % 3 * 3);
  }
  if (tick > 64) {
    const spread = (tick - 64) * 16;
    for (let i = -6; i <= 6; i++) {
      const x = 640 + i * spread / 6;
      rect(c, "#c4b69d88", x, 580 + lowerLevelOffset - Math.abs(i % 3) * 7, 17, 5);
    }
  }
}
