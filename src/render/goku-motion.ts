import type { Fighter } from "../engine/combat";
import { FLOOR } from "../engine/combat";
import type { Animator, AnimationData } from "./animator";
import animation from "../data/goku-animations.json";
import combatAnimation from "../data/goku-combat-animations.json";
import specialAnimation from "../data/goku-special-animations.json";
import gait from "../data/goku-gait.json";

const crouchTicks = animation.clips.crouchStart.durations.reduce(
  (a, b) => a + b,
  0,
);
const endTicks = animation.clips.crouchEnd.durations.reduce((a, b) => a + b, 0);

type WalkName = "walkForward" | "walkBack";
type FootSide = "near" | "far";
interface WalkPixelOptions {
  /** Optional integer root correction only; it never changes sprite pixels.
   * Defaults to zero. A held whole cel cannot keep its foot fully stationary
   * and its torso continuously moving without deforming the drawing. */
  maxFootCorrection?: number;
}
export interface GokuPlantedFoot {
  side: FootSide;
  worldX: number;
  facing: number;
}
function walkTiming(name: WalkName) {
  const clip = (animation as AnimationData).clips[name];
  let total = 0;
  const starts = new Map<number, number>();
  clip.frames.forEach((frame, i) => {
    starts.set(frame, total);
    total += clip.durations?.[i] ?? clip.ticks;
  });
  return { starts, total };
}
const walkTimings = {
  walkForward: walkTiming("walkForward"),
  walkBack: walkTiming("walkBack"),
};
type VisualClip = AnimationData["clips"][string] & { visualHeights?: number[] };
function visualHeight(name: string, frame: number) {
  const clip = ((animation as AnimationData).clips[name] ??
    (combatAnimation as unknown as AnimationData).clips[name] ??
    (specialAnimation as unknown as AnimationData).clips[name]) as
    VisualClip | undefined;
  return clip?.visualHeights?.[frame];
}
function tickAtHeight(name: string, height: number | undefined) {
  const clip = (animation as AnimationData).clips[name] as VisualClip;
  if (height === undefined || !clip.visualHeights) return 0;
  let best = 0;
  clip.visualHeights.forEach((value, i) => {
    if (Math.abs(value - height) < Math.abs(clip.visualHeights![best] - height))
      best = i;
  });
  return clip.frames
    .slice(0, best)
    .reduce((sum, _, i) => sum + (clip.durations?.[i] ?? clip.ticks), 0);
}
function clipTicks(name: string) {
  const c = (animation as AnimationData).clips[name];
  return c.frames.reduce((sum, _, i) => sum + (c.durations?.[i] ?? c.ticks), 0);
}
function frameAtTick(name: string, tick: number) {
  const c = (animation as AnimationData).clips[name];
  for (let i = 0; i < c.frames.length; i++) {
    tick -= c.durations?.[i] ?? c.ticks;
    if (tick < 0) return i;
  }
  return c.frames.length - 1;
}

/** Whole painted walk cels follow travelled distance and their own durations.
 * No mesh, limb interpolation, generated stop pose or pixel deformation occurs
 * here. An optional small integer foot correction is bounded to four pixels;
 * held cels can still show sliding. Their authored poses/timing remain decisive.
 * Jump/crouch/dash keep their existing independent presentation. */
export class GokuMotionPresentation {
  private previousX?: number;
  private walkPhase = 0;
  private lastWalk = "";
  private crouch = 0;
  private crouchHeight?: number;
  private exitTick?: number;
  private entryFeet?: number[];
  private plant?: GokuPlantedFoot;
  private previousFacing?: number;
  private footAnchor?: GokuPlantedFoot;
  private footCorrection = 0;
  private airDirection = "";
  private dashRecovery?: { clip: string; tick: number };
  private walkTransition?: { clip: string; tick: number };
  constructor(readonly animator: Animator) {}
  /** Actual selected support, for the inspector and gait regression checks. */
  get plantedFoot(): Readonly<GokuPlantedFoot> | undefined {
    return this.plant ? { ...this.plant } : undefined;
  }
  private walkSample(a: Fighter) {
    const name = this.animator.clipName;
    const transition =
      name === "crouchWalkForward" || name === "crouchWalkBack";
    if (
      a.state !== "walk" ||
      (!transition && name !== "walkForward" && name !== "walkBack")
    )
      return;
    const key = name.endsWith("Forward") ? "walkForward" : "walkBack";
    const definition = gait[key];
    const frame = this.animator.frame();
    const support = (
      transition ? definition.crouchExitSupport : definition.supportByFrame
    )[frame];
    if (!support?.length) return;
    const previous =
      this.plant?.facing === a.facing ? this.plant.side : undefined;
    // During double support keep the old leg until its toe leaves the floor.
    const side: FootSide =
      previous && support.includes(previous)
        ? previous
        : support[0] === "near"
          ? "near"
          : "far";
    return {
      side,
      feet: (transition ? definition.crouchExitFeet : definition.feet)[frame],
      pixels: (transition
        ? definition.crouchExitPixelFeet
        : definition.pixelFeet)[frame],
      correctionLimit: transition
        ? 0
        : Math.max(
            0,
            Math.min(
              4,
              Math.floor(
                (definition as WalkPixelOptions).maxFootCorrection ?? 0,
              ),
            ),
          ),
    };
  }
  /** Quantise from the planted sole, avoiding a one-pixel beat caused by
   * independently rounding a fractional root and a fractional atlas ankle. */
  renderRootX(a: Fighter) {
    const sample = this.walkSample(a);
    if (!sample) return Math.round(a.x);
    const side = sample.side === "near" ? 0 : 1;
    const { feet, pixels } = sample;
    return (
      Math.round(a.x + (feet[side] - 128) * a.facing) -
      (pixels[side] - 128) * a.facing +
      this.footCorrection
    );
  }
  private recordPlant(a: Fighter) {
    const sample = this.walkSample(a);
    if (!sample) {
      this.plant = undefined;
      this.footAnchor = undefined;
      this.footCorrection = 0;
      return;
    }
    const nominal = Math.round(
      a.x + (sample.feet[sample.side === "near" ? 0 : 1] - 128) * a.facing,
    );
    if (
      !this.footAnchor ||
      this.footAnchor.side !== sample.side ||
      this.footAnchor.facing !== a.facing
    )
      this.footAnchor = {
        side: sample.side,
        worldX: nominal + this.footCorrection,
        facing: a.facing,
      };
    this.footCorrection = Math.max(
      -sample.correctionLimit,
      Math.min(sample.correctionLimit, this.footAnchor.worldX - nominal),
    );
    // This reports the rendered sole, not a fictitious perfectly locked point.
    this.plant = {
      side: sample.side,
      worldX: nominal + this.footCorrection,
      facing: a.facing,
    };
  }
  tick(a: Fighter) {
    const dx = this.previousX === undefined ? 0 : a.x - this.previousX;
    this.previousX = a.x;
    if (this.previousFacing !== undefined && this.previousFacing !== a.facing) {
      this.plant = undefined;
      this.lastWalk = "";
      this.entryFeet = undefined;
      this.footAnchor = undefined;
      this.footCorrection = 0;
    }
    this.previousFacing = a.facing;
    if (a.state !== "walk") this.entryFeet = undefined;
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
      const height = visualHeight(
        this.animator.clipName,
        this.animator.frame(),
      );
      this.crouch =
        !a.airborne && height !== undefined && height < 116 ? crouchTicks : 0;
      this.crouchHeight = height;
      this.walkTransition = undefined;
      this.dashRecovery = undefined;
      this.exitTick = undefined;
      this.lastWalk = "";
      this.entryFeet = undefined;
      this.plant = undefined;
      this.footAnchor = undefined;
      this.footCorrection = 0;
      return false;
    }
    let clip = "idle",
      sync: number | undefined;
    const priorClip = this.animator.clipName;
    if (a.state !== "dash" && ["dashForward", "backdash"].includes(priorClip))
      this.dashRecovery = { clip: priorClip + "Recovery", tick: 0 };
    if (a.state !== "idle") this.dashRecovery = undefined;
    const movingWalk = a.state === "walk" && Math.abs(dx) > 0.01;
    const walkSuffix = a.vx * a.facing >= 0 ? "Forward" : "Back";
    if (!["idle", "walk"].includes(a.state)) this.walkTransition = undefined;
    else if (movingWalk && this.crouch === 0) {
      const entry = "idleToWalk" + walkSuffix;
      if (priorClip === "idle") this.walkTransition = { clip: entry, tick: 0 };
      else if (this.walkTransition && this.walkTransition.clip !== entry)
        this.walkTransition = undefined;
    } else if (
      !movingWalk &&
      (this.lastWalk || priorClip.startsWith("idleToWalk"))
    ) {
      const suffix = this.lastWalk
        ? this.lastWalk === "walkForward"
          ? "Forward"
          : "Back"
        : priorClip.slice("idleToWalk".length);
      this.walkTransition = { clip: "walkToIdle" + suffix, tick: 0 };
    }
    if (a.state === "jumpStart" || a.state === "landing") {
      if (a.state === "jumpStart") this.airDirection = "";
      clip = a.state === "landing" ? "landing" + this.airDirection : a.state;
      sync = a.stateFrame;
      this.crouch = 0;
    } else if (a.airborne) {
      const phase = a.vy < -3 ? "jumpRise" : a.vy > 3 ? "jumpFall" : "jumpApex";
      const direction = a.vx * a.facing;
      this.airDirection =
        direction > 0.5 ? "Forward" : direction < -0.5 ? "Backward" : "";
      clip = phase + this.airDirection;
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
      if (this.animator.clipName === "crouchEnd" && this.exitTick !== undefined)
        this.crouch = tickAtHeight("crouchStart", this.crouchHeight);
      this.exitTick = undefined;
      clip = this.crouch < crouchTicks ? "crouchStart" : "crouchIdle";
      if (this.crouch < crouchTicks) sync = this.crouch++;
    } else if (
      (a.state === "idle" || (a.state === "walk" && Math.abs(dx) <= 0.01)) &&
      this.crouch > 0
    ) {
      // Select a complete rising drawing at the actual visible depth. Never
      // deform a partial squat or assume that cels and ticks have equal counts.
      this.exitTick ??= tickAtHeight("crouchEnd", this.crouchHeight);
      clip = "crouchEnd";
      sync = this.exitTick++;
      this.crouch = Math.max(0, endTicks - sync - 1);
      if (sync >= endTicks - 1) {
        this.crouch = 0;
        this.exitTick = undefined;
      }
    } else if (a.state === "walk" && Math.abs(dx) > 0.01 && this.crouch > 0) {
      const direction = a.vx * a.facing >= 0 ? "Forward" : "Back";
      clip = "crouchWalk" + direction;
      this.exitTick ??= tickAtHeight(clip, this.crouchHeight);
      sync = this.exitTick++;
      this.entryFeet =
        gait[("walk" + direction) as keyof typeof gait].crouchExitFeet[
          frameAtTick(clip, sync)
        ];
      this.crouch = Math.max(0, clipTicks(clip) - 1 - sync);
      if (sync >= clipTicks(clip) - 1) this.exitTick = undefined;
    } else if (this.walkTransition) {
      clip = this.walkTransition.clip;
      sync = this.walkTransition.tick++;
      if (sync >= clipTicks(clip) - 1) {
        if (movingWalk)
          this.entryFeet =
            gait[("walk" + walkSuffix) as keyof typeof gait].feet[0];
        this.walkTransition = undefined;
      }
    } else if (a.state === "walk" && Math.abs(dx) > 0.01) {
      clip = a.vx * a.facing >= 0 ? "walkForward" : "walkBack";
      const definition = gait[clip as keyof typeof gait];
      const timing = walkTimings[clip as WalkName];
      if (this.lastWalk !== clip) {
        {
          const previousFeet = this.lastWalk
            ? gait[this.lastWalk as keyof typeof gait].feet[
                this.animator.frame()
              ]
            : (this.entryFeet ?? definition.restFeet);
          const prior = previousFeet.map(
            (x) => x - dx * a.facing + this.footCorrection * a.facing,
          );
          const plantedSide =
            this.plant?.facing === a.facing ? this.plant.side : undefined;
          const eligible = definition.supportByFrame
            .map((_, i) => i)
            .filter(
              (i) =>
                !plantedSide ||
                definition.supportByFrame[i].includes(plantedSide),
            );
          const candidates = new Set(
            eligible.length ? eligible : definition.feet.map((_, i) => i),
          );
          let best = Infinity;
          definition.feet.forEach((feet, i) => {
            if (!candidates.has(i) || !timing.starts.has(i)) return;
            const support =
              (plantedSide ?? definition.supportByFrame[i][0]) === "near"
                ? 0
                : 1;
            const error = feet.reduce(
              (sum, v, j) =>
                sum + (v - prior[j]) ** 2 * (j === support ? 4 : 0.1),
              0,
            );
            if (error < best) {
              best = error;
              // Phase is measured in ticks, not in source drawing indices.
              this.walkPhase = timing.starts.get(i)!;
            }
          });
        }
      } else
        this.walkPhase =
          (this.walkPhase + Math.abs(dx) / Math.abs(definition.speed)) %
          timing.total;
      sync = Math.floor(this.walkPhase + 1e-6) % timing.total;
      this.crouch = 0;
      this.exitTick = undefined;
    }
    if (clip === "idle" && this.dashRecovery) {
      clip = this.dashRecovery.clip;
      sync = this.dashRecovery.tick++;
      const total = (animation as AnimationData).clips[clip].durations!.reduce(
        (sum, t) => sum + t,
        0,
      );
      if (sync >= total - 1) this.dashRecovery = undefined;
    }
    if (clip === "idle") this.entryFeet = undefined;
    this.animator.update(clip);
    if (sync !== undefined) this.animator.seekTick(sync);
    if (
      [
        "crouchStart",
        "crouchIdle",
        "crouchEnd",
        "crouchWalkForward",
        "crouchWalkBack",
      ].includes(clip)
    )
      this.crouchHeight = visualHeight(clip, this.animator.frame());
    this.recordPlant(a);
    this.lastWalk = clip === "walkForward" || clip === "walkBack" ? clip : "";
    return true;
  }
}
