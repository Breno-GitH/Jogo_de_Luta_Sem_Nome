import type { Match } from "../engine/combat";
import { beamBox, kiBox, gokuInvisible } from "../engine/goku-specials";
import { poseAt } from "../engine/moves";
import data from "../data/goku-special-fx.json";
export const gokuFxSheets = Object.values(data.clips).map((c) => c.sheet);
type Key = keyof typeof data.clips;
/** Discrete pixel sprites; the beam repeats tiles, never stretches one orb. */
export function drawGokuSpecials(
  c: CanvasRenderingContext2D,
  m: Match,
  images: Map<string, HTMLImageElement>,
  debug = false,
) {
  const fx = (
    key: Key,
    frame: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    const meta = data.clips[key],
      im = images.get(meta.sheet);
    if (!im?.complete || !im.naturalWidth) return;
    const n = ((frame % 4) + 4) % 4,
      b = meta.bounds[n];
    c.drawImage(
      im,
      n * 96 + b[0],
      b[1],
      b[2] - b[0],
      b[3] - b[1],
      Math.round(x - w / 2),
      Math.round(y - h / 2),
      Math.round(w),
      Math.round(h),
    );
  };
  for (const f of m.fighters) {
    const move = f.move;
    if (f.data.id !== "goku" || f.state !== "attack" || !move?.special)
      continue;
    const t = f.stateFrame,
      point = poseAt(move, t)?.release ?? { x: 0, y: -80 },
      x = f.x + point.x * f.facing,
      y = f.y + point.y;
    if (
      (move.special === "ki" || move.special === "kamehameha") &&
      t > 1 &&
      t < move.startup
    ) {
      const size = Math.max(4, Math.round(6 + (18 * t) / move.startup));
      fx(
        move.special === "ki" ? "ki" : "origin",
        Math.floor(t / 3),
        x,
        y,
        size,
        size,
      );
    }
    if (move.special === "teleport") {
      const age = t - move.startup,
        end = move.startup + move.active;
      if (gokuInvisible(f))
        fx(
          "teleport",
          Math.min(3, Math.floor((age * 4) / move.active)),
          f.x,
          f.y - 68,
          50,
          150,
        );
      else if (t >= end && t < end + 8)
        fx(
          "teleport",
          3 - Math.min(3, Math.floor((t - end) / 2)),
          f.x,
          f.y - 68,
          50,
          150,
        );
    }
  }
  for (const p of m.kiProjectiles) {
    if (m.fighters[p.owner].data.id !== "goku") continue;
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    c.scale(p.facing, 1);
    if (p.state === "flight")
      fx(
        "ki",
        Math.floor(p.age / 3),
        -p.radius * 0.45,
        0,
        p.radius * 3.1,
        p.radius * 2.2,
      );
    else
      fx(
        "impact",
        Math.min(3, Math.floor(p.impactAge / 2)),
        0,
        0,
        p.radius * 4,
        p.radius * 4,
      );
    c.restore();
    if (debug) {
      const b = kiBox(p);
      c.strokeStyle = p.state === "flight" ? "#ff8993" : "#8dabc8";
      c.strokeRect(b.x, b.y, b.w, b.h);
    }
  }
  for (const b of m.beams) {
    c.save();
    c.translate(Math.round(b.x), Math.round(b.y));
    c.scale(b.facing, 1);
    const tick = Math.floor(b.age / 3),
      h = b.radius * 2;
    if (b.state === "active") {
      const end = Math.max(0, b.length - b.radius * 1.5);
      for (let x = 0; x < end; x += 48) {
        const width = Math.min(48, end - x);
        fx("body", tick, x + width / 2, 0, width, h);
      }
      fx("origin", tick, 0, 0, h * 1.7, h * 1.7);
      fx("tip", tick, Math.max(0, b.length - h), 0, h * 2, h * 1.2);
    } else
      for (let x = 0; x < b.length; x += 96)
        fx(
          "dissipate",
          Math.min(3, Math.floor(b.age / 2)),
          x + 48,
          0,
          96,
          h * 1.4,
        );
    c.restore();
    if (
      b.state === "active" &&
      b.hitIds.length &&
      b.age >= b.impactAge &&
      b.age - b.impactAge <= 5
    ) {
      const target = m.fighters[1 - b.owner];
      fx("impact", Math.min(3, b.age - b.impactAge), target.x, b.y, 70, 70);
    }
    if (debug && b.state === "active") {
      const box = beamBox(b);
      c.strokeStyle = "#ff8993";
      c.strokeRect(box.x, box.y, box.w, box.h);
    }
  }
}
