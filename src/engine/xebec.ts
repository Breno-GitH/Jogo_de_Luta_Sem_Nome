import type { AttackShape, CharacterData, Move } from "./types";

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
    frames: [3, 6, 3, 0],
    holds: [5, 3, 4, 6],
    contact: { x: 20, y: -137, w: 54, h: 25 },
    damage: 39,
    stun: 23,
  },
  stand_medium: {
    frames: [4, 7, 4, 0],
    holds: [8, 4, 5, 8],
    contact: { x: 20, y: -124, w: 68, h: 30 },
    damage: 61,
    stun: 28,
  },
  stand_heavy: {
    frames: [5, 8, 5, 0],
    holds: [11, 5, 7, 12],
    contact: blade(45, -120, 125, -119, 13),
    damage: 92,
    stun: 28,
  },
  crouch_light: {
    frames: [9, 12, 9, 9],
    holds: [5, 3, 4, 6],
    contact: { x: 20, y: -97, w: 64, h: 25 },
    damage: 35,
    stun: 22,
  },
  crouch_medium: {
    frames: [10, 13, 10, 9],
    holds: [8, 4, 6, 9],
    contact: { x: 22, y: -32, w: 66, h: 29 },
    damage: 57,
    stun: 28,
  },
  crouch_heavy: {
    frames: [11, 14, 11, 9],
    holds: [10, 5, 7, 11],
    contact: blade(38, -104, 87, -162),
    damage: 76,
    stun: 34,
    launch: -16,
  },
  air_light: {
    frames: [15, 18, 15, 15],
    holds: [4, 3, 4, 5],
    contact: { x: 20, y: -122, w: 49, h: 24 },
    damage: 36,
    stun: 22,
    launch: -4.2,
    airHold: -3.4,
  },
  air_medium: {
    frames: [16, 19, 16, 15],
    holds: [6, 4, 5, 7],
    contact: { x: 22, y: -80, w: 54, h: 34 },
    damage: 55,
    stun: 25,
    launch: -4,
    airHold: -3.1,
  },
  air_heavy: {
    frames: [17, 20, 17, 15],
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
        cancels: next ? [next] : id === "crouch_heavy" ? ["jump"] : [],
        cancelMoves: next ? [`${stance}_${next}`] : [],
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
  moves,
};
