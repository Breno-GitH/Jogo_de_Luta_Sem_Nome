import type { CombatPose, Move } from "./types";

export function poseAt(move: Move, tick: number): CombatPose | undefined {
  let time = 0;
  for (const pose of move.poses ?? []) {
    time += pose.ticks;
    if (tick < time) return pose;
  }
  return move.poses?.at(-1);
}
export function poseIndexAt(move: Move, tick: number): number {
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
