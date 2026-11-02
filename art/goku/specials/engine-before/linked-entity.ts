import type { Point } from "./types";

export interface EntityAnchor {
  id: string;
  x: number;
  y: number;
  facing: -1 | 1;
  motion?: string;
  stateFrame?: number;
}
export interface LinkedEntityData {
  id: string;
  ownerId: string;
  hoverOffset: Point;
  frontOffset: Point;
  hoverBob: number[];
  bobTicks: number;
  advanceTicks: number;
  holdTicks: number;
  returnTicks: number;
  backDepth: number;
  frontDepth: number;
  followGain: number;
  verticalGain: number;
  maxLagX: number;
  maxLagY: number;
  turnTicks: number;
  settleTicks: number;
}
export type LinkedState = "hover" | "advance" | "hold" | "return";
export type CompanionClip =
  | "standIdle"
  | "floating"
  | "followForward"
  | "followBackward"
  | "dashFollow"
  | "jumpFollow"
  | "returnPosition";

/** Fixed-tick following and independent pose clock. Position lag is bounded in
 * a jump; a direction change goes behind the owner in an elevated arc, never
 * drawing front armour through the owner's face. No combat is fabricated. */
export class LinkedEntity {
  state: LinkedState = "hover";
  stateFrame = 0;
  clock = 0;
  animation: CompanionClip = "standIdle";
  animationFrame = 0;
  private x = 0;
  private y = 0;
  private previousFacing: -1 | 1;
  private previousMotion = "idle";
  private turnRemaining = 0;
  private settling = 0;
  private idleClock = 0;
  constructor(
    public readonly data: LinkedEntityData,
    public readonly owner: EntityAnchor,
  ) {
    if (owner.id !== data.ownerId)
      throw new Error("Stand owner does not match its data");
    this.previousFacing = owner.facing;
    this.snap();
  }
  private snap() {
    this.x = this.owner.x + this.data.hoverOffset.x * this.owner.facing;
    this.y = this.owner.y + this.data.hoverOffset.y;
  }
  advance() {
    if (this.state !== "hover") return false;
    this.state = "advance";
    this.stateFrame = 0;
    return true;
  }
  reset() {
    this.state = "hover";
    this.stateFrame = this.clock = this.animationFrame = this.idleClock = 0;
    this.animation = "standIdle";
    this.previousFacing = this.owner.facing;
    this.previousMotion = "idle";
    this.turnRemaining = this.settling = 0;
    this.snap();
  }
  get reference() {
    const progress =
      this.state === "hover"
        ? 0
        : this.state === "hold"
          ? 1
          : this.state === "advance"
            ? this.stateFrame / this.data.advanceTicks
            : 1 - this.stateFrame / this.data.returnTicks;
    const a = this.data.hoverOffset,
      b = this.data.frontOffset;
    return {
      x: this.owner.x + (a.x + (b.x - a.x) * progress) * this.owner.facing,
      y: this.owner.y + a.y + (b.y - a.y) * progress,
    };
  }
  tick() {
    this.clock++;
    this.stateFrame++;
    const motion = this.owner.motion ?? "idle";
    if (this.owner.facing !== this.previousFacing) {
      this.turnRemaining = this.data.turnTicks;
      this.settling = this.data.settleTicks;
      if (this.state !== "hover") {
        this.state = "return";
        this.stateFrame = 0;
      }
      this.previousFacing = this.owner.facing;
    }
    const total =
      this.state === "advance"
        ? this.data.advanceTicks
        : this.state === "hold"
          ? this.data.holdTicks
          : this.data.returnTicks;
    if (this.state !== "hover" && this.stateFrame >= total) {
      this.state =
        this.state === "advance"
          ? "hold"
          : this.state === "hold"
            ? "return"
            : "hover";
      this.stateFrame = 0;
      if (this.state === "hover") this.settling = this.data.settleTicks;
    }
    if (
      this.previousMotion !== motion &&
      ["idle", "crouch", "landing"].includes(motion)
    )
      this.settling = this.data.settleTicks;
    if (motion !== "idle" || this.settling > 0) this.idleClock = 0;
    else this.idleClock++;
    const desired = this.reference;
    // Discrete arc only affects a facing transition. All follow rendering stays
    // behind Dio during it; the new relative target itself mirrors immediately.
    const arc = [0, -3, -5, -7, -8, -8, -7, -5, -3, 0];
    const turnIndex = this.data.turnTicks - this.turnRemaining;
    const arcY =
      this.turnRemaining > 0
        ? arc[
            Math.min(
              arc.length - 1,
              Math.floor((turnIndex * arc.length) / this.data.turnTicks),
            )
          ]
        : 0;
    let stepX = (desired.x - this.x) * this.data.followGain;
    if (this.turnRemaining > 0) {
      const limit =
        (Math.abs(this.data.hoverOffset.x) * 4) / this.data.turnTicks;
      stepX = Math.max(-limit, Math.min(limit, stepX));
    }
    this.x += stepX;
    this.y += (desired.y + arcY - this.y) * this.data.verticalGain;
    if (this.turnRemaining <= 0)
      this.x = Math.max(
        desired.x - this.data.maxLagX,
        Math.min(desired.x + this.data.maxLagX, this.x),
      );
    this.y = Math.max(
      desired.y + arcY - this.data.maxLagY,
      Math.min(desired.y + arcY + this.data.maxLagY, this.y),
    );
    if (Math.abs(this.x - desired.x) < 0.05) this.x = desired.x;
    if (Math.abs(this.y - desired.y) < 0.05 && !arcY) this.y = desired.y;
    let clip: CompanionClip =
      this.state === "return" || this.turnRemaining > 0
        ? "returnPosition"
        : this.state === "advance"
          ? "dashFollow"
          : motion === "jump"
            ? "jumpFollow"
            : motion === "dash"
              ? "dashFollow"
              : motion === "walkForward"
                ? "followForward"
                : motion === "walkBack"
                  ? "followBackward"
                  : this.settling > 0
                    ? "returnPosition"
                    : this.idleClock % 102 < 56
                      ? "standIdle"
                      : "floating";
    if (this.state === "hold") clip = "floating";
    const restart =
      clip !== this.animation ||
      (motion === "dash" && this.owner.stateFrame === 0);
    if (restart) {
      this.animation = clip;
      this.animationFrame = 0;
    } else this.animationFrame++;
    this.previousMotion = motion;
    if (this.turnRemaining > 0) this.turnRemaining--;
    if (this.settling > 0) this.settling--;
  }
  get transform() {
    const bob =
      this.data.hoverBob[
        Math.floor(this.clock / this.data.bobTicks) % this.data.hoverBob.length
      ];
    return {
      x: Math.round(this.x),
      y: Math.round(this.y + bob),
      facing: this.owner.facing,
      depth:
        this.turnRemaining > 0 ||
        this.state === "hover" ||
        (this.x - this.owner.x) * this.owner.facing < 25
          ? this.data.backDepth
          : this.data.frontDepth,
    };
  }
}
