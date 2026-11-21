import type { Fighter } from "./combat";
/** Metadata contract for future status producers. Does not invent damage, poison or slow for existing fighters. */
export interface CombatStatus {
  id: string;
  kind:
    | "poison"
    | "magicBurn"
    | "magicDot"
    | "magicSlow"
    | "spellDebuff"
    | "physicalCondition";
  origin: "magic" | "physical";
  removal: "causality" | "none";
  expiresAt: number | null;
  source?: number;
}
export function addCombatStatus(f: Fighter, status: CombatStatus) {
  if (
    !status.id ||
    (status.expiresAt !== null && !Number.isFinite(status.expiresAt))
  )
    return false;
  const list = f.statusEffects ?? [];
  if (!list.some((x) => x.id === status.id) && list.length >= 16) return false;
  f.statusEffects = [...list.filter((x) => x.id !== status.id), { ...status }];
  return true;
}
export function tickCombatStatuses(f: Fighter) {
  if (!f.statusEffects) return;
  const now = f.match?.combatFrame ?? 0;
  f.statusEffects = f.statusEffects.filter(
    (x) => x.expiresAt === null || x.expiresAt > now,
  );
  if (!f.statusEffects.length) delete f.statusEffects;
}
export function removeCausalityStatuses(f: Fighter) {
  const before = f.statusEffects ?? [],
    now = f.match?.combatFrame ?? 0;
  const eligible = (x: CombatStatus) =>
    x.origin === "magic" &&
    x.removal === "causality" &&
    x.expiresAt !== null &&
    x.expiresAt > now;
  const removed = before.filter(eligible);
  const rest = before.filter((x) => !eligible(x));
  if (rest.length) f.statusEffects = rest;
  else delete f.statusEffects;
  return removed.map((x) => x.id);
}
