import animation from "../data/luffy-animations.json";
import { FLOOR, type Fighter } from "../engine/combat";
import type { Animator } from "./animator";

type Clip = keyof typeof animation.clips;

function ticks(clip: Exclude<Clip, "base">) {
  return animation.clips[clip].durations.reduce((sum, hold) => sum + hold, 0);
}

function progressTick(clip: Exclude<Clip, "base">, progress: number) {
  const duration = ticks(clip);
  return Math.max(0, Math.min(duration - 1, Math.floor(progress * duration)));
}

/** Selects complete movement cels. Physics and online inputs stay in Fighter. */
export class LuffyMotionPresentation {
  private previousX?: number;
  private previousFacing?: number;
  private walkPhase = 0;
  private crouchDepth = 0;

  constructor(private readonly animator: Animator) {}

  tick(fighter: Fighter) {
    const { x, facing, state, stateFrame, vx, vy, data } = fighter;
    const dx = x - (this.previousX ?? x);
    const sameFacing = this.previousFacing === facing;
    this.previousX = x;
    this.previousFacing = facing;

    const previous = this.animator.clipName;
    const walk = previous === "walkForward" || previous === "walkBack";
    let clip: Clip = "base";
    let seek: number | undefined;

    if (state === "jumpStart" || state === "landing") {
      clip = state;
      const physicalDuration =
        state === "jumpStart" ? data.locomotion!.jumpStartup : data.locomotion!.landingTicks;
      seek = progressTick(clip, stateFrame / physicalDuration);
    } else if (state === "air") {
      if (vy < -3) {
        clip = "jumpRise";
        seek = progressTick(clip, (vy - data.jump) / (-3 - data.jump));
      } else if (vy > 3) {
        clip = "jumpFall";
        const terminal = Math.sqrt(vy * vy + 2 * data.gravity * Math.max(0, FLOOR - fighter.y));
        seek = progressTick(clip, (vy - 3) / Math.max(1, terminal - 3));
      } else clip = "jumpApex";
    } else if (state === "dash") {
      const forward = fighter.dashDirection === facing;
      clip = forward ? "dashForward" : "backdash";
      const profile = forward ? data.locomotion!.dashForward : data.locomotion!.backdash;
      seek = progressTick(clip, stateFrame / profile.length);
    } else if (state === "crouch") {
      const duration = ticks("crouchStart");
      clip = this.crouchDepth < duration ? "crouchStart" : "crouchIdle";
      if (clip === "crouchStart") seek = this.crouchDepth++;
    } else if (state === "idle" && this.crouchDepth > 0) {
      clip = "crouchEnd";
      seek = ticks(clip) - this.crouchDepth--;
    } else if (state === "walk") {
      const forward = vx * facing > 0;
      clip = forward ? "walkForward" : "walkBack";
      const speed = forward ? data.speed : data.locomotion!.backSpeed;
      this.walkPhase = walk && sameFacing
        ? (this.walkPhase + Math.min(1, Math.abs(dx) / speed)) % ticks(clip)
        : 0;
      seek = Math.floor(this.walkPhase + 1e-6) % ticks(clip);
    } else if (state === "idle") {
      clip = "idle";
    }

    if (!clip.startsWith("crouch")) this.crouchDepth = 0;
    this.animator.update(clip);
    if (seek !== undefined) this.animator.seekTick(seek);
  }
}
