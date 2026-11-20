import type { Fighter } from "./combat";
export const astaSwords = [
  "slayer",
  "slasher",
  "dweller",
  "destroyer",
] as const;
export type AstaSword = (typeof astaSwords)[number];
export const swordNames: Record<AstaSword, string> = {
  slayer: "Demon-Slayer",
  slasher: "Demon-Slasher",
  dweller: "Demon-Dweller",
  destroyer: "Demon-Destroyer",
};
export interface AstaState {
  equipped: AstaSword;
  attackSword?: AstaSword;
  pending?: {
    sword: AstaSword;
    move: string;
    at: number;
    next?: { sword: AstaSword; at: number }[];
  };
  cast: number;
  usedSpecials: string[];
  projectileCooldown: number;
  neutralized: number;
  airDashUsed: boolean;
  airDashTicks: number;
  airDashDirection: number;
}
export const newAsta = (): AstaState => ({
  equipped: "slayer",
  cast: 0,
  usedSpecials: [],
  projectileCooldown: 0,
  neutralized: 0,
  airDashUsed: false,
  airDashTicks: 0,
  airDashDirection: 1,
});
export const isAstaSword = (value: string): value is AstaSword =>
  astaSwords.includes(value as AstaSword);
/** Only training may equip at rest. No neutral sword-switch command is exposed in combat. */
export function practiceSword(f: Fighter, sword: AstaSword) {
  if (
    !f.asta ||
    !f.match?.rules.training ||
    f.airborne ||
    !["idle", "walk", "crouch"].includes(f.state)
  )
    return false;
  f.asta.equipped = sword;
  return true;
}
/** Special moves commit at the authored drawing, even on whiff.
 * Interrupted before this tick -> previous sword. Interrupted afterwards -> new sword.
 * Each authored stage updates the latched sword, replicated by snapshots. */
export function beginAstaAttack(
  f: Fighter,
  sword?: {
    sword: AstaSword;
    commitTick: number;
    sequence?: { sword: AstaSword; commitTick: number }[];
  },
) {
  const s = f.asta;
  if (!s) return;
  s.attackSword = s.equipped;
  s.neutralized = 0;
  if (sword) {
    s.cast++;
    if (f.opponent?.combo && !s.usedSpecials.includes(f.moveId))
      s.usedSpecials.push(f.moveId);
  }
  s.pending = sword
    ? {
        sword: sword.sword,
        at: sword.commitTick,
        move: f.moveId,
        next: sword.sequence?.map((p) => ({
          sword: p.sword,
          at: p.commitTick,
        })),
      }
    : undefined;
  commitAstaSword(f);
}
export function commitAstaSword(f: Fighter) {
  const s = f.asta,
    p = s?.pending;
  if (
    s &&
    p &&
    f.state === "attack" &&
    f.moveId === p.move &&
    f.stateFrame >= p.at
  ) {
    s.equipped = s.attackSword = p.sword;
    const next = p.next?.shift();
    if (next) s.pending = { ...next, move: p.move, next: p.next };
    else delete s.pending;
  }
}
export function finishAstaAttack(f: Fighter) {
  if (!f.asta) return;
  delete f.asta.pending;
  delete f.asta.attackSword;
}
export const visibleAstaSword = (f: Fighter) =>
  f.asta?.attackSword ?? f.asta?.equipped ?? "slayer";

/** One decrement per simulation update; repeated commit checks never change clocks. */
export function tickAstaState(f: Fighter) {
  const s = f.asta;
  if (!s) return;
  s.projectileCooldown = Math.max(0, s.projectileCooldown - 1);
  if (!f.opponent?.combo && f.state !== "attack") s.usedSpecials.length = 0;
  commitAstaSword(f);
}
