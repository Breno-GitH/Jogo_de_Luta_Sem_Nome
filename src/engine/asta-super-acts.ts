/** Authored 60 Hz choreography. Contacts without damage are reactions, never extra hit entities.
 * Eleven narrative chapters include the interruptible Black Asta startup before confirmation.
 * Every body segment owns its cels; FX and wall-clock time cannot advance this timeline. */
import type { AstaSword } from "./asta-stances";
export const unionBeats = {
  carry: 4,
  lift: 47,
  liebe: 90,
  pact: 136,
  union: 158,
  reveal: 218,
  slayer: 232,
  horizontal: 256,
  diagonal: 292,
  upper: 330,
  dweller: 352,
  pursuit: 398,
  blackSlash: 436,
  slashContact: 450,
  follow: 468,
  destroyer: 484,
  rupture: 513,
  slasher: 580,
  aerial: 724,
  redirect: 781,
  retreat: 824,
  charge: 872,
  equinox: 932,
  release: 942,
  impact: 956,
  outro: 1004,
  partial: 1040,
  base: 1070,
  end: 1100,
} as const;
export interface UnionBodyClip {
  sheet: string;
  frames: number[];
  durations: number[];
}
const cel = (
  sheet: string,
  durations: number[],
  frames = [0, 1, 2, 3, 4, 5],
): UnionBodyClip => ({ sheet, frames, durations });
export const unionBodyClips = {
  unionStart: cel("r41-awaken", [2, 2, 2, 3, 3, 2]),
  unionMeteorite: cel("r-black-flight", [3, 3, 4, 4, 4, 4]),
  unionMissPartial: cel("r-black-start", [5, 5], [0, 1]),
  unionMiss: cel("r-union-return", [8, 14], [4, 5]),
  unionMeteorFollow: cel("r41-meteor-follow", [8, 8, 8, 4, 7, 9]),
  unionBlackBrace: cel("r-black-flight", [12, 12], [4, 5]),
  unionPartner: cel("r41-partner", [10, 10, 12, 12, 12, 12]),
  unionChange: cel("r41-union", [10, 12, 14, 14, 12, 12]),
  unionSlayerHorizontal: cel("r41-slayer-horizontal", [8, 7, 6, 3, 7, 9]),
  unionSlayerDiagonal: cel("r41-slayer-diagonal", [7, 7, 6, 3, 7, 10]),
  unionRise: cel("r-union-rise", [7, 6, 5, 4, 8, 10]),
  unionChase: cel("r41-air-turn", [9, 9, 10], [0, 1, 2]),
  unionDwellerContact: cel("r-union-rush", [8, 10, 18], [0, 1, 2]),
  unionDwellerCast: cel("r41-dweller-cast", [6, 6, 5, 3, 7, 9]),
  unionDwellerFollow: cel("r-union-rush", [8, 8, 16], [3, 4, 5]),
  unionDestroyer: cel("r41-destroyer", [10, 10, 9, 4, 9, 12]),
  unionDescent: cel("r-union-dive", [7, 7, 7, 7, 7, 7]),
  unionSlasherA: cel("r41-slasher-a", [6, 4, 7, 7, 5, 13]),
  unionSlasherB: cel("r41-slasher-b", [6, 7, 5, 6, 6, 14]),
  unionSlasherCross: cel("r41-slasher-cross", [4, 3, 5, 6, 4, 12]),
  unionKatanaLaunch: cel("r-union-rise", [7, 8, 9], [3, 4, 5]),
  unionOverfly: cel("r41-air-turn", [6, 8, 7, 7, 6, 8]),
  unionRedirect: cel("r-union-dive", [5, 5, 5, 4, 5, 8]),
  unionFall: cel("r41-air-turn", [12, 14], [4, 5]),
  unionRetreat: cel("r41-retreat", [7, 6, 10, 9, 8, 8]),
  unionEquinoxCharge: cel("r41-equinox-prep", [10, 10, 10, 10, 12, 8]),
  unionEquinox: cel("r41-equinox-cut", [5, 4, 4, 8, 10, 11]),
  unionAfterCut: cel("r-union-return", [9, 10, 11], [0, 1, 2]),
  unionReturn: cel("r-union-return", [11, 12, 13], [0, 1, 2]),
  unionPartialReturn: cel("r41-partner", [7, 8, 7, 8], [2, 3, 4, 5]),
  unionBaseReturn: cel("r-union-return", [14, 16], [4, 5]),
} satisfies Record<string, UnionBodyClip>;
export type UnionClip = keyof typeof unionBodyClips;
export const unionSegments: readonly (readonly [
  number,
  UnionClip,
  AstaSword,
])[] = [
  [0, "unionMeteorite", "slayer"],
  [22, "unionMeteorFollow", "slayer"],
  [66, "unionBlackBrace", "slayer"],
  [90, "unionPartner", "slayer"],
  [158, "unionChange", "slayer"],
  [232, "unionSlayerHorizontal", "slayer"],
  [272, "unionSlayerDiagonal", "slayer"],
  [312, "unionRise", "slayer"],
  [352, "unionChase", "dweller"],
  [380, "unionDwellerContact", "dweller"],
  [416, "unionDwellerCast", "dweller"],
  [452, "unionDwellerFollow", "dweller"],
  [484, "unionDestroyer", "destroyer"],
  [538, "unionDescent", "destroyer"],
  [580, "unionSlasherA", "slasher"],
  [622, "unionSlasherB", "slasher"],
  [666, "unionSlasherCross", "slasher"],
  [700, "unionKatanaLaunch", "slasher"],
  [724, "unionOverfly", "slasher"],
  [766, "unionRedirect", "slasher"],
  [798, "unionFall", "slasher"],
  [824, "unionRetreat", "slasher"],
  [872, "unionEquinoxCharge", "slasher"],
  [932, "unionEquinox", "slasher"],
  [974, "unionAfterCut", "slasher"],
  [1004, "unionReturn", "slasher"],
  [1040, "unionPartialReturn", "slasher"],
  [1070, "unionBaseReturn", "slasher"],
];
export function unionPose(t: number, openingTick = 14) {
  const [start, clip, sword] =
    [...unionSegments].reverse().find(([at]) => t >= at) ?? unionSegments[0];
  const tick =
    t < 22 ? Math.min(21, Math.max(0, openingTick - 14) + t) : t - start;
  const body = unionBodyClips[clip];
  let age = tick,
    index = 0;
  while (index < body.frames.length - 1 && age >= body.durations[index])
    age -= body.durations[index++];
  return { clip, tick, sword, frame: body.frames[index], sheet: body.sheet };
}
export const unionSwordChanges = [352, 484, 580] as const;
export const unionContacts = [
  { tick: 4, kind: "meteorite", damage: 50, hold: 6, angle: 0 },
  { tick: 47, kind: "lift", damage: 0, hold: 2, angle: -1.2 },
  { tick: 256, kind: "horizontal", damage: 0, hold: 2, angle: 0 },
  { tick: 292, kind: "diagonal", damage: 0, hold: 2, angle: 0.7 },
  { tick: 330, kind: "rise", damage: 30, hold: 3, angle: -1.1 },
  { tick: 398, kind: "pursuit", damage: 0, hold: 2, angle: 0.65 },
  { tick: 450, kind: "blackSlash", damage: 30, hold: 3, angle: -0.4 },
  { tick: 468, kind: "follow", damage: 0, hold: 2, angle: -0.8 },
  { tick: 513, kind: "rupture", damage: 30, hold: 3, angle: 0.3 },
  { tick: 588, kind: "katanaA", damage: 0, hold: 1, angle: 0 },
  { tick: 606, kind: "katanaB", damage: 0, hold: 1, angle: 0.8 },
  { tick: 635, kind: "katanaC", damage: 0, hold: 1, angle: -0.7 },
  { tick: 646, kind: "katanaD", damage: 0, hold: 1, angle: -1.2 },
  { tick: 671, kind: "katanaE", damage: 0, hold: 1, angle: 0 },
  { tick: 686, kind: "katanaF", damage: 30, hold: 2, angle: 0.6 },
  { tick: 705, kind: "katanaLaunch", damage: 0, hold: 2, angle: -1.25 },
  { tick: 781, kind: "redirect", damage: 30, hold: 3, angle: 0.9 },
  { tick: 956, kind: "explosion", damage: 140, hold: 9, angle: Math.PI / 2 },
] as const;
export const unionChapters = [
  [0, "meteorite"],
  [90, "liebe"],
  [158, "union"],
  [232, "slayer"],
  [352, "dweller"],
  [484, "destroyer"],
  [580, "slasher"],
  [724, "aerial"],
  [824, "retreat"],
  [872, "equinoxCharge"],
  [932, "equinox"],
  [956, "equinoxImpact"],
  [1004, "return"],
] as const;
export function unionPhase(t: number) {
  return (
    [...unionChapters].reverse().find(([at]) => t >= at)?.[1] ?? "meteorite"
  );
}
