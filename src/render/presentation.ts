import type { Fighter } from "../engine/combat";
import { reactionFor } from "../engine/lifecycle";
import { Animator, metadata, type AnimationData } from "./animator";
import { DioMotionPresentation } from "./dio-motion";
import { GokuMotionPresentation } from "./goku-motion";
import gokuCombatAnimation from "../data/goku-combat-animations.json";
import gokuSpecialAnimation from "../data/goku-special-animations.json";
import fury from "../data/goku-fury-animations.json";
import { GokuCombatPresentation } from "./goku-combat";

/** Selects visual phases without driving physics from animation frames. */
export class FighterPresentation {
  readonly animator: Animator;
  private dioMotion?: DioMotionPresentation;
  private gokuMotion?: GokuMotionPresentation;
  private gokuCombat?: GokuCombatPresentation;
  constructor(data: AnimationData = metadata) {
    this.animator = new Animator(
      data.sheet.startsWith("goku/")
        ? {
            ...data,
            clips: {
              ...data.clips,
              ...gokuCombatAnimation.clips,
              ...gokuSpecialAnimation.clips,
              ...fury.clips,
            },
          }
        : data,
    );
    if (data.sheet.startsWith("dio/"))
      this.dioMotion = new DioMotionPresentation(this.animator);
    if (data.sheet.startsWith("goku/"))
      this.gokuMotion = new GokuMotionPresentation(this.animator);
    if (data.sheet.startsWith("goku/"))
      this.gokuCombat = new GokuCombatPresentation(this.animator);
  }
  private wasCrouched = false;
  private previousMove = "";
  private previousState = "";
  private previousStateFrame = -1;
  get plantedFoot() {
    return this.gokuMotion?.plantedFoot;
  }
  renderRootX(fighter: Fighter) {
    return this.gokuMotion?.renderRootX(fighter) ?? Math.round(fighter.x);
  }
  tick(fighter: Fighter) {
    // A guard is also an idle/crouch physics state. Give its explicit reaction
    // priority while still updating the locomotion history for the next step.
    const priorityReaction =
      fighter.data.id === "dio" ||
      (fighter.data.id === "goku" &&
        ![
          "idle",
          "walk",
          "crouch",
          "air",
          "jumpStart",
          "landing",
          "dash",
        ].includes(fighter.state))
        ? reactionFor(fighter)
        : undefined;
    const handled =
      this.dioMotion?.tick(fighter) ?? this.gokuMotion?.tick(fighter);
    if (
      fighter.data.id === "goku" &&
      fighter.state === "attack" &&
      fighter.move?.special === "teleport" &&
      fighter.move.gokuStrength === "heavy" &&
      !fighter.airborne &&
      fighter.attackPhase === "recovery"
    ) {
      this.animator.update("landing");
      this.animator.seekTick(
        Math.min(
          7,
          fighter.stateFrame - fighter.move.startup - fighter.move.active,
        ),
      );
      return;
    }
    if (this.gokuCombat?.tick(fighter)) return;
    if (priorityReaction) {
      this.animator.update(priorityReaction.clip);
      // Hold the final Goku KO drawing instead of restarting on defeat.
      this.animator.seekTick(
        fighter.data.id === "goku" && fighter.state === "defeat"
          ? Number.MAX_SAFE_INTEGER
          : priorityReaction.tick,
      );
      return;
    }
    const lift = fighter.stand?.s.ownerLiftFrame ?? -1;
    if (
      fighter.data.id === "dio" &&
      lift > 0 &&
      fighter.airborne &&
      ["air", "attack"].includes(fighter.state)
    ) {
      this.animator.update("commandJumpLink");
      this.animator.seekTick(lift - 1);
      return;
    }
    if (handled) return;
    let clip: string = "idle";
    let sync: number | undefined;
    const current = this.animator.clipName;
    const crouched = fighter.state === "crouch";
    const reaction = reactionFor(fighter);
    if (reaction) {
      clip = reaction.clip;
      sync = reaction.tick;
    } else if (fighter.state === "attack") {
      clip =
        fighter.state === "attack" && this.animator.hasClip(fighter.moveId)
          ? fighter.moveId
          : fighter.state;
      if (
        fighter.data.id === "dio" &&
        fighter.moveId === "stand_heavy" &&
        fighter.attackPhase === "recovery"
      ) {
        clip = "commandRecovery";
        sync =
          fighter.stateFrame - fighter.move!.startup - fighter.move!.active;
      }
    } else if (fighter.state === "jumpStart" || fighter.state === "landing") {
      clip = fighter.state;
    } else if (fighter.state === "dash") {
      clip =
        fighter.dashDirection === fighter.facing ? "dashForward" : "backdash";
    } else if (fighter.airborne) {
      clip =
        fighter.vy < -3 ? "jumpRise" : fighter.vy > 3 ? "jumpFall" : "jumpApex";
    } else if (crouched) {
      clip =
        !this.wasCrouched ||
        (current === "crouchStart" && !this.animator.endsOnNextTick)
          ? "crouchStart"
          : "crouchIdle";
    } else if (fighter.state === "walk") {
      clip =
        fighter.input.direction === fighter.facing ? "walkForward" : "walkBack";
    } else if (
      this.wasCrouched ||
      (current === "crouchEnd" && !this.animator.endsOnNextTick)
    ) {
      clip = "crouchEnd";
    }
    const restart =
      (fighter.state === "attack" && fighter.moveId !== this.previousMove) ||
      (fighter.stateFrame === 0 &&
        (this.previousStateFrame !== 0 ||
          this.previousState !== fighter.state));
    this.animator.update(clip, restart);
    if (sync !== undefined) this.animator.seekTick(sync);
    else if (fighter.state === "attack" && fighter.move?.poses)
      this.animator.seekTick(fighter.stateFrame);
    this.previousMove = fighter.moveId;
    this.previousState = fighter.state;
    this.previousStateFrame = fighter.stateFrame;
    this.wasCrouched = crouched;
  }
}
