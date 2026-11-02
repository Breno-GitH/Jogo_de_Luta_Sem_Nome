import { FLOOR } from "./combat";
import type { InputFrame } from "./types";
import movement from "../data/dio-movement.json";
import type { EntityAnchor } from "./linked-entity";

export type DioLocomotion =
  | "idle"
  | "walkForward"
  | "walkBack"
  | "dashForward"
  | "backdash"
  | "crouchStart"
  | "crouchIdle"
  | "crouchEnd"
  | "jumpStart"
  | "jumpRise"
  | "jumpApex"
  | "jumpFall"
  | "landing";

/** Movement-only actor. Gameplay transitions/timing never depend on PNG loading
 * or animation playback. Attacks remain outside this locomotion test stage. */
export class DioMovement implements EntityAnchor {
  readonly id = "dio";
  x = 520;
  y = FLOOR;
  facing: -1 | 1 = 1;
  vx = 0;
  vy = 0;
  state: DioLocomotion = "idle";
  stateFrame = 0;
  clock = 0;
  private jumpDirection = 0;
  dashDirection = 1;
  get airborne() {
    return this.y < FLOOR || this.vy < 0;
  }
  get motion() {
    if (this.state.startsWith("jump")) return "jump";
    if (this.state === "dashForward" || this.state === "backdash")
      return "dash";
    if (this.state === "walkForward" || this.state === "walkBack")
      return this.state;
    if (this.state === "landing") return "landing";
    if (this.state.startsWith("crouch")) return "crouch";
    return "idle";
  }
  private enter(state: DioLocomotion, restart = false) {
    if (this.state !== state || restart) {
      this.state = state;
      this.stateFrame = 0;
    }
  }
  turn() {
    this.facing = this.facing === 1 ? -1 : 1;
  }
  reset() {
    this.x = 520;
    this.y = FLOOR;
    this.facing = 1;
    this.vx = this.vy = this.clock = 0;
    this.state = "idle";
    this.stateFrame = 0;
    this.jumpDirection = 0;
    this.dashDirection = 1;
  }
  tick(input: InputFrame) {
    this.clock++;
    this.stateFrame++;
    const dash = this.state === "dashForward" || this.state === "backdash";
    if (dash && this.stateFrame >= movement.dashForward.length) {
      this.enter("idle");
      this.vx = 0;
    }
    if (this.state === "landing" && this.stateFrame >= movement.landingTicks)
      this.enter("idle");
    if (
      !this.airborne &&
      input.pressed.includes("jump") &&
      this.state !== "jumpStart"
    ) {
      this.jumpDirection = input.direction;
      this.vx = 0;
      this.enter("jumpStart");
    } else if (
      !this.airborne &&
      this.state !== "jumpStart" &&
      input.direction &&
      input.pressed.includes("dash")
    ) {
      this.dashDirection = input.direction;
      this.enter(
        input.direction === this.facing ? "dashForward" : "backdash",
        true,
      );
    }
    if (this.state === "jumpStart") {
      if (this.stateFrame < movement.jumpStartup) {
        this.vx = 0;
        return;
      }
      this.vy = movement.jumpVelocity;
      this.vx = this.jumpDirection * movement.airSpeed;
      this.enter("jumpRise");
    }
    if (this.airborne) {
      if (input.direction) this.vx = input.direction * movement.airSpeed;
      this.vy += movement.gravity;
      this.x += this.vx;
      this.y += this.vy;
      if (this.y >= FLOOR) {
        this.y = FLOOR;
        this.vy = this.vx = 0;
        this.enter("landing");
      } else
        this.enter(
          this.vy < -3 ? "jumpRise" : this.vy > 3 ? "jumpFall" : "jumpApex",
        );
    } else if (this.state === "dashForward" || this.state === "backdash") {
      this.vx =
        this.dashDirection *
        (this.state === "dashForward"
          ? movement.dashForward
          : movement.backdash)[this.stateFrame];
      this.x += this.vx;
    } else if (this.state === "landing") {
      this.vx = 0;
    } else if (input.down) {
      this.vx = 0;
      if (this.state !== "crouchStart" && this.state !== "crouchIdle")
        this.enter("crouchStart");
      else if (
        this.state === "crouchStart" &&
        this.stateFrame >= movement.crouchStartTicks
      )
        this.enter("crouchIdle");
    } else if (this.state === "crouchStart" || this.state === "crouchIdle") {
      this.vx = 0;
      this.enter("crouchEnd");
    } else if (
      this.state === "crouchEnd" &&
      this.stateFrame < movement.crouchEndTicks
    ) {
      this.vx = 0;
    } else {
      this.vx =
        input.direction *
        (input.direction === this.facing
          ? movement.walkSpeed
          : movement.backSpeed);
      this.x += this.vx;
      this.enter(
        input.direction
          ? input.direction === this.facing
            ? "walkForward"
            : "walkBack"
          : "idle",
      );
    }
    this.x = Math.max(
      movement.leftBound,
      Math.min(movement.rightBound, this.x),
    );
  }
}
