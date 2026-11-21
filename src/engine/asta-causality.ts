import type { Fighter } from "./combat";
import { removeCausalityStatuses } from "./status-effects";
export const causalityBalance = {
  recentTicks: 240,
  ratio: 0.3,
  maxHealthFraction: 0.06,
  cooldownTicks: 1200,
  restoreTick: 24,
  activeFrom: 12,
  activeTo: 32,
  neutralizations: 3,
} as const;
export interface DamageReceipt {
  id: number;
  at: number;
  amount: number;
  claimed: boolean;
  restored: number;
}
const clock = (f: Fighter) => f.match?.combatFrame ?? 0;
/** Called only after authoritative HP really decreases. Infinite-health training creates no recoverable debt. */
export function recordAstaDamage(f: Fighter, amount: number) {
  const s = f.asta;
  if (!s || amount <= 0) return;
  s.recentDamage.push({
    id: ++s.damageSerial,
    at: clock(f),
    amount,
    claimed: false,
    restored: 0,
  });
  pruneAstaDamage(f);
}
export function pruneAstaDamage(f: Fighter) {
  const s = f.asta;
  if (s)
    s.recentDamage = s.recentDamage
      .filter((x) => clock(f) - x.at < causalityBalance.recentTicks)
      .slice(-256);
}
export function recoverableAstaHealth(f: Fighter) {
  const s = f.asta;
  if (!s || f.health <= 0 || clock(f) < s.restorationReadyAt) return 0;
  const receipts = s.recentDamage.filter(
    (x) => !x.claimed && clock(f) - x.at < causalityBalance.recentTicks,
  );
  const recent = receipts.reduce((n, x) => n + x.amount, 0);
  return Math.max(
    0,
    Math.min(
      Math.floor(recent * causalityBalance.ratio),
      Math.floor(f.data.health * causalityBalance.maxHealthFraction),
      f.data.health - f.health,
    ),
  );
}
/** Restoration and cleansing are independent. Relay never calls this move-specific phase. */
export function stepAstaCausality(f: Fighter) {
  const s = f.asta,
    m = f.match;
  if (
    !s ||
    !m ||
    f.health <= 0 ||
    f.state !== "attack" ||
    f.moveId !== "astaCausalityBreak" ||
    f.stateFrame !== causalityBalance.restoreTick ||
    s.restoredCast === s.cast
  )
    return;
  s.restoredCast = s.cast;
  const cleansed = removeCausalityStatuses(f),
    hp = recoverableAstaHealth(f);
  if (hp > 0) {
    let remaining = hp;
    for (const x of s.recentDamage) {
      if (x.claimed || clock(f) - x.at >= causalityBalance.recentTicks)
        continue;
      // Claim each contributing receipt once. Unused capacity is not banked for future healing.
      x.claimed = true;
      x.restored = Math.min(
        remaining,
        Math.floor(x.amount * causalityBalance.ratio),
      );
      remaining -= x.restored;
    }
    if (remaining > 0) {
      const last = s.recentDamage.filter((x) => x.claimed).at(-1);
      if (last) last.restored += remaining;
    }
    f.health = Math.min(f.data.health, f.health + hp);
    s.restorationReadyAt = clock(f) + causalityBalance.cooldownTicks;
  }
  s.causalityResult = { cast: s.cast, at: clock(f), hp, cleansed };
  if (hp || cleansed.length)
    m.events.push({
      kind: "counter",
      x: f.x,
      y: f.y - 80,
      life: 18,
      total: 18,
      blocked: false,
      asta: { kind: "restore", actor: f.id },
    });
}
