import type { Fighter } from "../engine/combat";
import { FLOOR } from "../engine/combat";
import type { Animator, AnimationData } from "./animator";
import animation from "../data/goku-animations.json";
import gait from "../data/goku-gait.json";

/** Native gait phase follows travelled distance; jump drawings follow physics.
 * No sprite offset replaces movement of the simulation root. */
export class GokuMotionPresentation {
  private previousX?: number;
  private walkPhase = 0;
  private lastWalk = "";
  private crouch = 0;
  private exitTick?: number;
  constructor(readonly animator: Animator) {}
  tick(a: Fighter) {
    const dx = this.previousX === undefined ? 0 : a.x - this.previousX;
    this.previousX = a.x;
    if (
      ![
        "idle",
        "walk",
        "crouch",
        "dash",
        "air",
        "jumpStart",
        "landing",
      ].includes(a.state)
    ) {
      this.crouch = a.crouching ? 6 : 0;
      this.exitTick = undefined;
      this.lastWalk = "";
      return false;
    }
    let clip = "idle",
      sync: number | undefined;
    if (a.state === "jumpStart" || a.state === "landing") {
      clip = a.state;
      sync = a.stateFrame;
      this.crouch = 0;
    } else if (a.airborne) {
      const phase = a.vy < -3 ? "jumpRise" : a.vy > 3 ? "jumpFall" : "jumpApex";
      const direction = a.vx * a.facing;
      clip =
        phase +
        (direction > 0.5 ? "Forward" : direction < -0.5 ? "Backward" : "");
      const terminal = Math.sqrt(
        a.vy * a.vy + 2 * a.data.gravity * Math.max(0, FLOOR - a.y),
      );
      const progress =
        phase === "jumpRise"
          ? (a.vy - a.data.jump) / (-3 - a.data.jump)
          : phase === "jumpApex"
            ? (a.vy + 3) / 6
            : (a.vy - 3) / Math.max(0.01, terminal - 3);
      const durations = (animation as AnimationData).clips[clip].durations!;
      const total = durations.reduce((a, b) => a + b, 0);
      sync = Math.min(
        total - 1,
        Math.floor(Math.max(0, Math.min(1, progress)) * total),
      );
      this.crouch = 0;
    } else if (a.state === "dash") {
      clip = a.dashDirection === a.facing ? "dashForward" : "backdash";
      sync = a.stateFrame;
      this.crouch = 0;
    } else if (a.state === "crouch") {
      this.exitTick = undefined;
      this.crouch = Math.min(6, this.crouch + 1);
      clip = this.crouch < 6 ? "crouchStart" : "crouchIdle";
      if (this.crouch < 6) sync = this.crouch - 1;
    } else if (a.state === "idle" && this.crouch > 0) {
      this.exitTick ??= this.crouch <= 2 ? 2 : 0;
      clip = "crouchEnd";
      sync = this.exitTick++;
      this.crouch = Math.max(0, 6 - sync - 1);
      if (sync >= 5) {
        this.crouch = 0;
        this.exitTick = undefined;
      }
    } else if (a.state === "walk" && Math.abs(dx) > 0.01) {
      clip = a.vx * a.facing >= 0 ? "walkForward" : "walkBack";
      const definition = gait[clip as keyof typeof gait];
      if (this.lastWalk !== clip) {
        if (this.lastWalk) {
          const prior =
            gait[this.lastWalk as keyof typeof gait].feet[
              this.animator.frame()
            ];
          let best = Infinity;
          definition.feet.forEach((feet, i) => {
            const error = feet.reduce(
              (sum, v, j) => sum + (v - prior[j]) ** 2,
              0,
            );
            if (error < best) {
              best = error;
              this.walkPhase = i;
            }
          });
        } else this.walkPhase = 0;
      } else
        this.walkPhase =
          (this.walkPhase + Math.abs(dx) / Math.abs(definition.speed)) %
          definition.ticks;
      sync = Math.floor(this.walkPhase + 1e-6) % definition.ticks;
      this.crouch = 0;
    }
    this.animator.update(clip);
    if (sync !== undefined) this.animator.seekTick(sync);
    this.lastWalk = clip.startsWith("walk") ? clip : "";
    return true;
  }
}
