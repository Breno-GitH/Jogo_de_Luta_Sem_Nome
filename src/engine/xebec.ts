import { combatPace } from "./pace";
import type { AttackShape, CharacterData, Move } from "./types";
import { pandemoniumId, pandemoniumMove } from "./xebec-pandemonium";
import { makeXebecSpecials, xebecRiposte } from "./xebec-specials";

export const xebecId = "xebec";

const body: NonNullable<CharacterData["hurtboxes"]> = {
  standing: [
    { x: -12, y: -154, w: 29, h: 32 },
    { x: -29, y: -125, w: 58, h: 56 },
    { x: -28, y: -70, w: 58, h: 70 },
  ],
  crouching: [
    { x: -11, y: -106, w: 30, h: 29 },
    { x: -32, y: -78, w: 66, h: 47 },
    { x: -34, y: -38, w: 68, h: 38 },
  ],
  air: [
    { x: -14, y: -138, w: 31, h: 31 },
    { x: -30, y: -108, w: 59, h: 62 },
    { x: -31, y: -48, w: 68, h: 44 },
  ],
};

type Stance = "stand" | "crouch" | "air";
type NormalId = `${Stance}_${"light" | "medium" | "heavy"}`;
type Normal = {
  frames: [number, number, number, number];
  holds: [number, number, number, number];
  contact: AttackShape;
  damage: number;
  stun: number;
  launch?: number;
  knockdown?: boolean;
  airHold?: number;
};
const blade = (ax: number, ay: number, bx: number, by: number, r = 10) => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  r,
});

// Windup, contact, withdrawal and settle. Only the contact cel can hit.
export const xebecNormals: Record<NormalId, Normal> = {
  stand_light: {
    frames: [1, 0, 1, 17],
    holds: [5, 3, 4, 6],
    contact: { x: 22, y: -127, w: 46, h: 28 },
    damage: 39,
    stun: 23,
  },
  stand_medium: {
    frames: [3, 2, 16, 17],
    holds: [8, 4, 5, 8],
    contact: { x: 20, y: -124, w: 68, h: 30 },
    damage: 61,
    stun: 28,
  },
  stand_heavy: {
    frames: [4, 5, 4, 4],
    holds: [11, 5, 7, 12],
    contact: blade(45, -120, 125, -119, 13),
    damage: 92,
    stun: 28,
  },
  crouch_light: {
    frames: [6, 7, 6, 6],
    holds: [5, 3, 4, 6],
    contact: { x: 20, y: -97, w: 64, h: 25 },
    damage: 35,
    stun: 22,
  },
  crouch_medium: {
    frames: [8, 9, 8, 8],
    holds: [8, 4, 6, 9],
    contact: { x: 22, y: -32, w: 66, h: 29 },
    damage: 57,
    stun: 28,
  },
  crouch_heavy: {
    frames: [10, 11, 10, 10],
    holds: [10, 5, 7, 11],
    contact: blade(14, -89, 77, -153, 13),
    damage: 76,
    stun: 34,
    launch: -16,
  },
  air_light: {
    frames: [18, 19, 12, 21],
    holds: [4, 3, 4, 5],
    contact: { x: 20, y: -122, w: 49, h: 24 },
    damage: 36,
    stun: 22,
    launch: -4.2,
    airHold: -3.4,
  },
  air_medium: {
    frames: [20, 13, 21, 21],
    holds: [6, 4, 5, 7],
    contact: { x: 26, y: -88, w: 58, h: 29 },
    damage: 55,
    stun: 25,
    launch: -4,
    airHold: -3.1,
  },
  air_heavy: {
    frames: [14, 15, 14, 14],
    holds: [9, 5, 6, 10],
    contact: blade(36, -65, 79, -17),
    damage: 84,
    stun: 28,
    launch: 7,
    knockdown: true,
  },
};

const moves: Record<string, Move> = Object.fromEntries(
  Object.entries(xebecNormals).map(([id, normal]) => {
    const [stance, strength] = id.split("_");
    const rank = strength === "light" ? 1 : strength === "medium" ? 2 : 3;
    const next = rank === 1 ? "medium" : rank === 2 ? "heavy" : undefined;
    const [startup, active, withdraw, settle] = normal.holds;
    const hurtboxes =
      stance === "air"
        ? body.air
        : stance === "crouch"
          ? body.crouching
          : body.standing;
    const phases = ["startup", "active", "recovery", "recovery"];
    return [
      id,
      {
        startup,
        active,
        recovery: withdraw + settle,
        rank,
        damage: normal.damage,
        stun: normal.stun,
        blockstun: [10, 13, 16][rank - 1],
        push: id === "crouch_heavy" ? 2.3 : [1.1, 1.7, 3.6][rank - 1],
        hitstop: [4, 6, 8][rank - 1],
        launch: normal.launch ?? 0,
        knockdown: normal.knockdown,
        airHold: normal.airHold,
        level:
          stance === "air"
            ? "high"
            : stance === "crouch" && rank < 3
              ? "low"
              : "mid",
        kind: "strike",
        box: { x: 0, y: 0, w: 0, h: 0 },
        cancels: [
          ...(next ? [next] : id === "crouch_heavy" ? ["jump"] : []),
          ...(id === "air_light" ? ["heavy"] : []),
          ...(stance !== "air" && rank >= 2 ? ["special"] : []),
        ],
        cancelMoves: next ? [`${stance}_${next}`, ...(id === "air_light" ? ["air_heavy"] : [])] : [],
        cancelWindow: {
          fromTick: startup,
          toTick: startup + active + (id === "crouch_heavy" ? 9 : 6),
        },
        poses: normal.holds.map((ticks, index) => ({
          ticks,
          phase: phases[index],
          hurtboxes,
          hitboxes: index === 1 ? [normal.contact] : [],
        })),
      } satisfies Move,
    ];
  }),
);

export const xebecSpecials = makeXebecSpecials(body.standing, body.crouching);

export const xebec: CharacterData = {
  id: xebecId,
  name: "Rocks D. Xebec",
  health: 1000,
  speed: 4.8,
  jump: -16.5,
  gravity: 0.72,
  locomotion: {
    backSpeed: 3.8,
    airSpeed: 4.5,
    jumpStartup: 5,
    landingTicks: 7,
    dashForward: [6, 9, 13, 15, 15, 14, 13, 12, 10, 8, 6, 4, 2],
    backdash: [5, 8, 11, 13, 13, 12, 11, 10, 8, 7, 5, 3, 2],
  },
  hurtboxes: body,
  combatLimits: combatPace.combo,
  lifecycle: { entranceDistance: 48, entranceWalkTicks: 20, entranceSpeed: 2.5,
    tauntTicks: 46, getupTicks: 16, koTicks: 55 },
  reactionClips: {
    guardStand: "guardHigh", guardImpactStand: "guardHigh",
    guardCrouch: "guardLow", guardImpactCrouch: "guardLow",
    damageLight: "hitHigh", damageMedium: "hitHigh", damageHeavy: "hitHigh",
    damageCrouch: "hitLow", damageAir: "hitAir", falling: "hitAir",
  },
  moves: {
    ...moves,
    [xebecRiposte]: xebecSpecials.riposte,
    throw: {
      kind: "grab", level: "throw", startup: 8, active: 4, recovery: 24,
      rank: 2, damage: 0, stun: 0, blockstun: 0, push: 0, launch: 0,
      box: { x: 21, y: -121, w: 50, h: 70 }, cancels: [],
    },
  },
  grabSequence: {
    startFromContact: true, duration: 34, hitTick: 24, damage: 106, recoveryTicks: 18,
    victimTrack: [
      { tick: 0, x: 65, y: 0, clip: "grabbed" },
      { tick: 8, x: 58, y: -9, clip: "grabbed" },
      { tick: 17, x: 51, y: -29, clip: "grabbed" },
      { tick: 24, x: 86, y: -22, clip: "launched" },
      { tick: 34, x: 130, y: -17, clip: "launched" },
    ],
    release: { vx: 12, vy: -6, stun: 23 },
  },
  specialMoves: xebecSpecials.moves,
  superMoves: { [pandemoniumId]: pandemoniumMove },
};
