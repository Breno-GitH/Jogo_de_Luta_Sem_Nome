import type { Button, Point } from "./types";
import { expandedFinishes, expandedNames, type ExpandedRoute } from "./kaneki-chain-expansion";

export const chainFirstTicks = 30;
export const chainSecondTicks = 36;
export const chainWindup = 4;
export const chainBufferTicks = 6;
export const chainEscapeTicks = 9;
export const kaguneGrabLimit = 300;
export const resistanceGoal = 3;
export const resistanceInterval = 12;
export const chainButtons = ["light", "medium", "heavy"] as const;
export type ChainButton = (typeof chainButtons)[number];
export type ChainRoute =
  | "embrace"
  | "pendulum"
  | "centipede"
  | "lasso"
  | "spin"
  | "meteor"
  | "release"
  | ExpandedRoute;

export type ChainOrigin = "universal" | "kaguneGrab" | "fourSwords" | "rinkakuRush";
export type Chain = {
  origin: ChainOrigin;
  rank: number;
  initialCombo: number;
  started: number;
  phase: "opener" | "connected" | "choice1" | "action" | "choice2" | "finisher" | "outro";
  since: number;
  resistance?: number;
  defenderLast?: ChainButton;
  nextResistance?: number;
  landed?: boolean;
  superQueued?: boolean;
  last?: ChainButton;
  queued?: ChainButton;
  escape?: { button: ChainButton; tick: number };
  finish?: ChainRoute;
  from?: { actor: Point; victim: Point };
};

export const chainNames: Record<ChainRoute, string> = {
  ...expandedNames,
  embrace: "Abraço Rinkaku",
  pendulum: "Pêndulo Vermelho",
  centipede: "Queda da Centopeia",
  lasso: "Laço Aéreo",
  spin: "Arremesso Giratório",
  meteor: "Queda Meteórica",
  release: "Arremesso de saída",
};

export function chainPick(pressed: Button[]): ChainButton | undefined {
  const picks = chainButtons.filter((button) => pressed.includes(button));
  return picks.length === 1 ? picks[0] : undefined;
}

const grabOptions = {
  pull: ["rinkakuCombo", "redSpiral", "centipedeDrop"],
  throw: ["quickSwing", "doubleSwing", "redCatapult"],
  launch: ["aerialSnatch", "rinkakuCyclone", "centipedeMeteor"],
} as const;
const swordsOptions = ["swordsRecall", "swordsSide", "swordsRise"] as const;
const rushOptions = [
  ["rushReel", "rushQuickThrow", "rushShortLift"],
  ["rushCrossover", "rushSpinThrow", "rushAirSet"],
  ["rushDragStrike", "rushHeavyThrow", "rushSlam"],
] as const;

type Starter = keyof typeof grabOptions;
export const directChain = (s: Chain) => s.origin === "fourSwords" || s.origin === "rinkakuRush";
export function chainWindow(s: Chain, second = false) {
  if (s.origin === "kaguneGrab") return kaguneGrabLimit;
  if (s.origin === "rinkakuRush") return [20, 26, 30][s.rank];
  if (s.origin === "fourSwords") return 23;
  return second ? chainSecondTicks : chainFirstTicks;
}
export function chainFinisher(
  chain: Chain,
  button: ChainButton,
  starter?: Starter,
): ChainRoute | undefined {
  const index = chainButtons.indexOf(button);
  if (chain.origin === "fourSwords") return swordsOptions[index];
  if (chain.origin === "rinkakuRush") return rushOptions[chain.rank][index];
  if (!starter) return;
  if (chain.origin === "kaguneGrab") return grabOptions[starter][index];
  if (starter === "pull") return (["embrace", "pendulum", "centipede"] as const)[index];
  if (starter === "launch") return (["lasso", "spin", "meteor"] as const)[index];
}

export const resistanceButton = (s: Chain) => chainButtons[(s.rank + (s.resistance ?? 0)) % chainButtons.length];
export function canResistChain(s: Chain, tick: number) {
  return s.origin === "kaguneGrab" &&
    (s.phase === "connected" || s.phase === "choice1" || s.phase === "choice2" ||
      s.phase === "finisher" && !!s.finish && !!chainFinishes[s.finish].slam && tick - s.since < 9);
}

type Key = [
  tick: number,
  advance: number,
  height: number,
  gap: number,
  victimHeight: number,
];
export type Finish = {
  keys: Key[];
  hit: number;
  damage: number;
  recovery: number;
  stop: number;
  push: number;
  launch: number;
  slam?: true;
  relativeGap?: true;
  follow?: "ground" | "air";
  limbs?: 1 | 2 | 3 | 4;
  beats?: { at: number; damage: number }[];
};

export const chainFinishes: Record<ChainRoute, Finish> = {
  ...expandedFinishes,
  embrace: {
    keys: [
      [5, 5, 0, 43, 15],
      [9, 10, 0, 44, 20],
      [15, 14, 0, 77, 24],
      [22, 10, 0, 109, 9],
    ],
    hit: 15,
    damage: 61,
    recovery: 11,
    stop: 6,
    push: 6,
    launch: -3,
  },
  pendulum: {
    keys: [
      [6, 0, 0, 42, 43],
      [14, -8, 0, -43, 117],
      [22, 2, 0, 31, 85],
      [27, 13, 0, 95, 43],
      [34, 11, 0, 168, 27],
    ],
    hit: 27,
    damage: 87,
    recovery: 16,
    stop: 8,
    push: 11,
    launch: -3.5,
  },
  centipede: {
    keys: [
      [9, 0, 0, 53, 34],
      [20, 0, 150, 45, 134],
      [34, 0, 325, 40, 290],
      [41, 0, 323, 32, 254],
      [49, 1, 258, 27, 181],
      [60, 4, 55, 18, 0],
      [66, -5, 0, 39, 0],
      [73, -15, 0, 43, 0],
    ],
    hit: 60,
    damage: 131,
    recovery: 20,
    stop: 12,
    push: 2,
    launch: 0,
    slam: true,
  },
  lasso: {
    keys: [
      [6, 11, 46, 62, 120],
      [12, 25, 119, 47, 139],
      [19, 31, 122, 47, 110],
      [24, 34, 84, 64, 45],
      [35, 32, 0, 100, 6],
    ],
    hit: 19,
    damage: 55,
    recovery: 10,
    stop: 6,
    push: 4,
    launch: 2,
  },
  spin: {
    keys: [
      [8, 15, 78, 52, 117],
      [16, 33, 174, 43, 157],
      [23, 37, 186, -48, 204],
      [28, 44, 146, 42, 162],
      [33, 47, 111, 114, 123],
      [47, 49, 0, 207, 36],
    ],
    hit: 33,
    damage: 79,
    recovery: 17,
    stop: 8,
    push: 12,
    launch: -1.5,
  },
  meteor: {
    keys: [
      [7, 21, 74, 60, 133],
      [17, 50, 208, 52, 209],
      [25, 63, 279, 37, 248],
      [32, 62, 278, 37, 247],
      [40, 80, 231, 34, 185],
      [50, 122, 59, 19, 0],
      [57, 118, 0, 43, 0],
      [65, 108, 0, 48, 0],
    ],
    hit: 50,
    damage: 137,
    recovery: 26,
    stop: 14,
    push: 3,
    launch: 0,
    slam: true,
  },
  release: {
    keys: [
      [7, 0, 0, 54, 24],
      [14, 2, 0, 120, 18],
      [20, 0, 0, 151, 8],
    ],
    hit: 14,
    damage: 51,
    recovery: 14,
    stop: 6,
    push: 7,
    launch: -3,
  },
};

export const chainBoundX = (x: number) =>
  Math.round(Math.max(40, Math.min(1240, x)));
const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function chainPose(
  route: ChainRoute,
  from: NonNullable<Chain["from"]>,
  age: number,
  facing: number,
  floor: number,
) {
  const finish = chainFinishes[route];
  const end = finish.keys.at(-1)![0];
  const startGap = (from.victim.x - from.actor.x) * facing;
  const keys: Key[] = [
    [
      0,
      0,
      floor - from.actor.y,
      startGap,
      floor - from.victim.y,
    ],
    ...finish.keys.map(([tick, x, y, gap, targetY]): Key =>
      [tick, x, y, gap + (finish.relativeGap ? startGap : 0), targetY]),
  ];
  const index = keys.findIndex((key) => key[0] >= age);
  const next = keys[Math.max(1, index < 0 ? keys.length - 1 : index)];
  const prev = keys[keys.indexOf(next) - 1];
  const t = Math.max(0, Math.min(1, (age - prev[0]) / (next[0] - prev[0])));
  const f = finish.slam && next[0] === finish.hit ? t * t : ease(t);
  const x = chainBoundX(from.actor.x + mix(prev[1], next[1], f) * facing);
  const y = Math.round(floor - mix(prev[2], next[2], f));
  const gap = mix(prev[3], next[3], f) * facing;
  return {
    actor: { x, y },
    victim: {
      x: chainBoundX(x + gap),
      y: Math.round(floor - mix(prev[4], next[4], f)),
    },
    end,
    clip: route === "release" ? "kaguneThrow" : "chain_" + route,
    victimClip:
      finish.slam && age >= finish.hit
        ? "downed"
        : age >= finish.hit
          ? "damageAir"
          : y < floor - 30 || prev[4] > 65
            ? "launched"
            : "grabbed",
  };
}
