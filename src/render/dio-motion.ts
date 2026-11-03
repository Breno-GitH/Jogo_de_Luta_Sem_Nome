import { Animator, type AnimationData } from "./animator";
import { FLOOR } from "../engine/combat";
import animation from "../data/dio-animations.json";
import gait from "../data/dio-gait.json";

interface MotionActor {
  moveId?: string;
  crouching?: boolean;
  data?: {
    jump: number;
    gravity: number;
    locomotion?: { jumpStartup: number; landingTicks: number };
  };
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  state: string;
  stateFrame: number;
  airborne: boolean;
  dashDirection?: number;
}
const locomotion = new Set([
  "idle",
  "walk",
  "walkForward",
  "walkBack",
  "dash",
  "dashForward",
  "backdash",
  "crouch",
  "crouchStart",
  "crouchIdle",
  "crouchEnd",
  "jumpStart",
  "air",
  "jumpRise",
  "jumpApex",
  "jumpFall",
  "landing",
]);

/** Visual phase selection shared by the game and inspector. Only the simulation
 * moves the owner. Gait phase measures actual travelled distance; jump poses
 * measure velocity and distance to the floor, rather than render time. */
export class DioMotionPresentation {
  private crouch = 0;
  private previousX?: number;
  private lastWalk = "";
  private phase = 0;
  private exitTick?: number;
  constructor(readonly animator: Animator) {}
  tick(a: MotionActor): boolean {
    const dx = this.previousX === undefined ? a.vx : a.x - this.previousX;
    this.previousX = a.x;
    if (!locomotion.has(a.state)) {
      this.crouch = a.crouching || a.moveId?.startsWith("crouch_") ? 9 : 0;
      this.exitTick = undefined;
      this.lastWalk = "";
      return false;
    }
    let clip = "idle",
      sync: number | undefined;
    if (a.state === "jumpStart" || a.state === "landing") {
      clip = a.state;
      sync =
        (a.stateFrame *
          animation.clips[clip as "jumpStart" | "landing"].durations.reduce(
            (s, v) => s + v,
            0,
          )) /
        (a.state === "jumpStart"
          ? (a.data?.locomotion?.jumpStartup ?? 8)
          : (a.data?.locomotion?.landingTicks ?? 8));
      this.crouch = 0;
    } else if (a.airborne) {
      const phase = a.vy < -3 ? "jumpRise" : a.vy > 3 ? "jumpFall" : "jumpApex";
      const direction = a.vx * a.facing;
      clip =
        phase +
        (direction > 0.5 ? "Forward" : direction < -0.5 ? "Backward" : "");
      const gravity = a.data?.gravity ?? 0.7,
        initial = a.data?.jump ?? -15.5;
      const terminal = Math.sqrt(
        a.vy * a.vy + 2 * gravity * Math.max(0, FLOOR - a.y),
      );
      const progress =
        phase === "jumpRise"
          ? (a.vy - initial) / (-3 - initial)
          : phase === "jumpApex"
            ? (a.vy + 3) / 6
            : (a.vy - 3) / Math.max(0.01, terminal - 3);
      const definition = (animation as AnimationData).clips[clip];
      const total = definition.durations!.reduce((s, v) => s + v, 0);
      // Trajectory determines phase progress; individual frame holds determine
      // where the drawings fall within that phase, including altered jumps.
      sync = Math.min(
        total - 1,
        Math.floor(Math.max(0, Math.min(1, progress)) * total),
      );
      this.crouch = 0;
    } else if (
      a.state === "dash" ||
      a.state === "dashForward" ||
      a.state === "backdash"
    ) {
      clip =
        a.state === "backdash" || (a.dashDirection ?? a.vx) * a.facing < 0
          ? "backdash"
          : "dashForward";
      sync = a.stateFrame;
      this.crouch = 0;
    } else if (["crouch", "crouchStart", "crouchIdle"].includes(a.state)) {
      this.exitTick = undefined;
      this.crouch = Math.min(9, this.crouch + 1);
      clip = this.crouch < 9 ? "crouchStart" : "crouchIdle";
      if (this.crouch < 9) sync = this.crouch - 1;
    } else if (
      (a.state === "idle" || a.state === "crouchEnd") &&
      this.crouch > 0
    ) {
      this.exitTick ??= Math.max(0, 6 - 2 * Math.ceil(this.crouch / 2));
      clip = "crouchEnd";
      sync = this.exitTick++;
      // Reverse a partially completed crouch from the nearest anatomical
      // level; releasing S early must not pop from a half crouch to standing.
      this.crouch = Math.max(0, 7 - 2 * Math.floor(sync / 2));
      if (sync >= 7) {
        this.crouch = 0;
        this.exitTick = undefined;
      }
    } else if (
      ["walk", "walkForward", "walkBack"].includes(a.state) &&
      Math.abs(dx) > 0.01
    ) {
      clip = a.vx * a.facing >= 0 ? "walkForward" : "walkBack";
      if (this.lastWalk !== clip) {
        // Match boot locations on a rapid reversal, without playing the
        // forward drawings backwards or resetting to an arbitrary contact.
        if (this.lastWalk) {
          const prior =
            gait[this.lastWalk as keyof typeof gait].feet[
              this.animator.frame()
            ];
          let best = Infinity;
          gait[clip as keyof typeof gait].feet.forEach((feet, i) => {
            const error = feet.reduce((s, v, j) => s + (v - prior[j]) ** 2, 0);
            if (error < best) {
              best = error;
              this.phase = i;
            }
          });
        } else this.phase = 0;
      } else
        this.phase =
          (this.phase +
            Math.abs(dx) / Math.abs(gait[clip as keyof typeof gait].speed)) %
          40;
      sync = Math.floor(this.phase + 1e-6) % 40;
      this.crouch = 0;
    }
    this.animator.update(clip);
    if (sync !== undefined) this.animator.seekTick(sync);
    if (clip.startsWith("walk")) this.lastWalk = clip;
    else this.lastWalk = "";
    return true;
  }
}

export function makeDioMotion() {
  return new DioMotionPresentation(new Animator(animation));
}
