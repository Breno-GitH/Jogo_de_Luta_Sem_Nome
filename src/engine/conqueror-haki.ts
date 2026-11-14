import type { Fighter } from "./combat";
import { xebecPressure } from "./xebec-specials";

export function conquerorRelease(fighter: Fighter) {
  if (fighter.state !== "attack") return;
  const move = xebecPressure(fighter.moveId);
  if (move?.kind !== "conqueror" || fighter.stateFrame < move.release ||
      fighter.stateFrame >= move.release + move.active) return;
  return { kind: move.kind, fighter: fighter.id, tick: fighter.stateFrame, priority: fighter.move!.rank };
}

/** Read-only overlap query for a future confrontation. No automatic clash. */
export function compatibleConquerorReleases(first: Fighter, second: Fighter) {
  if (first.id === second.id) return;
  const a = conquerorRelease(first), b = conquerorRelease(second);
  if (!a || !b) return;
  return a.fighter < b.fighter ? [a, b] as const : [b, a] as const;
}
