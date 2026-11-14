import type { Fighter } from "../engine/combat";
import { kingWill, xebecPressure } from "../engine/xebec-specials";
import { hakiBolt } from "./xebec-haki-fx";

export const kingWillFace = "xebec/king-will-face.png";
const release = xebecPressure(kingWill)!.release;
const smooth = (from: number, to: number, t: number) => {
  const p = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return p * p * (3 - 2 * p);
};

export function kingWillCamera(f: Fighter) {
  const tick = f.stateFrame;
  const focus = smooth(0, 15, tick) * (1 - smooth(27, 48, tick));
  const scale = 1 + focus * .16, bound = 640 / scale;
  return {
    x: Math.max(bound, Math.min(1280 - bound, 640 + (f.x - 640) * focus)),
    y: 360 + focus * 44,
    scale,
    shakeX: tick >= release && tick < release + 10 ? (tick % 3 - 1) * (release + 10 - tick) * .65 : 0,
    shakeY: 0,
  };
}

export function drawKingWillArena(c: CanvasRenderingContext2D, tick: number) {
  const dim = smooth(0, 17, tick) * (1 - smooth(38, 64, tick));
  c.fillStyle = `rgba(26,16,28,${dim * .38})`;
  c.fillRect(-120,-80,1520,810);
  if (tick < release) return;
  const age = tick - release;
  const fade = 1 - smooth(13,33,age);
  c.save();
  c.globalAlpha = fade * .55;
  for (let i = 0; i < 31; i++) {
    const y = 576 + i * 4;
    const x = (i * 217 + age * (i % 2 ? 11 : -11) + 1280) % 1280;
    c.fillStyle = i % 3 ? "#bd4858" : "#ffd6b8";
    c.fillRect(x,y,9 + i % 7 * 5,1 + i % 3);
  }
  c.restore();
}

export function drawKingWillScreen(c: CanvasRenderingContext2D, f: Fighter, image?: HTMLImageElement) {
  const t = f.stateFrame;
  // The existing visual effects setting disables the insert and lighting entirely.
  const inset = smooth(8, 13, t) * (1 - smooth(26,32,t));
  if (!image || !inset) return;
  const cel = t < 15 ? 0 : t < 20 ? 1 : t < 26 ? 2 : 3;
  const x = f.facing === 1 ? 317 : 963;
  const w = 404, h = 199;
  c.save();
  c.globalAlpha *= inset;
  c.translate(x, 200);
  c.scale(f.facing, 1);
  c.beginPath();
  c.moveTo(-w / 2 + 32,0); c.lineTo(w / 2,0);
  c.lineTo(w / 2 - 38,h); c.lineTo(-w / 2,h);
  c.closePath();
  c.clip();
  const bg = c.createLinearGradient(-w/2,0,w/2,h);
  bg.addColorStop(0,"#110d1a"); bg.addColorStop(.54,"#54263b"); bg.addColorStop(1,"#1d101c");
  c.fillStyle = bg;
  c.fillRect(-w/2,0,w,h);
  hakiBolt(c,t,833,{x:-170,y:133},{x:165,y:45},7);
  const d = t - 17;
  c.drawImage(image, cel * 256 + 58, 11, 153, 105,
    -155 - d * .55, -5, 310 + d * 1.1, 213 + d * .75);
  if (cel === 2) {
    const rim = c.createRadialGradient(19,112,1,19,112,37);
    rim.addColorStop(0,"#fb425d62"); rim.addColorStop(1,"#f0374700");
    c.fillStyle = rim;
    c.fillRect(-18,75,74,74);
  }
  c.restore();
}
