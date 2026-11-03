import type { luffyAttackLimbs } from "../engine/luffy-specials";
import type { Move } from "../engine/types";

export function paintLuffyTrails(
  c: CanvasRenderingContext2D,
  limbs: ReturnType<typeof luffyAttackLimbs>,
  tick: number,
  move: Move,
) {
  const recoil = tick - move.startup - move.active;
  for (const limb of limbs) {
    if (!limb.trail && !(limb.driving && recoil >= 0 && recoil < 4)) continue;
    const { x, y } = limb.tip;
    const trailing = move.special === "gatling" ? 3 : 2;
    for (let i = 0; i < trailing; i++) {
      const length =
        Math.min(43, Math.max(6, (x - limb.centers[0].x) / 6)) - 4 * i;
      const left = Math.round(x - 18 - i * 11 - (tick % 3) * 3);
      c.fillStyle = i ? "#f0a963" : "#ffe4b5";
      c.fillRect(
        left - length,
        y + (i % 2 ? 12 : -10 - i * 3),
        length,
        i ? 1 : 2,
      );
    }
  }
}
