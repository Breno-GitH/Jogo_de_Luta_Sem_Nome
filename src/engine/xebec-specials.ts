import type { CommandBuffer } from "./input";
import type { AttackShape, Capsule, Move, Point, Rect } from "./types";

export const xebecCommands = {
  ki: { light: "xebecFlash", medium: "xebecFissure", heavy: "xebecRupture" },
  kamehameha: {
    light: "xebecIntimidation",
    medium: "xebecPressure",
    heavy: "xebecCollision",
  },
  teleport: {
    light: "xebecBrutal",
    medium: "xebecBreaker",
    heavy: "xebecImpact",
  },
} as const;
type Strength = keyof typeof xebecCommands.ki;
export type XebecSpecial =
  (typeof xebecCommands)[keyof typeof xebecCommands][Strength];
export const xebecCounterReply = "xebecCollisionReply";
export const xebecExtraShock = "xebecExtraShock";
export const dominationMaximum = 100;

export function xebecSpecialCommand(buffer: CommandBuffer, button: Strength) {
  const motion = buffer.gokuSpecial(button);
  return motion && xebecCommands[motion][button];
}

const cut = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
): Capsule => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, r });
const box = (x: number, y: number, w: number, h: number): Rect => ({
  x,
  y,
  w,
  h,
});
const fist = box(18, -130, 57, 30);
const slash = cut(46, -109, 128, -124, 14);
const ascending = cut(40, -82, 100, -164, 19);
const descending = cut(36, -73, 102, -3, 17);

type Cel = {
  frame: number;
  ticks: number;
  shape?: AttackShape;
  low?: boolean;
  release?: Point;
  hit?: Partial<NonNullable<Move["hitWindows"]>[number]>;
};
type Spec = {
  rank: number;
  startup: number;
  active: number;
  damage: number;
  stun: number;
  push: number;
  blockPush?: number;
  blockstun?: number;
  launch?: number;
  knockdown?: boolean;
  drive?: Move["drive"];
  hopAt?: number;
  hopVelocity?: number;
  confirmedFollow?: boolean;
  groundWindow?: number;
  whiffExtra?: number;
  cels: Cel[];
};

const specs: Record<XebecSpecial | typeof xebecCounterReply, Spec> = {
  xebecFlash: {
    rank: 1,
    startup: 8,
    active: 5,
    damage: 72,
    stun: 23,
    push: 3.2,
    drive: { from: 4, to: 11, speed: 11 },
    cels: [
      { frame: 0, ticks: 4, low: true },
      { frame: 40, ticks: 4, low: true },
      { frame: 1, ticks: 5, shape: slash },
      { frame: 2, ticks: 16 },
    ],
  },
  xebecFissure: {
    rank: 2,
    startup: 18,
    active: 5,
    damage: 79,
    stun: 23,
    push: 5,
    cels: [
      { frame: 3, ticks: 12 },
      { frame: 36, ticks: 6 },
      { frame: 4, ticks: 5, release: { x: 113, y: -103 } },
      { frame: 5, ticks: 23 },
    ],
  },
  xebecRupture: {
    rank: 3,
    startup: 17,
    active: 16,
    damage: 126,
    stun: 32,
    push: 10,
    launch: -6,
    knockdown: true,
    blockstun: 10,
    blockPush: 4,
    hopAt: 4,
    hopVelocity: -9.5,
    groundWindow: 2,
    drive: { from: 5, to: 29, speed: 4.5 },
    cels: [
      { frame: 6, ticks: 17 },
      { frame: 7, ticks: 12, shape: descending },
      {
        frame: 8,
        ticks: 4,
        low: true,
        shape: box(22, -42, 116, 42),
        hit: { damage: 48, launch: -5, push: 8 },
      },
      { frame: 8, ticks: 30, low: true },
    ],
  },
  xebecIntimidation: {
    rank: 1,
    startup: 5,
    active: 5,
    damage: 34,
    stun: 16,
    push: 13,
    blockPush: 8,
    cels: [
      { frame: 9, ticks: 5 },
      {
        frame: 10,
        ticks: 2,
        shape: cut(-36, -77, 36, -77, 32),
        hit: { id: 1 },
      },
      {
        frame: 10,
        ticks: 3,
        shape: cut(-48, -77, 48, -77, 35),
        hit: { id: 1 },
      },
      { frame: 11, ticks: 19 },
    ],
  },
  xebecPressure: {
    rank: 2,
    startup: 12,
    active: 8,
    damage: 56,
    stun: 22,
    push: 10,
    blockPush: 13,
    blockstun: 12,
    drive: { from: 7, to: 12, speed: 3.4 },
    cels: [
      { frame: 12, ticks: 12 },
      { frame: 13, ticks: 3, shape: box(38, -141, 54, 103), hit: { id: 1 } },
      { frame: 13, ticks: 5, shape: box(48, -144, 105, 108), hit: { id: 1 } },
      { frame: 14, ticks: 24 },
    ],
  },
  xebecCollision: {
    rank: 3,
    startup: 5,
    active: 10,
    damage: 0,
    stun: 0,
    push: 0,
    cels: [
      { frame: 15, ticks: 5 },
      { frame: 16, ticks: 10 },
      { frame: 37, ticks: 7 },
      { frame: 15, ticks: 26 },
    ],
  },
  xebecCollisionReply: {
    rank: 3,
    startup: 3,
    active: 7,
    damage: 106,
    stun: 37,
    push: 12,
    launch: -5,
    blockstun: 16,
    cels: [
      { frame: 16, ticks: 3 },
      { frame: 17, ticks: 7, shape: cut(17, -80, 117, -110, 31) },
      { frame: 17, ticks: 6 },
      { frame: 15, ticks: 20 },
    ],
  },
  xebecBrutal: {
    rank: 1,
    startup: 6,
    active: 4,
    damage: 62,
    stun: 23,
    push: 1.7,
    drive: { from: 2, to: 7, speed: 5.2 },
    cels: [
      { frame: 18, ticks: 4 },
      { frame: 41, ticks: 2 },
      { frame: 19, ticks: 4, shape: fist },
      { frame: 20, ticks: 14 },
    ],
  },
  xebecBreaker: {
    rank: 2,
    startup: 7,
    active: 12,
    damage: 40,
    stun: 22,
    push: 1.3,
    confirmedFollow: true,
    whiffExtra: 11,
    drive: { from: 4, to: 8, speed: 4 },
    cels: [
      { frame: 39, ticks: 7, low: true },
      { frame: 21, ticks: 3, low: true, shape: box(18, -102, 61, 30) },
      { frame: 22, ticks: 4, low: true },
      {
        frame: 23,
        ticks: 5,
        shape: ascending,
        hit: { damage: 54, stun: 41, launch: -15.2, push: 2.1 },
      },
      { frame: 38, ticks: 20, low: true },
    ],
  },
  xebecImpact: {
    rank: 3,
    startup: 11,
    active: 15,
    damage: 64,
    stun: 25,
    push: 2.1,
    blockstun: 11,
    drive: { from: 6, to: 15, speed: 7.1 },
    cels: [
      { frame: 24, ticks: 11 },
      { frame: 25, ticks: 4, shape: cut(25, -94, 80, -99, 20) },
      { frame: 38, ticks: 6, low: true },
      {
        frame: 26,
        ticks: 5,
        shape: cut(27, -60, 141, -29, 23),
        hit: { damage: 77, stun: 34, launch: -6, push: 13, knockdown: true },
      },
      { frame: 26, ticks: 34, low: true },
    ],
  },
};

export const isXebecSpecial = (name?: string): name is XebecSpecial =>
  !!name && Object.hasOwn(specs, name) && name !== xebecCounterReply;

export function makeXebecSpecials(standing: Rect[], crouching: Rect[]) {
  const moves: Record<string, Move> = {};
  const art: Record<string, { frames: number[]; durations: number[] }> = {};
  for (const [id, spec] of Object.entries(specs)) {
    const { cels, startup, active, ...stats } = spec;
    const { confirmedFollow, groundWindow, whiffExtra, ...base } = stats;
    let frame = 0;
    const hitWindows: NonNullable<Move["hitWindows"]> = [];
    const poses = cels.map((cel) => {
      const fromTick = frame;
      frame += cel.ticks;
      const phase =
        fromTick < startup
          ? "startup"
          : fromTick < startup + active
            ? "active"
            : "recovery";
      if (cel.shape)
        hitWindows.push({
          id: hitWindows.length + 1,
          fromTick,
          toTick: frame,
          ...cel.hit,
        });
      return {
        ticks: cel.ticks,
        phase,
        hurtboxes: [
          ...(cel.low ? crouching : standing),
          ...(cel.shape &&
          !("a" in cel.shape) &&
          ["xebecBrutal", "xebecBreaker", "xebecPressure"].includes(id)
            ? [{ x: 20, y: cel.shape.y + 7, w: 40, h: 19 }]
            : []),
        ],
        hitboxes: cel.shape ? [cel.shape] : [],
        release: cel.release,
      };
    });
    moves[id] = {
      ...base,
      special:
        id === xebecCounterReply ? "xebecCollision" : (id as XebecSpecial),
      startup,
      active,
      recovery: frame - startup - active,
      level: "mid",
      blockstun: base.blockstun ?? 13,
      hitstop: base.rank === 3 ? 9 : 6,
      box: box(0, 0, 0, 0),
      launch: base.launch ?? 0,
      cancels: id === "xebecBreaker" ? ["jump"] : [],
      cancelWindow:
        id === "xebecBreaker" ? { fromTick: 14, toTick: 24 } : undefined,
      poses,
      ...(hitWindows.length ? { hitWindows } : {}),
      xebec: { confirmedFollow, groundWindow, whiffExtra },
    };
    art[id] = {
      frames: cels.map((cel) => cel.frame),
      durations: cels.map((cel) => cel.ticks),
    };
  }
  moves[xebecExtraShock] = {
    ...moves.xebecRupture,
    damage: 37,
    push: 14,
    launch: -5,
    blockstun: 10,
    level: "low",
  };
  return { moves, art };
}

export const xebecProjectile = {
  xebecFissure: { speed: 21, radius: 26, life: 37 },
  [xebecExtraShock]: { speed: 15, radius: 28, life: 14 },
} as const;

export function empoweredXebecMove(id: string, move: Move): Move {
  if (id === "xebecRupture")
    return {
      ...move,
      push: 14,
      hitWindows: move.hitWindows?.map((hit) =>
        hit.id === 2 ? { ...hit, damage: 65, push: 13 } : hit,
      ),
    };
  if (id === xebecCounterReply)
    return { ...move, damage: 146, push: 18, stun: 40 };
  if (id === "xebecImpact")
    return {
      ...move,
      hitWindows: move.hitWindows?.map((hit) =>
        hit.id === 2 ? { ...hit, damage: 110, push: 19, launch: -8 } : hit,
      ),
    };
  return move;
}
