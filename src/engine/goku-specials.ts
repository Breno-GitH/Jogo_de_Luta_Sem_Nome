import balance from "../data/goku-specials.json";
import type { Fighter } from "./combat";
import type { Rect } from "./types";
import { poseAt } from "./moves";
import { combatPace } from "./pace";
export { balance as gokuBalance };
export interface KiProjectile {
  id: number;
  owner: number;
  move: string;
  cast: number;
  curse?: boolean;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  facing: number;
  radius: number;
  age: number;
  life: number;
  state: "flight" | "impact";
  impactAge: number;
}
export interface KiBeam {
  id: number;
  owner: number;
  move: string;
  cast: number;
  facing: number;
  x: number;
  y: number;
  length: number;
  radius: number;
  age: number;
  life: number;
  state: "active" | "dissipate";
  hitIds: number[];
  impactAge: number;
}
export const beamBox = (b: KiBeam): Rect => ({
  x: b.facing === 1 ? b.x : b.x - b.length,
  y: b.y - b.radius,
  w: b.length,
  h: b.radius * 2,
});
export const kiBox = (p: KiProjectile): Rect => ({
  x: p.x - p.radius,
  y: p.y - p.radius,
  w: p.radius * 2,
  h: p.radius * 2,
});
export function gokuInvisible(f: Fighter) {
  return (
    f.data.id === "goku" &&
    f.state === "attack" &&
    f.move?.special === "teleport" &&
    f.stateFrame >= f.move.startup &&
    f.stateFrame < f.move.startup + f.move.active
  );
}
export function canCancelGokuSpecial(f: Fighter) {
  return !f.move?.special && !f.move?.super && f.canCancel("special");
}
export function validAirChase(f: Fighter) {
  const o = f.opponent;
  return (
    !!o &&
    o.health > 0 &&
    o.airborne &&
    o.state === "hitstun" &&
    o.combo > 0 &&
    !o.knockedDown &&
    Math.abs(o.x - f.x) <= combatPace.airTeleport.chaseRange
  );
}
export function canStartGokuSpecial(f: Fighter, id: string) {
  const move = f.data.specialMoves?.[id];
  if (!move || !f.match) return false;
  const airAllowed = move.airTeleport === true;
  if (f.airborne && !airAllowed) return false;
  if (!f.airborne && airAllowed) return false;
  const free = [
    "idle",
    "walk",
    "crouch",
    "dash",
    "landing",
    ...(airAllowed ? ["air"] : []),
  ].includes(f.state);
  if (move.special === "teleport")
    return (
      (free || (airAllowed && f.hitConfirmed && canCancelGokuSpecial(f))) &&
      (airAllowed || f.gokuTeleportLock === 0) &&
      (!airAllowed ||
        (f.gokuAirTeleportsUsed <
          combatPace.airTeleport.maximumPerJumpOrCombo &&
          (move.gokuStrength !== "heavy" || validAirChase(f))))
    );
  if (!free && !canCancelGokuSpecial(f)) return false;
  if (
    move.projectile &&
    f.match.kiProjectiles.filter(
      (p) => p.owner === f.id && p.state === "flight",
    ).length +
      move.projectile.releases.length >
      balance.projectiles.maximumPerOwner
  )
    return false;
  return true;
}
const clamp = (x: number) => Math.max(40, Math.min(1240, x));
/** Compute a complete valid pushbox before committing the discontinuity. */
export function teleportDestination(f: Fighter) {
  const strength = f.move?.gokuStrength ?? "light",
    c = balance.teleport[strength],
    other = f.opponent!;
  if (f.move?.airTeleport) {
    const cfg = combatPace.airTeleport;
    if (strength === "heavy" && !validAirChase(f)) return;
    let x = f.x + f.facing * cfg[strength].distance;
    let y = f.y;
    if (
      strength === "medium" &&
      Math.abs(other.x - f.x) <= balance.teleport.medium.targetRange
    ) {
      x = other.x + f.facing * cfg.medium.distance;
      if (other.airborne) y = other.y;
    }
    if (strength === "heavy") {
      x = other.x - f.facing * cfg.chaseSeparation;
      y = other.y - 6;
    }
    y = Math.max(cfg.minimumY, Math.min(580 - cfg.floorClearance, y));
    x = clamp(x);
    if (Math.abs(y - other.y) < 100 && Math.abs(x - other.x) < cfg.separation) {
      let side = x < other.x ? -1 : 1;
      if (
        other.x + side * cfg.separation < 40 ||
        other.x + side * cfg.separation > 1240
      )
        side *= -1;
      x = clamp(other.x + side * cfg.separation);
    }
    return { x, y };
  }
  let x = f.x + f.facing * c.distance,
    y = f.y;
  if (strength === "medium") {
    const medium = balance.teleport.medium,
      behind = other.x + f.facing * medium.distance;
    x =
      Math.abs(other.x - f.x) <= medium.targetRange &&
      behind >= 40 &&
      behind <= 1240
        ? behind
        : f.x + f.facing * medium.fallbackDistance;
  } else if (strength === "heavy")
    y = Math.max(
      balance.teleport.minimumAirY,
      Math.min(490, f.y - balance.teleport.heavy.height),
    );
  x = clamp(x);
  if (Math.abs(y - other.y) < 90) {
    if (
      strength !== "medium" &&
      Math.sign(other.x - f.x) === f.facing &&
      (x - other.x) * f.facing > -balance.teleport.separation
    )
      x = other.x - f.facing * balance.teleport.separation;
    if (Math.abs(x - other.x) < balance.teleport.separation) {
      const side = x < other.x ? -1 : 1;
      x = other.x + side * balance.teleport.separation;
      if (x < 40 || x > 1240) x = other.x - side * balance.teleport.separation;
    }
  }
  return { x: clamp(x), y };
}
export function tickGokuMove(f: Fighter) {
  if (
    f.data.id !== "goku" ||
    f.state !== "attack" ||
    f.move?.special !== "teleport"
  )
    return;
  const move = f.move;
  if (move.airTeleport && f.stateFrame < move.startup + move.active) {
    f.vx = 0;
    f.vy = 0;
  }
  if (f.stateFrame === move.startup + move.active) {
    const destination = teleportDestination(f);
    if (!destination) return;
    f.x = destination.x;
    f.y = destination.y;
    f.vx = 0;
    f.airChaseTicks = 0;
    f.vy = move.airTeleport
      ? move.gokuStrength === "heavy"
        ? f.opponent!.vy
        : -1
      : move.gokuStrength === "heavy"
        ? -3
        : 0;
    f.facing = f.opponent!.x >= f.x ? 1 : -1;
  }
}
export function beamOrigin(f: Fighter) {
  const hand = poseAt(f.move!, f.stateFrame)?.release ?? { x: 52, y: -80 };
  return { x: f.x + hand.x * f.facing, y: f.y + hand.y };
}
