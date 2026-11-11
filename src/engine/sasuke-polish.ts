import cfg from "../data/sasuke-polish.json";
import art from "../data/sasuke-polish-art.json";
import type { Capsule, CombatPose, Move, Point } from "./types";

export { cfg as sasukePolish, art as sasukePolishArt };

export interface FireDragonWave {
  origin: Point;
  facing: number;
  distance: number;
  period: number;
  amplitude: number;
  limit: number;
  struck: boolean;
}
const fire = cfg.goryuka;
export function fireDragonWave(
  origin: Point,
  facing: number,
  cursed: boolean,
): FireDragonWave {
  const span = Math.max(0, facing > 0 ? fire.arenaWidth - origin.x : origin.x);
  const style = cursed ? fire.curse : fire.base;
  return {
    origin,
    facing,
    distance: 0,
    struck: false,
    period: Math.max(fire.minimumWavelength, span / fire.cycles),
    amplitude: Math.min(
      style.amplitude * Math.min(1, span / 580),
      557 - origin.y,
    ),
    limit: span + fire.bodyLength + fire.exitPadding,
  };
}
/** The body is a delayed sample of the same path as the head. A smooth
 * envelope meets the mouth position with zero vertical velocity. */
export function fireDragonPoint(w: FireDragonWave, distance: number): Point {
  const t = Math.max(0, distance);
  const ramp = Math.min(1, t / fire.leadIn);
  const envelope = ramp * ramp * (3 - 2 * ramp);
  return {
    x: w.origin.x + t * w.facing,
    y:
      w.origin.y +
      envelope *
        (fire.heightOffset -
          w.amplitude * Math.sin((t * 2 * Math.PI) / w.period)),
  };
}
export function fireDragonVolumes(
  w: FireDragonWave,
  previous: Point,
  radius: number,
) {
  const point = fireDragonPoint(w, w.distance);
  const hit: Capsule[] = [{ a: previous, b: point, r: radius }];
  const span = Math.min(w.distance, fire.offensiveLength);
  for (let i = 0; i < span; i += 16) {
    hit.push({
      a: fireDragonPoint(w, w.distance - i),
      b: fireDragonPoint(w, w.distance - Math.min(span, i + 16)),
      r: Math.max(10, radius * (0.71 - i / 340)),
    });
  }
  return hit;
}

export function chidoriProfile(cursed: boolean) {
  return cursed ? cfg.chidori.curse : cfg.chidori.base;
}
export function chidoriMove(base: Move, cursed: boolean): Move {
  const { holds, hitstop, push } = chidoriProfile(cursed);
  const cels: Omit<CombatPose, "phase" | "ticks">[] = cursed
    ? art.chidoriCurse
    : art.chidori;
  return {
    ...base,
    hitstop,
    push,
    launch: -2.4,
    drive: undefined,
    startup: holds[0] + holds[1] + holds[2],
    active: holds[3] + holds[4],
    recovery: holds[5],
    poses: holds.map((ticks, i) => ({
      ...cels[i],
      ticks,
      phase: i < 3 ? "startup" : i < 5 ? "active" : "recovery",
    })),
  };
}
export const chidoriVelocity = (tick: number, cursed: boolean) =>
  chidoriProfile(cursed).drive[tick - 8] ?? 0;

export function nagashiProfile(cursed: boolean) {
  return cursed ? cfg.nagashi.curse : cfg.nagashi.base;
}
/** Shared spokes for the authored discharge and its capsules. */
export function nagashiVolumes(age: number, cursed: boolean): Capsule[] {
  const { reach, height } = nagashiProfile(cursed);
  const growth = 0.56 + 0.44 * Math.max(0, Math.min(1, (age + 1) / 3));
  const root = { x: 0, y: -64 };
  return [-1, 1].flatMap((side) => [
    { a: root, b: { x: side * reach * growth, y: -63 }, r: 14 },
    {
      a: { x: 0, y: -84 },
      b: { x: side * reach * 0.68 * growth, y: -height },
      r: 13,
    },
    {
      a: { x: 0, y: -43 },
      b: { x: side * reach * 0.83 * growth, y: -14 },
      r: 13,
    },
  ]);
}
