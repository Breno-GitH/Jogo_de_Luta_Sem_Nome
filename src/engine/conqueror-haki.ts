import type { Fighter } from "./combat";
import { xebecPressure, xebecPressureReach } from "./xebec-specials";

export function conquerorRelease(fighter: Fighter) {
  if (fighter.state !== "attack") return;
  const move = xebecPressure(fighter.moveId);
  if (move?.kind !== "conqueror" || fighter.stateFrame < move.release ||
      fighter.stateFrame >= move.release + move.active) return;
  return {
    kind: move.kind, fighter: fighter.id, tick: fighter.stateFrame, priority: fighter.move!.rank,
    x: fighter.x, y: fighter.y - 75,
    reach: xebecPressureReach(move, fighter.stateFrame), height: move.height * .92,
  };
}

/** Read-only overlap query for a future confrontation. No automatic clash. */
export function compatibleConquerorReleases(first: Fighter, second: Fighter) {
  if (first.id === second.id) return;
  const a = conquerorRelease(first), b = conquerorRelease(second);
  if (!a || !b || Math.abs(a.x - b.x) > a.reach + b.reach ||
      Math.abs(a.y - b.y) > a.height + b.height) return;
  return a.fighter < b.fighter ? [a, b] as const : [b, a] as const;
}
