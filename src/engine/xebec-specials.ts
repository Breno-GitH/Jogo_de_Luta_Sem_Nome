import type { CommandBuffer } from "./input";
import type { Capsule, Move, Point, Rect } from "./types";

export type XebecSpecial = "xebecRush" | "xebecRising" | "xebecWave";
type Strength = "light" | "medium" | "heavy";
const strengths = ["light", "medium", "heavy"] as const;
const motions = {
  ki: "xebecRush",
  kamehameha: "xebecRising",
  teleport: "xebecWave",
} as const;

export function xebecSpecialCommand(buffer: CommandBuffer, button: Strength) {
  const motion = buffer.gokuSpecial(button);
  return motion && `${motions[motion]}_${button}`;
}

export const isXebecSpecial = (name?: string): name is XebecSpecial =>
  name === "xebecRush" || name === "xebecRising" || name === "xebecWave";

const cut = (a: Point, b: Point, r: number): Capsule => ({ a, b, r });
const straight = { x: 45, y: -120 };
const tip = { x: 125, y: -119 };
const waveOrigin = { x: 102, y: -118 };

export const xebecWaveSizes = [
  { speed: 17, radius: 17, life: 24 },
  { speed: 20, radius: 21, life: 30 },
  { speed: 23, radius: 26, life: 36 },
] as const;

const techniques = {
  xebecRush: {
    frames: [5, 8, 5, 0],
    startup: [9, 11, 14],
    active: [5, 6, 7],
    recovery: [16, 20, 25],
    damage: [74, 94, 114],
    shape: cut(straight, tip, 15),
  },
  xebecRising: {
    frames: [11, 14, 11, 9],
    startup: [6, 8, 11],
    active: [4, 5, 6],
    recovery: [20, 25, 31],
    damage: [69, 87, 105],
    shape: cut({ x: 36, y: -85 }, { x: 88, y: -163 }, 20),
  },
  xebecWave: {
    frames: [5, 8, 8, 0],
    startup: [14, 18, 23],
    active: [3, 4, 5],
    recovery: [18, 22, 27],
    damage: [61, 78, 99],
  },
} satisfies Record<
  XebecSpecial,
  {
    frames: number[];
    startup: number[];
    active: number[];
    recovery: number[];
    damage: number[];
    shape?: Capsule;
  }
>;

export function makeXebecSpecials(standing: Rect[], crouching: Rect[]) {
  const moves: Record<string, Move> = {};
  const art: Record<string, { frames: number[]; durations: number[] }> = {};
  for (const [name, spec] of Object.entries(techniques)) {
    const special = name as XebecSpecial;
    for (const [i, strength] of strengths.entries()) {
      const id = `${special}_${strength}`;
      const startup = spec.startup[i];
      const active = spec.active[i];
      const recovery = spec.recovery[i];
      const retraction = Math.ceil(recovery * 0.4);
      const durations = [startup, active, retraction, recovery - retraction];
      const rising = special === "xebecRising";
      const rush = special === "xebecRush";
      const launch = rising ? [-11, -13, -15][i] : rush && i === 2 ? -7 : 0;
      const release = special === "xebecWave" ? waveOrigin : undefined;
      const shape = "shape" in spec ? spec.shape : undefined;
      art[id] = { frames: spec.frames, durations };
      moves[id] = {
        special,
        startup,
        active,
        recovery,
        damage: spec.damage[i],
        stun: rising ? 31 + i * 2 : 21 + i * 3,
        blockstun: 12 + i * 2,
        hitstop: 6 + i,
        push: rising ? 2.5 : 3 + i,
        launch,
        knockdown: rush && i === 2,
        level: "mid",
        rank: i + 1,
        cancels: [],
        box: { x: 0, y: 0, w: 0, h: 0 },
        ...(rush
          ? {
              drive: {
                from: startup - 4,
                to: startup + active,
                speed: [9, 11, 13][i],
              },
            }
          : {}),
        poses: durations.map((ticks, index) => ({
          ticks,
          phase: index === 0 ? "startup" : index === 1 ? "active" : "recovery",
          hurtboxes: rising && index !== 3 ? crouching : standing,
          hitboxes: index === 1 && shape ? [shape] : [],
          ...(index === 1 && release ? { release } : {}),
        })),
      };
    }
  }
  return { moves, art };
}
