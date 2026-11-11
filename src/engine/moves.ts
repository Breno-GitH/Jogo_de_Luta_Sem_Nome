import type { CombatPose, Move } from "./types";
import { animationTick } from "./pace";

// Mil Cortes predates the Super flag. All new Supers use Move.super.
export const isSuperMove = (move?: Move) => !!(move?.super || move?.kind === "ultimate");

export function poseAt(move: Move, tick: number): CombatPose | undefined {
  tick = animationTick(move, tick);
  let time = 0;
  for (const pose of move.poses ?? []) {
    time += pose.ticks;
    if (tick < time) return pose;
  }
  return move.poses?.at(-1);
}
export function poseIndexAt(move: Move, tick: number): number {
  tick = animationTick(move, tick);
  let time = 0;
  for (let i = 0; i < (move.poses?.length ?? 0); i++) {
    time += move.poses![i].ticks;
    if (tick < time) return i;
  }
  return Math.max(0, (move.poses?.length ?? 1) - 1);
}
export function phaseAt(
  move: Move,
  tick: number,
): "startup" | "active" | "recovery" {
  return tick < move.startup
    ? "startup"
    : tick < move.startup + move.active &&
        (!move.hitWindows ||
          move.hitWindows.some((w) => tick >= w.fromTick && tick < w.toTick))
      ? "active"
      : "recovery";
}
