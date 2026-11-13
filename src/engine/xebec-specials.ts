import type { CommandBuffer } from "./input";
import type { AttackShape, Move, Rect } from "./types";

const commands = {
  ki: { light: "xebecLightning", medium: "xebecRift", heavy: "xebecRupture" },
  kamehameha: { light: "xebecIntimidation", medium: "xebecPressure", heavy: "xebecCollision" },
  teleport: { light: "xebecBrutal", medium: "xebecBreaker", heavy: "xebecConqueror" },
} as const;

type Strength = keyof typeof commands.ki;
export type XebecSpecial = (typeof commands)[keyof typeof commands][Strength];
const specialIds = new Set<string>(Object.values(commands).flatMap(Object.values));
export const isXebecSpecial = (id?: string): id is XebecSpecial => !!id && specialIds.has(id);
export const xebecCharged = (id: string) =>
  id === "xebecRupture" || id === "xebecCollision" || id === "xebecConqueror";

export function xebecSpecialCommand(buffer: CommandBuffer, button: Strength) {
  const motion = buffer.gokuSpecial(button);
  return motion && commands[motion][button];
}

export const xebecProjectiles = {
  xebecRift: { x: 75, y: -120, speed: 21, radius: 25, life: 36 },
  xebecAftershock: { x: 88, y: -45, speed: 16, radius: 22, life: 18 },
} as const;

export const xebecProjectile = (id: string) =>
  Object.hasOwn(xebecProjectiles, id) ? xebecProjectiles[id as keyof typeof xebecProjectiles] : undefined;
export const xebecRiposte = "xebecRiposte";

const box = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const blade = (ax: number, ay: number, bx: number, by: number, r: number): AttackShape =>
  ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, r });
const fist = box(23, -128, 62, 38);
const horizontal = blade(35, -113, 113, -104, 11);
const descending = blade(32, -136, 91, -34, 14);
const rising = blade(25, -67, 85, -148, 13);

export function makeXebecSpecials(standing: Rect[], crouching: Rect[]) {
  function move(
    rank: number, startup: number, active: number, recovery: number,
    damage: number, contact: AttackShape | undefined, overrides: Partial<Move> = {},
    second?: { after: number; ticks: number; shape: AttackShape },
  ): Move {
    const phases = [
      { ticks: startup, phase: "startup", hurtboxes: standing, hitboxes: [] },
      { ticks: second ? second.after : active, phase: "active", hurtboxes: standing,
        hitboxes: contact ? [contact] : [] },
      ...(second ? [
        { ticks: second.ticks, phase: "active", hurtboxes: standing, hitboxes: [second.shape] },
      ] : []),
      { ticks: recovery, phase: "recovery", hurtboxes: standing, hitboxes: [] },
    ];
    return {
      startup, active, recovery, rank, damage, box: box(0, 0, 0, 0), level: "mid",
      stun: 22, blockstun: 12, push: 3, launch: 0, hitstop: 5, cancels: [],
      poses: phases, ...overrides,
    };
  }

  const moves: Record<XebecSpecial, Move> = {
    xebecLightning: move(1, 8, 5, 14, 62, horizontal, {
      drive: { from: 3, to: 11, speed: 10.5 }, stun: 24, push: 2.5,
    }),
    xebecRift: move(2, 16, 4, 24, 72, undefined, {
      push: 6, stun: 25, blockstun: 15, hitstop: 7,
    }),
    xebecRupture: move(3, 19, 7, 33, 119, descending, {
      drive: { from: 4, to: 22, speed: 4.4 }, hopAt: 5, hopVelocity: -6.2,
      stun: 33, launch: -5, push: 10, knockdown: true, hitstop: 9,
    }),
    xebecIntimidation: move(1, 6, 4, 20, 28, box(-54, -127, 137, 106), {
      push: 8, stun: 18, blockstun: 9,
    }),
    xebecPressure: move(2, 12, 5, 23, 58, box(37, -132, 115, 82), {
      drive: { from: 5, to: 11, speed: 2.8 }, push: 9, stun: 23, blockstun: 15, hitstop: 6,
    }),
    xebecCollision: move(3, 4, 8, 29, 0, undefined),
    xebecBrutal: move(1, 7, 4, 15, 51, fist, {
      drive: { from: 2, to: 10, speed: 7.8 }, push: 1.5, stun: 25,
    }),
    xebecBreaker: move(2, 10, 15, 23, 39, fist, {
      drive: { from: 3, to: 11, speed: 5.4 }, stun: 24, push: 1.1,
      hitWindows: [
        { id: 0, fromTick: 10, toTick: 14 },
        { id: 1, fromTick: 20, toTick: 25, damage: 57, launch: -15, stun: 36, push: 1.7 },
      ],
      cancels: ["jump"], cancelWindow: { fromTick: 20, toTick: 31 },
    }, { after: 10, ticks: 5, shape: rising }),
    xebecConqueror: move(3, 13, 16, 32, 56, box(21, -132, 71, 57), {
      drive: { from: 6, to: 14, speed: 6.3 }, stun: 27, push: 1.5,
      hitstop: 8,
      hitWindows: [
        { id: 0, fromTick: 13, toTick: 17 },
        { id: 1, fromTick: 23, toTick: 29, damage: 82, launch: -7, stun: 34, push: 12, knockdown: true },
      ],
    }, { after: 10, ticks: 6, shape: horizontal }),
  };
  for (const id of Object.keys(moves) as XebecSpecial[]) moves[id].special = id;
  // A low launch prep exposes the landing, while the aerial swing extends the torso.
  moves.xebecRupture.poses![0].hurtboxes = crouching;

  const riposte = move(3, 1, 5, 23, 82, rising, {
    launch: -10, stun: 33, push: 4, hitstop: 9, cancels: ["special"],
    cancelWindow: { fromTick: 3, toTick: 15 },
  });
  riposte.poses![1].hitboxes = [blade(20, -91, 90, -144, 16)];
  const conqueror = moves.xebecConqueror;
  const powered: Partial<Record<string, Move>> = {
    xebecRupture: { ...moves.xebecRupture, damage: 135, push: 13, hitstop: 11 },
    xebecRiposte: { ...riposte, damage: 110, launch: -13, push: 7, hitstop: 12 },
    xebecConqueror: {
      ...conqueror, hitstop: 10,
      hitWindows: [conqueror.hitWindows![0], { ...conqueror.hitWindows![1], damage: 110, push: 16 }],
    },
  };
  return {
    moves,
    powered,
    riposte,
    aftershock: move(3, 0, 1, 0, 31, undefined, { push: 8, stun: 22, hitstop: 5 }),
  };
}
