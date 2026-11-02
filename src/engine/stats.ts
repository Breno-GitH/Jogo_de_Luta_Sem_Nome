import type { Match } from "./combat";

export interface DamageStats {
  lastHit: number;
  comboDamage: number;
  comboHits: number;
  bestDamage: number;
  bestHits: number;
  totalDamage: number;
  lastMove: string;
  visible: number;
}
const empty = (): DamageStats => ({
  lastHit: 0,
  comboDamage: 0,
  comboHits: 0,
  bestDamage: 0,
  bestHits: 0,
  totalDamage: 0,
  lastMove: "—",
  visible: 0,
});
/** Consumes semantic hits, so infinite health never hides training damage. */
export class DamageTracker {
  fighters: [DamageStats, DamageStats] = [empty(), empty()];
  private serial = 0;
  private owner?: Match;
  reset() {
    this.fighters = [empty(), empty()];
    this.serial = 0;
    this.owner = undefined;
  }
  tick(match: Match) {
    if (this.owner !== match) {
      this.reset();
      this.owner = match;
    }
    for (const stats of this.fighters)
      stats.visible = Math.max(0, stats.visible - 1);
    for (const hit of match.hits) {
      if (hit.serial <= this.serial) continue;
      this.serial = hit.serial;
      if (hit.blocked) continue;
      const stats = this.fighters[hit.attacker];
      if (hit.combo <= 1) stats.comboDamage = 0;
      stats.lastHit = hit.damage;
      stats.lastMove = hit.move;
      stats.comboDamage += hit.damage;
      stats.comboHits = hit.combo;
      stats.totalDamage += hit.damage;
      stats.bestDamage = Math.max(stats.bestDamage, stats.comboDamage);
      stats.bestHits = Math.max(stats.bestHits, hit.combo);
      stats.visible = 110;
    }
  }
}
