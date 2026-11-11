import type { Fighter } from "./combat";
import type { InputFrame, Move } from "./types";

export const nrgFlightBudget = 102;
const maxHeight = 219;
const floor = 580;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function benManeuverTarget(f: Fighter, rival: Fighter, move: Move) {
  const leap = move.ben?.leap, burrow = move.ben?.burrow;
  const reach = leap?.reach ?? burrow?.reach ?? 0;
  const goal = rival.x - f.facing * (burrow ? 49 : 18);
  return clamp(clamp(goal, f.x - reach, f.x + reach), f.stageInset, 1280 - f.stageInset);
}

export function driveBenManeuver(f: Fighter, opponent: Fighter, move: Move) {
  const watch = f.omnitrix!;
  const leap = move.ben?.leap, burrow = move.ben?.burrow;
  const destination = watch.maneuverX ?? f.x;
  const age = f.stateFrame;
  if (leap) {
    if (age === leap.takeoff) f.vy = -leap.speed / Math.sqrt(f.benScale);
    if (f.airborne && !watch.landingStrike) {
      const speed = leap.reach > 200 ? 10.3 : 7.2;
      f.vx = clamp(destination - f.x, -speed, speed);
      if (f.vy > 1) f.vy += .7 + (f.benScale - 1);
    } else f.vx = 0;
  }
  if (burrow) {
    f.vx = age >= burrow.from && age < burrow.to ? clamp(destination - f.x, -15.5, 15.5) : 0;
    if (age === burrow.to && opponent.x !== f.x) f.facing = opponent.x > f.x ? 1 : -1;
  }
}

export function benGhostDepth(f: Fighter) {
  if (f.state !== "attack") return 0;
  const move = f.move;
  if (!move) return 0;
  const track = move.ben?.burrow ?? (move.ben?.nightmare ? move.ben.phase : undefined);
  if (!track) return 0;
  const t = Math.min((f.stateFrame - track.from + 4) / 4, (track.to + 4 - f.stateFrame) / 4);
  return Math.round(162 * clamp(t, 0, 1));
}

export function flyNrg(f: Fighter, input: InputFrame) {
  const watch = f.omnitrix;
  if (!watch?.nrgReleased) return;
  const move = f.state === "attack" ? f.move : undefined;
  if (move?.ben?.nrgMode === "seal") {
    watch.flightTicks = 0;
    if (f.airborne) {
      f.vy = Math.max(5, f.vy);
      f.stateFrame = Math.min(f.stateFrame, move.startup);
    }
    f.vx = 0;
    return;
  }
  if (!watch.nrgTicks || !["air", "attack"].includes(f.state)) {
    watch.flightTicks = 0;
    return;
  }
  const thrust = move?.ben?.lift && f.stateFrame === move.startup;
  if (thrust && (watch.flightTicks || !watch.flightUsed)) {
    f.vy = -8.5;
    watch.flightVY = -5.6;
  }
  if (!watch.flightUsed && (thrust || (f.airborne && input.up && f.state === "air"))) {
    watch.flightUsed = true;
    watch.flightTicks = nrgFlightBudget;
  }
  if (!watch.flightTicks || !f.airborne) return;
  watch.flightTicks--;
  const kick = move?.ben?.lift && f.stateFrame < move.startup + move.active;
  const horizontal = (kick ? (input.direction || f.facing) * 10.8 : input.direction * 6.4);
  const vertical = input.up ? -5.4 : input.down ? 5.1 : kick ? -3.2 : 0;
  watch.flightVX = input.direction || kick ? (watch.flightVX ?? 0) * .62 + horizontal * .38 : 0;
  watch.flightVY = input.up || input.down || kick ? (watch.flightVY ?? 0) * .56 + vertical * .44 : 0;
  f.vx = watch.flightVX;
  f.vy = Math.max(floor - maxHeight - f.y, watch.flightVY) - f.movementData.gravity;
}

