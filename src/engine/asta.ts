import { astaSpecialMoves } from "./asta-specials";
import type { CharacterData } from "./types";
import { astaSwords, type AstaSword } from "./asta-stances";
import { astaBody, astaNormals } from "./asta-normals";
export const asta: CharacterData = {
  id: "asta",
  name: "Asta",
  health: 1000,
  speed: 6.2,
  jump: -15.5,
  gravity: 0.74,
  airChaseSpeed: 10.5,
  airChaseTicks: 12,
  locomotion: {
    backSpeed: 4.1,
    airSpeed: 5.5,
    jumpStartup: 4,
    landingTicks: 7,
    dashForward: [7, 11, 17, 20, 20, 18, 15, 11, 7, 3, 0],
    backdash: [8, 11, 12, 10, 8, 6, 3, 0],
  },
  hurtboxes: astaBody,
  specialMoves: astaSpecialMoves,
  combatLimits: { maxHits: 14, maxAirHits: 6, maxTicks: 245 },
  lifecycle: {
    entranceDistance: 36,
    entranceWalkTicks: 18,
    entranceSpeed: 2,
    tauntTicks: 36,
    getupTicks: 18,
    koTicks: 48,
  },
  reactionClips: {
    guardStand: "guard",
    guardImpactStand: "guard",
    guardCrouch: "guardLow",
    guardImpactCrouch: "guardLow",
    damageLight: "hitHigh",
    damageMedium: "hitHigh",
    damageHeavy: "hitHigh",
    damageCrouch: "hitLow",
    damageAir: "hitAir",
    falling: "hitAir",
  },
  moves: {
    ...astaNormals.slayer,
    throw: {
      kind: "grab",
      level: "throw",
      startup: 7,
      active: 3,
      recovery: 20,
      damage: 0,
      stun: 0,
      blockstun: 0,
      push: 0,
      launch: 0,
      rank: 2,
      box: { x: 19, y: -112, w: 39, h: 67 },
      cancels: [],
    },
  },
  grabSequence: {
    startFromContact: true,
    duration: 28,
    hitTick: 19,
    damage: 90,
    recoveryTicks: 17,
    victimTrack: [
      { tick: 0, x: 42, y: 0, clip: "grabbed" },
      { tick: 10, x: 34, y: -23, clip: "grabbed" },
      { tick: 19, x: 59, y: -38, clip: "launched" },
      { tick: 28, x: 92, y: -15, clip: "launched" },
    ],
    release: { vx: 9, vy: -6, stun: 23 },
  },
};
export const astaMoves = Object.fromEntries(
  astaSwords.map((sword) => [
    sword,
    { ...astaNormals[sword], throw: asta.moves.throw },
  ]),
) as unknown as Record<AstaSword, CharacterData["moves"]>;
