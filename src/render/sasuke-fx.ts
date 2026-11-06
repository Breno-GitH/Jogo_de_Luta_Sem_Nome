import type { Fighter } from "../engine/combat";
import { poseAt } from "../engine/moves";
import { fillPixels } from "./pixel-contour";

/** Separate, short-lived blade glint drawn from the current steel contact
 * track. The PNGs retain the weapon and the combat never reads this effect. */
export function drawSasukeCut(c: CanvasRenderingContext2D, f: Fighter) {
  if (f.attackPhase !== "active" || !f.move) return;
  const pose = poseAt(f.move, f.stateFrame);
  if (!pose?.blade) return;
  const { a, b } = pose.blade;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    distance = Math.hypot(dx, dy);
  const progress = (f.stateFrame - f.move.startup) / f.move.active;
  const direction = f.moveId === "crouch_heavy" ? 1 : -1;
  const at = (t: number, n: number) => ({
    x: Math.round(a.x + dx * t - (dy * n * direction) / distance),
    y: Math.round(a.y + dy * t + (dx * n * direction) / distance),
  });
  c.save();
  c.globalAlpha *= 1 - progress * 0.63;
  fillPixels(
    c,
    [
      at(0.03, 1),
      at(0.43, 11),
      at(0.8, 14),
      at(1.15, 4),
      at(0.99, -1),
      at(0.5, 3),
    ],
    "#759dc5",
  );
  fillPixels(
    c,
    [
      at(0.09, 1),
      at(0.55, 7),
      at(0.88, 10),
      at(1.12, 4),
      at(0.96, 2),
      at(0.51, 4),
    ],
    "#c5e1ee",
  );
  fillPixels(
    c,
    [at(0.56, 3), at(0.85, 7), at(1.11, 4), at(0.88, 3)],
    "#fcfbef",
  );
  c.restore();
}
