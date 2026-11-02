import { DamageTracker } from "../engine/stats";
import { neutral, type InputFrame } from "../engine/types";
import type { Match } from "../engine/combat";
import type { Bot } from "../engine/bot";

export type DummyBehavior = "idle" | "guard" | "crouchGuard" | "jump" | "bot";
export class Training {
  infiniteHealth = true;
  unlimitedMeter = true;
  dummy: DummyBehavior = "idle";
  readonly damage = new DamageTracker();
  configure(match: Match) {
    match.rules.training = true;
    match.rules.infiniteHealth = [this.infiniteHealth, this.infiniteHealth];
    if (this.infiniteHealth)
      for (const f of match.fighters) f.health = f.data.health;
    if (this.unlimitedMeter)
      for (const f of match.fighters) f.meter = f.meterMaximum;
  }
  input(match: Match, bot: Bot): InputFrame {
    const [, dummy] = match.fighters,
      input = neutral();
    const speed =
      this.dummy === "guard" || this.dummy === "crouchGuard"
        ? 0
        : match.opponentData.speed;
    if (dummy.data.speed !== speed)
      dummy.data = {
        ...dummy.data,
        speed,
        ...(dummy.data.locomotion
          ? {
              locomotion: {
                ...dummy.data.locomotion,
                backSpeed:
                  speed === 0 ? 0 : match.opponentData.locomotion!.backSpeed,
              },
            }
          : {}),
      };
    if (this.dummy === "bot") return bot.sample(match);
    if (this.dummy === "guard" || this.dummy === "crouchGuard") {
      input.direction = -dummy.facing as -1 | 1;
      input.down = this.dummy === "crouchGuard";
      // Guard in place rather than retreating to the wall. The normal game's
      // movement and guarding rules remain untouched.
    } else if (
      this.dummy === "jump" &&
      !dummy.airborne &&
      ["idle", "walk", "crouch"].includes(dummy.state)
    )
      input.pressed = ["jump"];
    return input;
  }
}
