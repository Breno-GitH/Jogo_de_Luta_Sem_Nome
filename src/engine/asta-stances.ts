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
  pending?: { sword: AstaSword; move: string; at: number };
  airDashUsed: boolean;
  airDashTicks: number;
  airDashDirection: number;
}
export const newAsta = (): AstaState => ({
  equipped: "slayer",
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
/** Future special moves commit at the authored drawing, even on whiff.
 * Interrupted before this tick -> previous sword. Interrupted afterwards -> new sword.
 * The attack sword is latched for the whole action and is included in snapshots. */
export function beginAstaAttack(
  f: Fighter,
  sword?: { sword: AstaSword; commitTick: number },
) {
  const s = f.asta;
  if (!s) return;
  s.attackSword = sword?.sword ?? s.equipped;
  s.pending = sword
    ? { sword: sword.sword, at: sword.commitTick, move: f.moveId }
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
    s.equipped = p.sword;
    delete s.pending;
  }
}
export function finishAstaAttack(f: Fighter) {
  if (!f.asta) return;
  delete f.asta.pending;
  delete f.asta.attackSword;
}
export const visibleAstaSword = (f: Fighter) =>
  f.asta?.attackSword ?? f.asta?.equipped ?? "slayer";
