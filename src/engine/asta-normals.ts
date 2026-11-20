import type { Capsule, Move } from "./types";
import sockets from "../data/asta-sockets.json";
import { astaSwords, type AstaSword } from "./asta-stances";
export const astaNormalIds = [
  "stand_light",
  "stand_medium",
  "stand_heavy",
  "crouch_light",
  "crouch_medium",
  "crouch_heavy",
  "air_light",
  "air_medium",
  "air_heavy",
] as const;
export type AstaNormalId = (typeof astaNormalIds)[number];
export const astaBody = {
  standing: [
    { x: -21, y: -136, w: 42, h: 78 },
    { x: -24, y: -58, w: 48, h: 58 },
  ],
  crouching: [{ x: -25, y: -110, w: 51, h: 110 }],
  air: [{ x: -23, y: -130, w: 47, h: 108 }],
};
export const swordReach: Record<AstaSword, number> = {
  slayer: 112,
  slasher: 80,
  dweller: 91,
  destroyer: 83,
};
export type Grip = { x: number; y: number; angle: number };
/** Authored right-hand sockets, relative to the common ground pivot, in source pixels.
 * Each entry corresponds to a body cel in the short action atlas. */
export const astaGrips = sockets as Record<AstaNormalId, Grip[]>;
export function astaBlade(sword: AstaSword, grip: Grip): Capsule {
  const a = (grip.angle * Math.PI) / 180,
    len = swordReach[sword];
  const point = (d: number) => ({
    x: grip.x + Math.cos(a) * d,
    y: grip.y + Math.sin(a) * d,
  });
  return {
    a: point(12),
    b: point(len),
    r: sword === "slayer" ? 9 : sword === "slasher" ? 4 : 6,
  };
}
const tuning = {
  slayer: {
    start: [6, 9, 13],
    recovery: [11, 16, 22],
    damage: [38, 62, 89],
    stun: [23, 27, 30],
    push: [1.2, 2.2, 4.2],
  },
  slasher: {
    start: [3, 5, 8],
    recovery: [7, 10, 15],
    damage: [25, 41, 61],
    stun: [18, 22, 25],
    push: [0.8, 1.2, 2.3],
  },
  dweller: {
    start: [5, 7, 10],
    recovery: [9, 13, 18],
    damage: [32, 51, 74],
    stun: [22, 26, 29],
    push: [1, 1.7, 3],
  },
  destroyer: {
    start: [4, 7, 11],
    recovery: [10, 15, 21],
    damage: [30, 53, 78],
    stun: [22, 26, 28],
    push: [1.3, 2, 3.4],
  },
} as const;
export function normalHolds(sword: AstaSword, id: AstaNormalId) {
  const rank = id.endsWith("light") ? 0 : id.endsWith("medium") ? 1 : 2,
    t = tuning[sword];
  const start = t.start[rank],
    active = rank === 0 ? 3 : rank === 1 ? 4 : 6,
    recovery = t.recovery[rank];
  return [
    Math.max(1, Math.floor(start * 0.5)),
    Math.ceil(start * 0.5),
    Math.ceil(active / 2),
    Math.floor(active / 2),
    Math.floor(recovery * 0.45),
    Math.ceil(recovery * 0.55),
  ];
}
export const astaNormals: Record<
  AstaSword,
  Record<string, Move>
> = Object.fromEntries(
  astaSwords.map((sword) => [
    sword,
    Object.fromEntries(
      astaNormalIds.map((id) => {
        const r = id.endsWith("light") ? 0 : id.endsWith("medium") ? 1 : 2,
          air = id.startsWith("air"),
          crouch = id.startsWith("crouch");
        const h = normalHolds(sword, id),
          startup = h[0] + h[1],
          active = h[2] + h[3],
          recovery = h[4] + h[5];
        const launch =
          id === "crouch_heavy"
            ? -14.5
            : air && r < 2
              ? -3.2
              : air && r === 2
                ? 7
                : 0;
        const next =
          r === 0
            ? ["stand_medium", "crouch_medium", "air_medium"]
            : r === 1
              ? ["stand_heavy", "crouch_heavy", "air_heavy"]
              : [];
        const hurtboxes = air
          ? astaBody.air
          : crouch
            ? astaBody.crouching
            : astaBody.standing;
        return [
          id,
          {
            startup,
            active,
            recovery,
            rank: r + 1,
            damage: tuning[sword].damage[r] - (crouch ? 2 : 0),
            stun: tuning[sword].stun[r] + (id === "crouch_heavy" ? 8 : 0),
            blockstun: [8, 11, 14][r],
            push: tuning[sword].push[r],
            launch,
            airHold: air && r < 2 ? -3.2 : undefined,
            knockdown: id === "air_heavy",
            level: air ? "high" : crouch && r < 2 ? "low" : "mid",
            kind: "strike",
            hitstop: [3, 5, 7][r],
            box: { x: 0, y: 0, w: 0, h: 0 },
            cancels: [
              ...(r === 0 ? ["medium"] : r === 1 ? ["heavy"] : []),
              ...(id === "crouch_heavy" ? ["jump"] : []),
            ],
            cancelMoves: next,
            cancelWindow: { fromTick: startup, toTick: startup + active + 4 },
            drive:
              sword === "slasher" && id === "stand_heavy"
                ? { from: startup - 2, to: startup + active, speed: 3.5 }
                : undefined,
            poses: h.map((ticks, i) => ({
              ticks,
              phase: i < 2 ? "startup" : i < 4 ? "active" : "recovery",
              hurtboxes,
              hitboxes:
                i === 2 || i === 3 ? [astaBlade(sword, astaGrips[id][i])] : [],
            })),
          } satisfies Move,
        ];
      }),
    ),
  ]),
) as Record<AstaSword, Record<string, Move>>;
