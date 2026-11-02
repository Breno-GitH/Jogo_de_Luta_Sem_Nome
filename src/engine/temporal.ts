import balance from "../data/dio-specials.json";

export interface DeferredReaction {
  blocked: boolean;
  stun: number;
  vx: number;
  vy: number;
  knockdown: boolean;
  strength: number;
  launch: boolean;
  crouched: boolean;
}
export interface TemporalState {
  owner: number;
  remaining: number;
  lastOwner: number;
  endFlash: number;
  hits: number;
  damage: number;
  ledger: { uses: number; cooldown: number }[];
  pending: (DeferredReaction | null)[];
}
/** Match-owned clocks. Never pauses the fixed loop, UI or the active owner. */
export class TemporalController {
  readonly config = balance.timeStop;
  s: TemporalState = {
    owner: -1,
    remaining: 0,
    lastOwner: -1,
    endFlash: 0,
    hits: 0,
    damage: 0,
    ledger: [
      { uses: 0, cooldown: 0 },
      { uses: 0, cooldown: 0 },
    ],
    pending: [null, null],
  };
  get active() {
    return this.s.owner >= 0 && this.s.remaining > 0;
  }
  isFrozen(seat: number) {
    return this.active && seat !== this.s.owner;
  }
  canActivate(seat: number) {
    return !this.active && this.s.ledger[seat].cooldown === 0;
  }
  cooldownFor(uses: number) {
    return (
      60 *
      (this.config.cooldownBaseSeconds +
        Math.max(0, uses - 1) * this.config.cooldownIncreaseSeconds)
    );
  }
  activate(seat: number) {
    if (!this.canActivate(seat)) return false;
    this.s.owner = this.s.lastOwner = seat;
    this.s.remaining = this.config.durationTicks;
    this.s.ledger[seat].uses++;
    this.s.hits = this.s.damage = this.s.endFlash = 0;
    this.s.pending = [null, null];
    return true;
  }
  /** Run once at the beginning of an active match step. Finishing is explicit
   * after that step so exactly durationTicks updates keep the opponent frozen. */
  beginStep(cooldownAdvances: boolean) {
    if (this.s.endFlash > 0) this.s.endFlash--;
    if (!this.active && cooldownAdvances)
      for (const item of this.s.ledger)
        item.cooldown = Math.max(0, item.cooldown - 1);
    return this.active;
  }
  endStep(wasActive: boolean) {
    if (wasActive && this.active && --this.s.remaining <= 0)
      return this.finish();
    return undefined;
  }
  finish() {
    const pending = this.s.pending;
    if (this.s.owner >= 0) {
      const item = this.s.ledger[this.s.owner];
      item.cooldown = this.cooldownFor(item.uses);
      this.s.lastOwner = this.s.owner;
      this.s.endFlash = 10;
    }
    this.s.owner = -1;
    this.s.remaining = 0;
    this.s.pending = [null, null];
    return pending;
  }
  budget(damage: number) {
    if (
      this.s.hits >= this.config.maximumHits ||
      this.s.damage >= this.config.maximumDamage
    )
      return 0;
    const scaled = Math.round(
      damage *
        Math.max(
          this.config.minimumDamageScale,
          this.config.damageScale - this.s.hits * this.config.damageDecayPerHit,
        ),
    );
    const applied = Math.max(
      0,
      Math.min(scaled, this.config.maximumDamage - this.s.damage),
    );
    if (applied > 0) {
      this.s.hits++;
      this.s.damage += applied;
    }
    return applied;
  }
  defer(seat: number, reaction: DeferredReaction) {
    const previous = this.s.pending[seat];
    // A later blocked poke cannot erase an already confirmed damaging hit.
    if (previous && !previous.blocked && reaction.blocked) return;
    this.s.pending[seat] = {
      ...reaction,
      stun: Math.max(previous?.stun ?? 0, reaction.stun),
    };
  }
}
