import type { Fighter } from "../engine/combat";
import { reactionFor } from "../engine/lifecycle";
import type { Animator } from "./animator";
import combat from "../data/goku-combat-animations.json";
/** Interruptible visual recovery only; never delays physical control. */
export class GokuCombatPresentation {
  private previousReaction = "";
  private recovery?: { clip: string; tick: number };
  constructor(private animator: Animator) {}
  tick(f: Fighter) {
    const reaction = reactionFor(f);
    if (
      reaction &&
      this.animator.hasClip(reaction.clip) &&
      !["idle", "crouchIdle"].includes(reaction.clip)
    ) {
      this.previousReaction = reaction.clip;
      this.recovery = undefined;
      this.animator.update(reaction.clip);
      this.animator.seekTick(
        f.state === "defeat" ? Number.MAX_SAFE_INTEGER : reaction.tick,
      );
      return true;
    }
    const free = ["idle", "crouch"].includes(f.state);
    if (this.previousReaction) {
      if (
        free &&
        /^(hit(Light|Medium|Heavy|Crouch)|guard)/.test(this.previousReaction)
      )
        this.recovery = {
          clip: this.previousReaction.startsWith("guard")
            ? f.crouching
              ? "guardRecoveryCrouch"
              : "guardRecovery"
            : f.crouching
              ? "hitRecoveryCrouch"
              : "hitRecovery",
          tick: 0,
        };
      this.previousReaction = "";
    }
    if (!free) this.recovery = undefined;
    if (!this.recovery || !this.animator.hasClip(this.recovery.clip))
      return false;
    const r = this.recovery,
      clips = combat.clips as Record<string, { durations: number[] }>;
    this.animator.update(r.clip);
    this.animator.seekTick(r.tick++);
    if (r.tick >= clips[r.clip].durations.reduce((s, t) => s + t, 0))
      this.recovery = undefined;
    return true;
  }
}
