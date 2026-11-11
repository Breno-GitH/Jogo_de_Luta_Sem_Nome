import type { Fighter } from "../engine/combat";
import type { AnimationData } from "./animator";

const masks = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

export function drawBenSilhouette(c: CanvasRenderingContext2D, image: HTMLImageElement, art: AnimationData, ticks: number) {
  if (!image.complete || !image.naturalWidth || ticks > 4) return;
  let mask = masks.get(image);
  if (!mask) {
    mask = document.createElement("canvas");
    mask.width = art.frameWidth;
    mask.height = art.frameHeight;
    const ctx = mask.getContext("2d")!;
    ctx.drawImage(image, 0, 0, mask.width, mask.height, 0, 0, mask.width, mask.height);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "#d9ff8c";
    ctx.fillRect(0, 0, mask.width, mask.height);
    masks.set(image, mask);
  }
  c.save();
  c.globalAlpha = (5 - ticks) * .19;
  c.drawImage(mask, -(art.pivot?.x ?? 128), -(art.pivot?.y ?? 224));
  c.restore();
}

export function drawBenAlienFx(c: CanvasRenderingContext2D, fighter: Fighter, clock: number, crown?: { x: number; y: number }) {
  const id = fighter.omnitrix?.active;
  c.save();
  if (id === "heatblast" && crown) {
    for (let i = 0; i < 3; i++) {
      const age = (clock + i * 6) % 18;
      if (age > 12) continue;
      c.fillStyle = age < 5 ? "#ffe574" : "#ed7136";
      c.fillRect(crown.x + (i - 1) * (4 + age / 2) - age / 3 | 0, crown.y - age - 2, 2, 3);
    }
    if (fighter.state === "dash" || fighter.state === "jumpStart") {
      const sign = Math.sign(fighter.vx * fighter.facing) || 1;
      for (let i = 0; i < 4; i++) {
        const x = -sign * (22 + (clock + 7 * i) % 28);
        c.fillStyle = i % 2 ? "#fb772f" : "#ffc154";
        c.fillRect(x, -4 - i * 3, 11 - i * 2, 2);
      }
    }
  } else if (id === "xlr8" && Math.abs(fighter.vx) > 13) {
    const sign = Math.sign(fighter.vx * fighter.facing);
    c.fillStyle = "#74dcf57a";
    for (let i = 0; i < 4; i++)
      c.fillRect(-sign * (56 + (clock + i * 9) % 34), -18 - i * 15, 16 + i * 5, 2);
  } else if (id === "fourArms" && fighter.state === "landing" && fighter.stateFrame < 9) {
    for (const sign of [-1, 1]) {
      const age = fighter.stateFrame;
      c.fillStyle = "#a8b1aa77";
      c.fillRect(sign * (34 + age * 3), -4 - age, 9, 4);
      c.fillRect(sign * (44 + age * 3), -3 - age * 2, 5, 3);
    }
  }
  c.restore();
}

