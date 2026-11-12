import { alienXSuper, benId } from "./ben-omnitrix";
import type { CharacterData, Move } from "./types";
import { alienXId, alienXMove } from "./ben-alien-x";

const jab: Move = {
  startup: 5, active: 3, recovery: 9, damage: 24, stun: 13, blockstun: 8,
  push: 3, launch: 0, level: "mid", rank: 1, cancels: ["medium"],
  hitstop: 3, box: { x: 17, y: -106, w: 30, h: 20 },
};
const kick: Move = {
  startup: 9, active: 4, recovery: 17, damage: 43, stun: 19, blockstun: 11,
  push: 5, launch: 0, level: "mid", rank: 2, cancels: [],
  hitstop: 5, box: { x: 21, y: -82, w: 42, h: 25 },
};

const crouchJab: Move = {
  ...jab, damage: 20, level: "low", box: { x: 15, y: -62, w: 35, h: 24 },
};
const sweep: Move = {
  ...kick, startup: 10, recovery: 20, level: "low", damage: 37,
  box: { x: 12, y: -32, w: 61, h: 24 },
};
const airJab: Move = {
  ...jab, level: "high", damage: 23, box: { x: 15, y: -88, w: 43, h: 32 }, airHold: 1,
};
const airKick: Move = {
  ...kick, startup: 7, level: "high", damage: 40, box: { x: 12, y: -67, w: 61, h: 49 },
};
const grapple: Move = {
  startup: 8, active: 3, recovery: 21, damage: 0, stun: 0, blockstun: 0,
  push: 0, launch: 0, level: "throw", kind: "grab", rank: 3, cancels: [],
  box: { x: 14, y: -104, w: 43, h: 52 },
};

export const ben: CharacterData = {
  id: benId, name: "Ben Tennyson", health: 1000, speed: 4.9, jump: -13, gravity: .65,
  meterMaximum: alienXSuper.cost,
  combatLimits: { maxHits: 9, maxAirHits: 4, maxTicks: 180 },
  moves: {
    stand_light: jab, stand_medium: kick, crouch_light: crouchJab, crouch_medium: sweep,
    air_light: airJab, air_medium: airKick, throw: grapple,
  },
  superMoves: { [alienXId]: alienXMove },
  grabSequence: {
    startFromContact: true, duration: 26, hitTick: 17, damage: 64, recoveryTicks: 14,
    victimTrack: [
      { tick: 0, x: 53, y: 0, clip: "grabbed" },
      { tick: 9, x: 49, y: -8, clip: "grabbed" },
      { tick: 17, x: 66, y: -11, clip: "damageAir" },
      { tick: 26, x: 94, y: -5, clip: "damageAir" },
    ],
    release: { vx: 8, vy: -5, stun: 29 },
  },
  lifecycle: { entranceDistance: 42, entranceWalkTicks: 18, entranceSpeed: 2.35,
    tauntTicks: 44, getupTicks: 15, koTicks: 35 },
  hurtboxes: {
    standing: [{ x: -19, y: -127, w: 45, h: 74 }, { x: -26, y: -55, w: 53, h: 53 }],
    crouching: [{ x: -25, y: -86, w: 52, h: 86 }],
    air: [{ x: -24, y: -124, w: 48, h: 115 }],
  },
};

