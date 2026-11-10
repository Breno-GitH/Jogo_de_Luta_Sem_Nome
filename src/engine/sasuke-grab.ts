import boxes from "../data/sasuke-throw-boxes.json";
import type { CharacterData, Move } from "./types";

const damage = 105;
const startup = 7;
const active = 4;
const recovery = 19;

export const sasukeThrowClips = {
  throw: { frames: [0, 1, 5], holds: [startup, active, recovery] },
  grabHold: { frames: [1, 2, 3, 4], holds: [4, 6, 4, 8] },
  throwRecover: { frames: [4, 5], holds: [3, 11] },
};

export const sasukeThrow: Move = {
  kind: "grab", level: "throw", startup, active, recovery, damage,
  stun: 36, blockstun: 0, push: 0, launch: 0, rank: 0, cancels: [],
  box: boxes.base,
};
export const sasukeCurseThrow: Move = { ...sasukeThrow, box: boxes.curse };

export const sasukeGrab: NonNullable<CharacterData["grabSequence"]> = {
  startFromContact: true,
  duration: 22,
  hitTick: 14,
  damage,
  recoveryTicks: 14,
  victimTrack: [
    { tick: 0, x: 74, y: 0, clip: "grabbed" },
    { tick: 4, x: 65, y: -3, clip: "grabbed" },
    { tick: 9, x: 61, y: -11, clip: "grabbed" },
    { tick: 13, x: 76, y: -24, clip: "grabbed" },
    { tick: 14, x: 88, y: -25, clip: "damageAir" },
    { tick: 21, x: 135, y: -13, clip: "falling" },
  ],
  release: { vx: 7.5, vy: -2, stun: 36 },
};

