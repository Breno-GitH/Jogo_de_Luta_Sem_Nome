import type { Point } from "./types";

/** Ankle-local silhouettes. The sole rotates independently of the elastic shin.
 * Heel and toe bend are in native pixels and never follow extension length. */
const variants: Record<
  string,
  { angle: number; heel: number; toe: number; contact: number }
> = {
  stand_medium: { angle: -1.06, heel: 1, toe: -1, contact: 13 },
  crouch_medium: { angle: -0.42, heel: 2, toe: 1, contact: 11 },
  crouch_heavy: { angle: -0.97, heel: 0, toe: -2, contact: 13 },
  air_medium: { angle: -1.17, heel: 1, toe: -1, contact: 14 },
  air_heavy: { angle: -0.67, heel: 2, toe: 2, contact: 12 },
};
export type FootPose = ReturnType<typeof luffyFootPose>;
export function luffyFootPose(id: string, length: number) {
  const spec = variants[id] ?? variants.stand_medium;
  const t = Math.max(0, Math.min(1, (length - 17) / 46));
  const p = t * t * (3 - 2 * t);
  const angle = -0.62 + (spec.angle + 0.62) * p;
  return { ...spec, cos: Math.cos(angle), sin: Math.sin(angle) };
}

export function luffyFootPoint(
  ankle: Point,
  axis: Point,
  pose: FootPose,
  x: number,
  y: number,
): Point {
  const lift =
    x < -3 ? (pose.heel * (-3 - x)) / 7 : (pose.toe * Math.max(0, x - 5)) / 11;
  const forward = x * pose.cos - (y + lift) * pose.sin + 2;
  const across = x * pose.sin + (y + lift) * pose.cos;
  return {
    x: Math.round(ankle.x + axis.x * forward - axis.y * across),
    y: Math.round(ankle.y + axis.y * forward + axis.x * across),
  };
}
