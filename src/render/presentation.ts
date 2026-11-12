import type { Fighter } from "../engine/combat";
import { reactionFor } from "../engine/lifecycle";
import { Animator, metadata, type AnimationData } from "./animator";
import { benAnimation, feedbackWalkOffset, tickBenAnimation } from "./ben-animations";
import type { BenAlien } from "../engine/ben-omnitrix";
import { KanekiPresentation } from "./kaneki-presentation";
import { SasukePresentation } from "./sasuke-presentation";
import { LuffyMotionPresentation } from "./luffy-motion";
import { DioMotionPresentation } from "./dio-motion";
import { GokuMotionPresentation } from "./goku-motion";
import gokuCombatAnimation from "../data/goku-combat-animations.json";
import gokuSpecialAnimation from "../data/goku-special-animations.json";
import fury from "../data/goku-fury-animations.json";
import { GokuCombatPresentation } from "./goku-combat";
import { animationTick } from "../engine/pace";

/** Selects visual phases without driving physics from animation frames. */
export class FighterPresentation {
  animator: Animator;
  private benVisual?: "human" | BenAlien | "nrgReleased" | "alienX";
  private benGrowth = 0;
  private kaneki?: KanekiPresentation;
  private sasukeMotion?: SasukePresentation;
  private luffyMotion?: LuffyMotionPresentation;
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
    if (data.sheet.startsWith("sasuke/"))
      this.sasukeMotion = new SasukePresentation(this.animator);
    if (data.sheet.startsWith("luffy/"))
      this.luffyMotion = new LuffyMotionPresentation(this.animator);
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
    return this.kaneki?.rootX(fighter) ?? this.gokuMotion?.renderRootX(fighter) ??
      Math.round(fighter.x + feedbackWalkOffset(fighter));
  }
  kagunes(fighter: Fighter) {
    return this.kaneki?.worldKagunes(fighter) ?? [];
  }

  tick(fighter: Fighter, preview?: Animator) {
    if (preview) {
      this.animator = preview;
      return;
    }
    if (fighter.data.id === "ben") {
      const watch = fighter.omnitrix;
      const superState = fighter.match?.alienX;
      const transformed = superState?.attacker === fighter.id && fighter.state === "cinematic" &&
        fighter.actionClip !== "alienXWatch" && fighter.actionClip !== "alienXReturn";
      const form = transformed ? "alienX" : watch?.nrgReleased ? "nrgReleased" : watch?.active ?? "human";
      const growth = fighter.omnitrix?.growth?.rank ?? 0;
      if (form !== this.benVisual || growth !== this.benGrowth) {
        this.animator = new Animator(benAnimation(form, growth));
        this.benVisual = form;
        this.benGrowth = growth;
      }
      tickBenAnimation(fighter, this.animator);
      return;
    }
    if (fighter.data.id === "kaneki") {
      this.kaneki ??= new KanekiPresentation(fighter, this.animator);
      this.kaneki.step(fighter);
      return;
    }
    if (this.sasukeMotion) {
      this.sasukeMotion.tick(fighter);
      return;
    }
    if (this.luffyMotion) {
      this.luffyMotion.tick(fighter);
      return;
    }
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
        fighter.state === "attack" &&
        this.animator.hasClip(
          fighter.move?.airTeleport ? "teleport_air" : fighter.moveId,
        )
          ? fighter.move?.airTeleport
            ? "teleport_air"
            : fighter.moveId
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
      const definition = metadata.clips[fighter.state];
      const ticks = definition.frames.reduce(
        (sum) => sum + definition.ticks,
        0,
      );
      sync =
        (fighter.stateFrame * ticks) /
        (fighter.state === "jumpStart"
          ? (fighter.data.locomotion?.jumpStartup ?? 4)
          : (fighter.data.locomotion?.landingTicks ?? 6));
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
      this.animator.seekTick(animationTick(fighter.move, fighter.stateFrame));
    this.previousMove = fighter.moveId;
    this.previousState = fighter.state;
    this.previousStateFrame = fighter.stateFrame;
    this.wasCrouched = crouched;
  }
}
