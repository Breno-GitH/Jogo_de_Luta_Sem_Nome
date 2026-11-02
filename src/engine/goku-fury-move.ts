import config from "../data/goku-fury.json";
import type { Move } from "./types";
import poses from "../data/goku-fury-poses.json";
/** Startup and a real finite-range strike remain ordinary, interruptible combat.
 * Only resolveImpact can promote an unblocked hit into the cinematic. */
export const furyMove: Move = {
  super: true,
  kind: "gokuFury",
  startup: config.startup,
  active: config.active,
  recovery: config.recovery,
  cost: config.cost,
  damage: config.initialDamage,
  stun: 28,
  blockstun: 18,
  hitstop: 9,
  push: 0,
  launch: 0,
  level: "mid",
  rank: 5,
  cancels: [],
  meterGain: 0,
  drive: config.dash,
  box: { x: 55, y: -90, w: 25, h: 22 },
  poses: poses.poses,
};
