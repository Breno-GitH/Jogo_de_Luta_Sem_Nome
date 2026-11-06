import { FLOOR, type Fighter } from "../engine/combat";
import { reactionFor } from "../engine/lifecycle";
import type { Animator } from "./animator";
import { winged } from "../engine/sasuke-curse";
import { curseClipName, sasukeClipTicks } from "./sasuke-animations";

export class SasukePresentation {
  private crouchDepth = 0;
  private walkClock = 0;
  private previousX?: number;
  private previousFacing = 0;

  constructor(private readonly animator: Animator) {}

  tick(f: Fighter) {
    const dx = Math.abs(f.x - (this.previousX ?? f.x));
    const turned = this.previousFacing !== f.facing;
    this.previousX = f.x;
    this.previousFacing = f.facing;
    const previous = this.animator.clipName;
    const reaction = reactionFor(f);
    const locomotion = f.data.locomotion!;
    const powered = winged(f);
    const visual = (name: string) => {
      const variant = curseClipName(name);
      return powered && this.animator.hasClip(variant) ? variant : name;
    };
    let clip = "idle",
      tick: number | undefined;

    if (f.state === "attack" && this.animator.hasClip(f.moveId)) {
      clip = f.moveId;
      tick = f.stateFrame;
    } else if (powered && f.state === "air" && f.sasukeCurse?.airBurstTick) {
      clip = "airBurst";
      tick = f.sasukeCurse.airBurstTick - 1;
    } else if (reaction && this.animator.hasClip(reaction.clip)) {
      clip = reaction.clip;
      tick = reaction.tick;
    } else if (f.state === "dash") {
      const forward = f.dashDirection === f.facing;
      clip = forward ? "dashForward" : "backdash";
      tick = f.stateFrame;
    } else if (f.state === "jumpStart" || f.state === "landing") {
      clip = f.state;
      tick = f.stateFrame;
    } else if (f.airborne) {
      if (f.vy < -3) {
        clip = "jumpRise";
        tick =
          (sasukeClipTicks(clip) * (f.vy - f.data.jump)) / (-3 - f.data.jump);
      } else if (f.vy > 3) {
        clip = "jumpFall";
        const speedAtFloor = Math.sqrt(
          f.vy * f.vy + 2 * f.data.gravity * (FLOOR - f.y),
        );
        tick =
          (sasukeClipTicks(clip) * (f.vy - 3)) / Math.max(1, speedAtFloor - 3);
      } else clip = "jumpApex";
    } else if (f.state === "crouch") {
      clip =
        this.crouchDepth < sasukeClipTicks("crouchStart")
          ? "crouchStart"
          : "crouchIdle";
      if (clip === "crouchStart") tick = this.crouchDepth++;
    } else if (f.state === "idle" && this.crouchDepth > 0) {
      clip = "crouchEnd";
      tick = sasukeClipTicks(clip) - this.crouchDepth--;
    } else if (f.state === "walk") {
      const forward = f.vx * f.facing > 0;
      clip = forward ? "walkForward" : "walkBack";
      this.walkClock =
        previous === visual(clip) && !turned
          ? (this.walkClock +
              Math.min(
                1,
                dx / (forward ? f.data.speed : locomotion.backSpeed),
              )) %
            sasukeClipTicks(clip)
          : 0;
      tick = this.walkClock;
    }
    if (!clip.startsWith("crouch")) this.crouchDepth = 0;
    this.animator.update(visual(clip));
    if (tick !== undefined) this.animator.seekTick(tick);
  }
}
