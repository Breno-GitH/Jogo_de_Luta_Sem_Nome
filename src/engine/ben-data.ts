import { alienXSuper, benId } from "./ben-omnitrix";
import type { CharacterData, Move } from "./types";

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

export const ben: CharacterData = {
  id: benId, name: "Ben Tennyson", health: 1000, speed: 4.9, jump: -13, gravity: .65,
  meterMaximum: alienXSuper.cost,
  combatLimits: { maxHits: 9, maxAirHits: 4, maxTicks: 180 },
  moves: { stand_light: jab, stand_medium: kick },
  hurtboxes: {
    standing: [{ x: -19, y: -127, w: 45, h: 74 }, { x: -26, y: -55, w: 53, h: 53 }],
    crouching: [{ x: -25, y: -86, w: 52, h: 86 }],
    air: [{ x: -24, y: -124, w: 48, h: 115 }],
  },
};

