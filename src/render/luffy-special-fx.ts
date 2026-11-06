import type { luffyAttackLimbs } from "../engine/luffy-specials";
import type { HitEvent } from "../engine/combat";
import type { Move, Point } from "../engine/types";
import { fillPixels } from "./pixel-contour";

export function pixelShard(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  length: number,
  width: number,
  color: string,
) {
  const p = (a: number, b: number) => ({
    x: Math.round(x + dx * a - dy * b),
    y: Math.round(y + dy * a + dx * b),
  });
  fillPixels(
    c,
    [
      p(-length, 0),
      p(-Math.min(length * 0.31, width * 3), -width),
      p(0, 0),
      p(-length * 0.23, width),
    ],
    color,
  );
}

/** Bands follow the limb axis. They live off the contour so the sandal and
 * clenched fingers stay readable even at peak extension. */
export function paintLuffyTrails(
  c: CanvasRenderingContext2D,
  limbs: ReturnType<typeof luffyAttackLimbs>,
  tick: number,
  move: Move,
) {
  const active = tick >= move.startup && tick < move.startup + move.active;
  const earlyRecovery =
    tick >= move.startup + move.active && tick < move.startup + move.active + 3;
  const lateStartup = tick >= move.startup - 2 && tick < move.startup;
  for (const limb of limbs) {
    const { tip, axis } = limb;
    const root = limb.centers[0];
    const length = Math.hypot(tip.x - root.x, tip.y - root.y);
    if (
      length < 38 ||
      !(
        limb.trail ||
        (move.special
          ? limb.driving && earlyRecovery
          : active || lateStartup || earlyRecovery)
      )
    )
      continue;
    const lines = move.special === "gatling" ? 4 : 3;
    for (let i = 0; i < lines; i++) {
      const offset = (i % 2 ? -1 : 1) * (10 + 3 * i + Number(limb.foot) * 4);
      const lead = 10 + i * 11 + ((tick + i) % 4) * 5;
      const x = tip.x - axis.x * lead - axis.y * offset;
      const y = tip.y - axis.y * lead + axis.x * offset;
      pixelShard(
        c,
        x,
        y,
        axis.x,
        axis.y,
        Math.min(52, length * 0.38) - i * 5,
        i === 0 ? 2 : 1,
        i === 0 ? "#fff0cb" : i === 1 ? "#e99c67" : "#9c5648",
      );
    }
  }
}

export function luffyBurst(
  c: CanvasRenderingContext2D,
  center: Point,
  age: number,
  facing: number,
  power: number,
  palette: [string, string, string],
  style: "kick" | "punch" | "rush" | "double" = "punch",
) {
  if (age >= 14) return;
  c.save();
  c.globalAlpha *= Math.min(1, (14 - age) / 7);
  const scale = power * (1 + age * 0.085);
  const base = style === "kick" ? -0.38 : style === "double" ? -0.12 : 0.05;
  const line = (
    x: number,
    y: number,
    size: number,
    width: number,
    color: string,
  ) =>
    pixelShard(
      c,
      center.x + x * scale * facing,
      center.y + y * scale,
      Math.cos(base) * facing,
      Math.sin(base),
      size * scale,
      width * scale,
      color,
    );
  const rays = style === "rush" ? 6 : style === "double" ? 11 : 9;
  for (let i = 0; i < rays; i++) {
    const angle = (i * Math.PI * 2) / rays + base;
    const dx = Math.cos(angle) * facing,
      dy = Math.sin(angle);
    const distance = scale * (13 + (i % 3) * 4 + age * 2);
    const x = center.x + dx * distance,
      y = center.y + dy * distance;
    pixelShard(
      c,
      x,
      y,
      dx,
      dy,
      scale * (17 + (i % 3) * 5),
      2 * scale,
      palette[0],
    );
    if (age < 8)
      pixelShard(
        c,
        x - dx * 2,
        y - dy * 2,
        dx,
        dy,
        12 * scale,
        1 * scale,
        palette[1],
      );
    if ((i + age) % 3 === 0) {
      c.fillStyle = palette[1];
      c.fillRect(Math.round(x + dx * 7), Math.round(y + dy * 6), 2, 2);
    }
  }
  if (age < 6) {
    line(16, 0, 43, 4, palette[0]);
    line(11, 0, 29, 2, palette[2]);
    line(5, -5, 17, 1, palette[1]);
    line(9, 6, 24, 1, palette[1]);
  }
  c.restore();
}

export function paintLuffyImpacts(
  c: CanvasRenderingContext2D,
  events: HitEvent[],
) {
  for (const e of events) {
    const info = e.luffy;
    if (!info) continue;
    const age = (e.total ?? 16) - e.life;
    const palette: [string, string, string] = e.blocked
      ? ["#357a9f", "#8be6ec", "#edffff"]
      : ["#dd5542", "#ffba67", "#fff4cd"];
    const power =
      (info.style === "rush" ? 0.63 : info.style === "double" ? 1.28 : 0.92) *
      (e.blocked ? 0.79 : e.strength === 3 ? 1.17 : 1);
    luffyBurst(c, e, age, info.direction, power, palette, info.style);
  }
}
