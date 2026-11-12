import type { CommandBuffer } from "./input";
import type { Button, HitWindow, Move, Point, Rect } from "./types";

export type BenEffect = "speed" | "tail" | "wind" | "step" | "power" | "quake" | "flame" | "fireball" | "pillar" | "boost" | "crystal" | "colossus" | "metal" | "electric" | "ice" | "spectral" | "thermal" | "car" | "storm" | "nightmare" | "gravity" | "sonic";
export interface BenField {
  type: "fireball" | "pillar" | "quake" | "spikes" | "wall" | "shard" | "bolt" | "frost" | "heat" | "beam" | "car" | "lightning" | "spectralHand" | "gravityPulse" | "gravityWell" | "gravityStone" | "sonic" | "sonicAssist";
  offset: number;
  height: number;
  width: number;
  speed: number;
  life: number;
  pattern?: readonly { offset?: number; delay?: number; vy?: number; height?: number; direction?: number }[];
  activeAge?: readonly [number, number];
  gravity?: number;
  aim?: "heat" | "rain";
  spendCharge?: boolean;
  durability?: number;
  gravityMode?: "pull" | "repel";
  energy?: 1 | 2;
  length?: number;
}
export interface BenMoveMeta {
  effect: BenEffect;
  technique?: string;
  follow?: number;
  confirmHits?: boolean;
  commandGrab?: boolean;
  cross?: boolean;
  land?: boolean;
  field?: BenField;
  grow?: 1 | 2;
  absorb?: 1 | 2;
  cable?: "horizontal" | "upper" | "wide";
  counter?: boolean;
  armorCounter?: boolean;
  chargeGain?: number;
  landingImpact?: boolean;
  air?: boolean;
  airUse?: "flight" | "dive";
  aerialMotion?: "glide" | "dive";
  phase?: { from: number; to: number; physicalOnly?: boolean };
  spectralReach?: number;
  cold?: number;
  nrgMode?: "release" | "seal";
  leap?: { takeoff: number; speed: number; reach: number };
  burrow?: { from: number; to: number; reach: number };
  lift?: boolean;
  carSlam?: boolean;
  captureStrike?: boolean;
  nightmare?: boolean;
  echoSplit?: 1 | 2;
  echoHarmony?: 1 | 2;
}
export interface BenObject {
  id: string;
  direction: number;
  x: number;
  y: number;
  age: number;
  spent: boolean;
  cast?: number;
  vy?: number;
  aim?: number;
  scale?: number;
  impactAge?: number;
  power?: number;
  durability?: number;
  hitKeys?: string[];
  sourceClone?: number;
  fragment?: number;
}

export const benFormBalance = {
  growth: {
    1: { scale: 1.2, ticks: 228, cooldown: 190 },
    2: { scale: 1.35, ticks: 345, cooldown: 225 },
  },
  energy: { capacity: 100, retention: 600, lightSpend: 25, mediumSpend: 50 },
} as const;

function blow(
  timings: [number, number, number], damage: number, box: Rect, rank: number,
  effect: BenEffect, options: Partial<Move> = {},
): Move {
  const [startup, active, recovery] = timings;
  return {
    startup, active, recovery, damage, box, rank, level: "mid",
    stun: rank === 1 ? 17 : 23, blockstun: rank === 1 ? 8 : 12,
    hitstop: rank === 1 ? 3 : 5, push: rank === 1 ? 2.4 : 4.4, launch: 0,
    cancels: rank === 1 ? ["medium"] : ["special"], ben: { effect },
    cancelWindow: { fromTick: startup, toTick: startup + active + 7 },
    ...options,
  };
}

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const noBox = rect(0, 0, 0, 0);

function special(
  technique: string, effect: BenEffect, timing: [number, number, number],
  damage: number, box: Rect, options: Partial<Move> = {}, flags: Partial<BenMoveMeta> = {},
) {
  return blow(timing, damage, box, 3, effect, { cancels: [], ...options, ben: { technique, effect, ...flags } });
}

function windows(...hits: [number, number, Partial<HitWindow>?][]): HitWindow[] {
  return hits.map(([fromTick, toTick, values], id) => ({ id, fromTick, toTick, ...values }));
}

const charge = (from: number, to: number, speed: number) => ({ from, to, speed });

export const xlr8Moves = {
  stand_light: blow([4, 3, 9], 22, rect(25, -108, 59, 23), 1, "speed"),
  stand_medium: blow([7, 4, 16], 38, rect(24, -105, 96, 34), 2, "tail", { stun: 22 }),
  crouch_light: blow([5, 3, 10], 19, rect(20, -45, 54, 24), 1, "speed", { level: "low" }),
  crouch_medium: blow([8, 6, 24], 32, rect(19, -33, 72, 31), 2, "speed", {
    drive: charge(4, 14, 10), level: "low", stun: 23, blockstun: 10,
  }),
  air_light: blow([4, 5, 10], 22, rect(19, -106, 62, 38), 1, "speed", { level: "high", airHold: -1 }),
  air_medium: blow([7, 7, 17], 40, rect(20, -69, 85, 59), 2, "tail", {
    level: "high", drive: charge(5, 15, 8), hopAt: 7, hopVelocity: 6, cancels: [],
  }),
  turbo_light: special("turbo", "speed", [6, 8, 23], 45, rect(12, -111, 66, 62), {
    drive: charge(4, 14, 16), push: 2.5, stun: 38, blockstun: 10, hitstop: 4,
    cancels: ["omnitrix"], cancelWindow: { fromTick: 10, toTick: 31 },
  }),
  turbo_medium: special("turbo", "speed", [9, 16, 28], 26, rect(11, -113, 71, 65), {
    drive: charge(4, 25, 22), push: 2, stun: 20, blockstun: 11, hitstop: 3,
    hitWindows: windows([9, 13], [15, 19, { damage: 24 }], [21, 25, { damage: 30, push: 6 }]),
  }, { confirmHits: true, follow: 6 }),
  cyclone_light: special("cyclone", "wind", [7, 5, 18], 43, rect(-36, -111, 113, 81), { push: 8 }),
  cyclone_medium: special("cyclone", "wind", [11, 14, 28], 28, rect(-52, -132, 154, 105), {
    hitWindows: windows([11, 15], [16, 19, { damage: 18 }], [21, 25, { damage: 31, launch: -13, stun: 36, push: 2 }]),
    push: 2, hitstop: 3, cancels: ["jump", "omnitrix"], cancelWindow: { fromTick: 24, toTick: 41 },
  }),
  lightning_light: special("lightning", "step", [4, 10, 17], 0, noBox, { drive: charge(4, 14, -17) }),
  lightning_medium: special("lightning", "step", [5, 13, 23], 0, noBox, { drive: charge(5, 18, 20) }, { cross: true }),
};

export const fourArmsMoves = {
  stand_light: blow([5, 8, 13], 20, rect(36, -130, 77, 47), 1, "power", {
    hitWindows: windows([5, 8], [10, 13, { damage: 22 }]), cancels: ["medium", "special"],
    hitstop: 3, stun: 20,
  }),
  stand_medium: blow([10, 5, 22], 55, rect(35, -111, 79, 47), 2, "power", { push: 5, stun: 29 }),
  crouch_light: blow([6, 4, 13], 25, rect(22, -60, 66, 34), 1, "power", { level: "low", stun: 23 }),
  crouch_medium: blow([11, 5, 25], 46, rect(16, -55, 99, 50), 2, "power", { level: "low", push: 6 }),
  air_light: blow([6, 5, 14], 30, rect(29, -123, 73, 42), 1, "power", { level: "high" }),
  air_medium: blow([11, 6, 24], 57, rect(24, -89, 75, 73), 2, "power", { level: "high", knockdown: true, cancels: [] }),
  tackle_light: special("tackle", "power", [9, 7, 22], 52, rect(25, -125, 72, 86), {
    drive: charge(5, 16, 11), push: 7, hitstop: 6,
  }),
  tackle_medium: special("tackle", "power", [15, 10, 32], 78, rect(25, -133, 82, 95), {
    drive: charge(7, 25, 15), push: 12, launch: -6, knockdown: true, hitstop: 9,
  }),
  quad_light: special("quad", "power", [8, 3, 28], 0, rect(22, -124, 55, 53), {
    kind: "grab", level: "throw",
  }, { commandGrab: true }),
  quad_medium: special("quad", "power", [15, 4, 38], 0, rect(26, -129, 64, 62), {
    kind: "grab", level: "throw", drive: charge(7, 16, 4),
  }, { commandGrab: true }),
  seismic_light: special("seismic", "quake", [10, 1, 26], 44, noBox, {
    level: "low", push: 9, hitstop: 5,
  }, { field: { type: "quake", offset: 40, height: 32, width: 48, speed: 8, life: 10 } }),
  seismic_medium: special("seismic", "quake", [17, 1, 37], 64, noBox, {
    level: "low", push: 4, launch: -14.5, stun: 39, hitstop: 8,
    cancels: ["omnitrix"], cancelWindow: { fromTick: 18, toTick: 39 },
  }, { field: { type: "quake", offset: 45, height: 49, width: 63, speed: 10, life: 16 } }),
};

export const heatblastMoves = {
  stand_light: blow([5, 3, 11], 25, rect(24, -101, 64, 27), 1, "flame"),
  stand_medium: blow([8, 5, 18], 44, rect(26, -105, 80, 36), 2, "flame", { stun: 25 }),
  crouch_light: blow([5, 3, 12], 22, rect(22, -47, 62, 32), 1, "flame", { level: "low", stun: 20 }),
  crouch_medium: blow([9, 5, 21], 36, rect(19, -49, 78, 44), 2, "flame", { level: "low" }),
  air_light: blow([5, 5, 12], 26, rect(24, -104, 65, 42), 1, "flame", { level: "high" }),
  air_medium: blow([8, 8, 19], 45, rect(22, -66, 83, 61), 2, "boost", {
    level: "high", drive: charge(5, 17, 6.5), hopAt: 8, hopVelocity: 7, cancels: [],
  }),
  fireball_light: special("fireball", "fireball", [8, 1, 17], 36, noBox, {
    level: "mid", push: 5, stun: 27,
  }, { field: { type: "fireball", offset: 45, height: 90, width: 15, speed: 18, life: 60 } }),
  fireball_medium: special("fireball", "fireball", [15, 1, 33], 58, noBox, {
    push: 8, hitstop: 7,
  }, { field: { type: "fireball", offset: 55, height: 91, width: 27, speed: 10, life: 78 } }),
  pillar_light: special("pillar", "pillar", [10, 1, 23], 46, noBox, {
    launch: -10, push: 2, stun: 29,
  }, { field: { type: "pillar", offset: 80, height: 158, width: 46, speed: 0, life: 11 } }),
  pillar_medium: special("pillar", "pillar", [18, 1, 31], 65, noBox, {
    launch: -13, push: 4, stun: 38, hitstop: 7,
  }, { field: { type: "pillar", offset: 217, height: 229, width: 69, speed: 0, life: 16 } }),
  propulsion_light: special("propulsion", "boost", [7, 9, 21], 46, rect(18, -111, 67, 72), {
    drive: charge(5, 16, 13), push: 7,
  }),
  propulsion_medium: special("propulsion", "boost", [10, 13, 29], 62, rect(7, -126, 83, 112), {
    drive: charge(8, 23, 11), hopAt: 10, hopVelocity: -11.5, launch: -13, push: 3, stun: 35,
    cancels: ["omnitrix"], cancelWindow: { fromTick: 15, toTick: 32 },
  }, { land: true }),
};

export const diamondheadMoves = {
  stand_light: blow([5, 4, 12], 26, rect(27, -110, 65, 28), 1, "crystal"),
  stand_medium: blow([9, 5, 19], 48, rect(25, -110, 105, 33), 2, "crystal", { stun: 31 }),
  crouch_light: blow([6, 4, 11], 24, rect(23, -53, 70, 29), 1, "crystal", { level: "low", stun: 23 }),
  crouch_medium: blow([10, 6, 21], 39, rect(21, -48, 102, 38), 2, "crystal", { level: "low", push: 6 }),
  air_light: blow([5, 5, 12], 27, rect(23, -108, 69, 37), 1, "crystal", { level: "high" }),
  air_medium: blow([9, 7, 20], 47, rect(22, -81, 90, 68), 2, "crystal", { level: "high", push: 6, cancels: [] }),
  spikes_light: special("spikes", "crystal", [9, 1, 23], 42, noBox, { stun: 27, push: 5 }, {
    field: { type: "spikes", offset: 70, height: 91, width: 38, speed: 0, life: 19,
      pattern: [{}, { offset: 37, delay: 3 }, { offset: 74, delay: 6 }] },
  }),
  spikes_medium: special("spikes", "crystal", [15, 1, 34], 65, noBox, {
    launch: -14, push: 3, stun: 42, hitstop: 6,
    cancels: ["jump", "omnitrix"], cancelWindow: { fromTick: 16, toTick: 42 },
  }, {
    field: { type: "spikes", offset: 83, height: 138, width: 46, speed: 0, life: 24,
      pattern: [{}, { offset: 47, delay: 3 }, { offset: 94, delay: 6 }, { offset: 141, delay: 9 }] },
  }),
  wall_light: special("wall", "crystal", [9, 1, 23], 0, noBox, {}, {
    field: { type: "wall", offset: 112, height: 94, width: 29, speed: 0, life: 108, durability: 55 },
  }),
  wall_medium: special("wall", "crystal", [17, 1, 33], 0, noBox, {}, {
    field: { type: "wall", offset: 127, height: 139, width: 43, speed: 0, life: 168, durability: 116 },
  }),
  shards_light: special("shards", "crystal", [8, 1, 21], 37, noBox, { stun: 26, push: 5 }, {
    field: { type: "shard", offset: 49, height: 96, width: 11, speed: 19, life: 54 },
  }),
  shards_medium: special("shards", "crystal", [15, 1, 32], 53, noBox, { stun: 32, push: 7 }, {
    field: { type: "shard", offset: 52, height: 91, width: 12, speed: 15, life: 63,
      pattern: [{ vy: -4.7 }, { vy: 0 }, { vy: 3.6 }] },
  }),
};

export const humungousaurMoves = {
  stand_light: blow([6, 4, 13], 31, rect(35, -126, 81, 40), 1, "colossus", { stun: 23 }),
  stand_medium: blow([10, 5, 22], 57, rect(28, -116, 118, 47), 2, "tail", { stun: 32, push: 5 }),
  crouch_light: blow([6, 4, 14], 29, rect(32, -57, 75, 40), 1, "colossus", { level: "low", stun: 25 }),
  crouch_medium: blow([12, 6, 25], 49, rect(21, -53, 125, 45), 2, "tail", { level: "low", push: 6 }),
  air_light: blow([6, 5, 15], 32, rect(37, -131, 79, 49), 1, "colossus", { level: "high" }),
  air_medium: blow([10, 10, 24], 61, rect(14, -81, 89, 81), 2, "colossus", {
    level: "high", hopAt: 10, hopVelocity: 11, knockdown: true, cancels: [],
    ben: { effect: "colossus", landingImpact: true },
  }),
  colossal_light: special("colossal", "colossus", [42, 5, 19], 61, rect(-61, -31, 123, 31), {
    push: 7, hitstop: 7, blockstun: 12,
  }, { leap: { takeoff: 7, speed: 9.4, reach: 142 } }),
  colossal_medium: special("colossal", "colossus", [66, 7, 34], 91, rect(-96, -43, 193, 43), {
    push: 10, launch: -5, hitstop: 9, knockdown: true, blockstun: 16,
  }, { leap: { takeoff: 14, speed: 16.1, reach: 334 } }),
  car_light: special("car", "car", [21, 5, 30], 79, rect(32, -95, 132, 95), {
    push: 9, stun: 32, hitstop: 8,
  }, { carSlam: true }),
  car_medium: special("car", "car", [29, 1, 35], 92, noBox, { push: 12, stun: 35, hitstop: 9 }, {
    field: { type: "car", offset: 80, height: 123, width: 61, speed: 15, life: 64, gravity: .55, pattern: [{ vy: -4.9 }] },
  }),
  tailspin_light: special("tailspin", "tail", [9, 7, 25], 49, rect(25, -91, 135, 53), { push: 7 }),
  tailspin_medium: special("tailspin", "tail", [16, 9, 37], 73, rect(-14, -100, 178, 62), {
    push: 3.5, launch: -14, stun: 42, hitstop: 8, cancels: ["omnitrix"],
    cancelWindow: { fromTick: 19, toTick: 43 },
  }),
  growth_light: special("growth", "colossus", [12, 1, 23], 0, noBox, {}, { grow: 1 }),
  growth_medium: special("growth", "colossus", [21, 1, 35], 0, noBox, {}, { grow: 2 }),
};

export const feedbackMoves = {
  stand_light: blow([4, 4, 9], 24, rect(20, -107, 59, 29), 1, "power", { stun: 19 }),
  stand_medium: blow([8, 5, 16], 43, rect(23, -109, 91, 38), 2, "electric", {
    stun: 29, ben: { effect: "electric", chargeGain: 5 },
  }),
  crouch_light: blow([5, 4, 10], 21, rect(19, -53, 62, 28), 1, "power", { level: "low", stun: 23 }),
  crouch_medium: blow([9, 5, 18], 39, rect(21, -53, 99, 38), 2, "electric", {
    level: "low", stun: 28, push: 3.2, ben: { effect: "electric", chargeGain: 4 },
  }),
  air_light: blow([4, 5, 10], 24, rect(19, -102, 68, 43), 1, "power", { level: "high", airHold: -2, stun: 20 }),
  air_medium: blow([7, 7, 19], 47, rect(22, -88, 88, 79), 2, "electric", {
    level: "high", launch: 3, cancels: [], ben: { effect: "electric", chargeGain: 5 },
  }),
  storm_light: special("storm", "storm", [12, 1, 30], 24, noBox, { push: 3, stun: 17, hitstop: 4 }, {
    field: { type: "lightning", offset: 101, height: 580, width: 36, speed: 0, life: 25, activeAge: [9, 14],
      pattern: [{}, { offset: 87, delay: 8 }, { offset: 174, delay: 16 }] },
  }),
  storm_medium: special("storm", "storm", [21, 1, 37], 37, noBox, { push: 4, stun: 21, hitstop: 5 }, {
    field: { type: "lightning", offset: 121, height: 580, width: 69, speed: 0, life: 30, activeAge: [12, 19],
      pattern: [{}, { offset: 118, delay: 11 }, { offset: 238, delay: 23 }] },
  }),
  conductor_light: special("conductor", "electric", [8, 8, 24], 0, noBox, { kind: "grab" }, {
    cable: "horizontal", captureStrike: true, commandGrab: true,
  }),
  conductor_medium: special("conductor", "electric", [15, 10, 33], 0, noBox, { kind: "grab" }, {
    cable: "wide", captureStrike: true, commandGrab: true,
  }),
  discharge_light: special("discharge", "electric", [7, 1, 18], 39, noBox, { push: 5.5, stun: 25 }, {
    field: { type: "bolt", offset: 58, height: 94, width: 14, speed: 23, life: 36, energy: 1, length: 26, spendCharge: true },
  }),
  discharge_medium: special("discharge", "electric", [16, 1, 32], 64, noBox, {
    push: 10, stun: 34, hitstop: 8, drive: charge(16, 22, -1.6),
  }, {
    field: { type: "beam", offset: 64, height: 97, width: 16, speed: 0, life: 16, energy: 2, length: 350, spendCharge: true },
  }),
  absorb_light: special("absorb", "electric", [4, 9, 25], 0, noBox, {}, { absorb: 2 }),
  absorb_medium: special("absorb", "electric", [7, 7, 28], 0, noBox, {}, { counter: true }),
  feedback_counter: special("counter-response", "electric", [0, 1, 13], 49, noBox, {
    push: 4.2, stun: 34, hitstop: 7, meterGain: 7,
  }),
  cables_light: special("cables", "electric", [8, 8, 21], 37, noBox, {
    push: -2.2, stun: 25, blockstun: 10, hitstop: 4,
  }, { cable: "horizontal", chargeGain: 10 }),
  cables_medium: special("cables", "electric", [12, 11, 29], 45, noBox, {
    push: 1.8, launch: -14.5, stun: 42, blockstun: 11, hitstop: 5, cancels: ["jump"],
    cancelWindow: { fromTick: 12, toTick: 31 },
  }, { cable: "upper", chargeGain: 13 }),
};

export const benStage6Balance = {
  frostLimit: 100, frostHold: 105, freezeTicks: 16, frostImmunity: 165,
  ghostCooldown: 65, nrgDuration: 660, nrgCooldown: 180,
} as const;

const ice = "ice", spectral = "spectral", thermal = "thermal";
const airLight = { level: "high", airHold: -1.6 } as const;
const airMedium: Partial<Move> = { level: "high", cancels: ["special"] };
const cold = (amount: number): BenMoveMeta => ({ effect: ice, cold: amount });
const projectile = (type: BenField["type"], offset: number, height: number, width: number,
  speed: number, life: number, energy: 1 | 2, length: number, vy = 0): BenField => ({
  type, offset, height, width, speed, life, energy, length, ...(vy ? { pattern: [{ vy }] } : {}),
});

export const bigChillMoves = {
  stand_light: blow([5, 4, 11], 23, rect(18, -121, 61, 33), 1, ice, { stun: 22 }),
  stand_medium: blow([8, 6, 17], 41, rect(19, -128, 89, 64), 2, ice, { stun: 30, push: 3, ben: cold(16) }),
  crouch_light: blow([5, 4, 11], 22, rect(18, -51, 62, 30), 1, ice, { level: "low", stun: 22 }),
  crouch_medium: blow([9, 5, 20], 38, rect(19, -37, 89, 33), 2, ice, { level: "low", ben: cold(22) }),
  air_light: blow([4, 6, 11], 27, rect(19, -110, 67, 48), 1, ice, { ...airLight, stun: 25 }),
  air_medium: blow([7, 7, 17], 43, rect(20, -116, 108, 84), 2, ice, { ...airMedium, airHold: -1.7, stun: 29, ben: cold(17) }),
  frostBreath_light: special("frostBreath", ice, [8, 1, 19], 42, noBox, { stun: 28, push: 4 }, {
    cold: 30, field: projectile("frost", 39, 121, 13, 17, 17, 1, 32),
  }),
  frostBreath_medium: special("frostBreath", ice, [15, 1, 27], 60, noBox, {
    stun: 35, launch: -12, push: 3, cancels: ["jump", "omnitrix"], cancelWindow: { fromTick: 15, toTick: 37 },
  }, { cold: 56, field: projectile("frost", 43, 115, 29, 13, 22, 2, 63) }),
  iceDive_light: special("iceDive", ice, [9, 10, 22], 49, rect(18, -78, 80, 78), {
    drive: charge(6, 20, 9), push: 5, blockstun: 11, stun: 27,
  }, { air: true, airUse: "dive", aerialMotion: "dive", cold: 20 }),
  iceDive_medium: special("iceDive", ice, [14, 14, 32], 67, rect(19, -102, 104, 107), {
    drive: charge(8, 26, 12), push: 9, blockstun: 15, knockdown: true,
  }, { air: true, airUse: "dive", aerialMotion: "dive", cold: 34 }),
  ghostFlight_light: special("ghostFlight", ice, [5, 25, 13], 0, noBox, {}, {
    air: true, airUse: "flight", aerialMotion: "glide",
  }),
  ghostFlight_medium: special("ghostFlight", ice, [6, 12, 22], 0, noBox, {
    drive: charge(6, 18, 13),
  }, { air: true, airUse: "flight", aerialMotion: "glide", cross: true, phase: { from: 8, to: 14, physicalOnly: true } }),
};

export const ghostfreakMoves = {
  stand_light: blow([5, 4, 10], 23, rect(19, -119, 65, 37), 1, spectral, { stun: 23 }),
  stand_medium: blow([8, 6, 17], 41, rect(20, -113, 99, 51), 2, spectral, { stun: 31, push: 2.6 }),
  crouch_light: blow([5, 4, 10], 22, rect(17, -57, 63, 35), 1, spectral, { level: "low", stun: 23 }),
  crouch_medium: blow([10, 6, 19], 41, rect(19, -50, 100, 38), 2, spectral, { level: "low" }),
  air_light: blow([5, 5, 11], 23, rect(20, -109, 71, 51), 1, spectral, airLight),
  air_medium: blow([8, 6, 21], 47, rect(22, -97, 90, 78), 2, spectral, { ...airMedium, launch: 3 }),
  ghostCross_light: special("ghostCross", spectral, [17, 6, 21], 49, rect(13, -139, 74, 111), {
    push: 3, launch: -5, stun: 27,
  }, { burrow: { from: 6, to: 13, reach: 109 }, phase: { from: 6, to: 13 } }),
  ghostCross_medium: special("ghostCross", spectral, [27, 7, 31], 64, rect(13, -160, 84, 132), {
    push: 3, launch: -15, stun: 40, cancels: ["jump"], cancelWindow: { fromTick: 27, toTick: 44 },
  }, { burrow: { from: 8, to: 22, reach: 215 }, phase: { from: 8, to: 22 } }),
  spectralArms_light: special("spectralArms", spectral, [9, 6, 22], 0, noBox, { kind: "grab" }, {
    spectralReach: 85, commandGrab: true, captureStrike: true,
  }),
  spectralArms_medium: special("spectralArms", spectral, [16, 8, 34], 0, noBox, { kind: "grab" }, {
    spectralReach: 133, commandGrab: true, captureStrike: true,
  }),
  ghostPhase_light: special("ghostPhase", "nightmare", [13, 1, 49], 12, noBox, { push: 0, stun: 13, hitstop: 4 }, {
    nightmare: true, phase: { from: 13, to: 29 },
    field: { type: "spectralHand", offset: 77, height: 78, width: 50, speed: 0, life: 25, activeAge: [8, 15],
      pattern: [{}, { offset: 112, delay: 11 }, { offset: 170, delay: 21, height: 150, direction: -1, vy: 4 }] },
  }),
  ghostPhase_medium: special("ghostPhase", "nightmare", [20, 1, 65], 15, noBox, { push: 0, stun: 15, hitstop: 5 }, {
    nightmare: true, phase: { from: 20, to: 42 },
    field: { type: "spectralHand", offset: 88, height: 97, width: 58, speed: 0, life: 28, activeAge: [10, 18],
      pattern: [{}, { offset: 113, delay: 10 }, { offset: 217, delay: 20 },
        { offset: 275, delay: 32, height: 180, direction: -1, vy: 5 },
        { offset: 144, delay: 44, height: 148, vy: 4 }] },
  }),
};

export const nrgMoves = {
  stand_light: blow([6, 4, 12], 28, rect(29, -135, 63, 34), 1, "metal", { stun: 25, push: 2.4 }),
  stand_medium: blow([11, 5, 23], 53, rect(27, -136, 74, 36), 2, "metal", {
    stun: 35, push: 2.8, hitstop: 6,
    cancelWindow: { fromTick: 11, toTick: 22 },
  }),
  crouch_light: blow([7, 4, 13], 25, rect(25, -108, 63, 32), 1, "metal", { level: "low", stun: 25 }),
  crouch_medium: blow([12, 5, 26], 48, rect(29, -48, 79, 45), 2, "metal", {
    level: "low", push: 5.6, hitstop: 6,
  }),
  air_light: blow([6, 5, 15], 31, rect(27, -137, 76, 34), 1, "metal", airLight),
  air_medium: blow([8, 10, 25], 58, rect(18, -71, 58, 71), 2, "metal", {
    level: "high", hopAt: 8, hopVelocity: 6, knockdown: true, hitstop: 8, cancels: [],
  }),
  thermal_light: special("thermal", thermal, [10, 1, 20], 46, noBox, { stun: 25, push: 5 }, {
    field: projectile("beam", 48, 95, 11, 0, 9, 1, 188),
  }),
  thermal_medium: special("thermal", thermal, [19, 1, 33], 70, noBox, { stun: 34, push: 9, hitstop: 8 }, {
    field: projectile("beam", 51, 119, 19, 0, 18, 2, 298),
  }),
  armorImpact_light: special("armorImpact", "metal", [9, 7, 24], 50, rect(25, -128, 48, 56), {
    drive: charge(5, 15, 7), stun: 25, blockstun: 10, push: 7.8, hitstop: 7,
  }),
  armorImpact_medium: special("armorImpact", "metal", [17, 5, 33], 74, rect(28, -94, 64, 54), {
    level: "high", stun: 31, blockstun: 14, push: 6.5, hitstop: 9, knockdown: true,
  }),
  nrgUnseal_light: special("nrgMode", thermal, [18, 1, 8], 0, noBox, {}, { nrgMode: "release" }),
  armorCounter_medium: special("armorCounter", "metal", [5, 8, 29], 0, noBox, {}, { armorCounter: true }),
  nrgCounterShove: blow([3, 4, 25], 45, rect(28, -133, 87, 47), 3, "metal", {
    stun: 29, push: 11, hitstop: 7, cancels: [],
  }),
  nrgLock: special("nrgLock", thermal, [0, 1, 10], 0, noBox, {}),
};

export const nrgReleasedMoves = {
  stand_light: blow([4, 4, 10], 23, rect(17, -121, 63, 40), 1, thermal, { stun: 23 }),
  stand_medium: blow([8, 5, 16], 44, rect(23, -117, 103, 50), 2, thermal, { stun: 29, push: 3.2 }),
  crouch_light: blow([5, 4, 10], 22, rect(18, -55, 64, 33), 1, thermal, { level: "low", stun: 23 }),
  crouch_medium: blow([9, 6, 17], 40, rect(16, -53, 106, 44), 2, thermal, { level: "low" }),
  air_light: blow([5, 5, 11], 25, rect(20, -108, 73, 55), 1, thermal, { ...airLight, stun: 25, cancels: ["medium", "special"] }),
  air_medium: blow([7, 7, 18], 45, rect(20, -104, 98, 88), 2, thermal, { ...airMedium, airHold: -2, stun: 26 }),
  radiantShot_light: special("thermal", thermal, [7, 1, 18], 40, noBox, { stun: 26, push: 4 }, {
    air: true, field: { ...projectile("beam", 63, 106, 10, 0, 8, 1, 234), aim: "heat" },
  }),
  radiantShot_medium: special("thermal", thermal, [17, 1, 36], 68, noBox, { stun: 36, push: 11, hitstop: 8 }, {
    air: true, field: { ...projectile("beam", 64, 106, 17, 0, 16, 2, 335), aim: "heat" },
  }),
  radiantWave_light: special("nuclear", thermal, [8, 1, 20], 41, noBox, { stun: 27, push: 5 }, {
    air: true, field: { ...projectile("heat", 28, 90, 13, 5, 25, 1, 22), aim: "rain",
      pattern: [{ vy: 12 }, { offset: 38, delay: 5, vy: 13 }, { offset: 76, delay: 10, vy: 14 }] },
  }),
  radiantWave_medium: special("nuclear", thermal, [15, 10, 28], 63, rect(-55, -142, 201, 138), {
    stun: 31, push: 8, knockdown: true,
  }),
  nrgSeal_light: special("nrgMode", thermal, [4, 12, 18], 0, noBox, {
    drive: charge(4, 16, 13),
  }, { air: true, lift: true }),
  nrgSeal_medium: special("nrgMode", thermal, [12, 1, 11], 0, noBox, {}, { nrgMode: "seal", air: true }),
  nrgEmergence: special("nrgEmergence", thermal, [0, 1, 8], 0, noBox, {}),
};

const gravityPulse = (
  gravityMode: "pull" | "repel", offset: number, width: number, height: number, life: number,
): BenField => ({ type: "gravityPulse", gravityMode, offset, width, height, speed: 0, life, activeAge: [2, life - 4] });
const sonic = (offset: number, height: number, width: number, speed: number, life: number, length: number): BenField =>
  ({ type: "sonic", offset, height, width, speed, life, length });

export const gravattackMoves = {
  stand_light: blow([7, 4, 12], 29, rect(32, -133, 68, 38), 1, "gravity", { stun: 25, push: 2 }),
  stand_medium: blow([12, 5, 24], 56, rect(35, -136, 85, 66), 2, "gravity", { stun: 34, push: 2.8, hitstop: 7 }),
  crouch_light: blow([7, 4, 13], 25, rect(29, -61, 71, 35), 1, "gravity", { level: "low", stun: 24 }),
  crouch_medium: blow([11, 6, 24], 44, rect(25, -57, 101, 44), 2, "gravity", { level: "low", push: 5, drive: charge(7, 14, 2.5) }),
  air_light: blow([5, 6, 13], 29, rect(29, -128, 73, 60), 1, "gravity", airLight),
  air_medium: blow([9, 9, 26], 58, rect(14, -80, 92, 81), 2, "gravity", {
    level: "high", hopAt: 9, hopVelocity: 6, knockdown: true, cancels: [], hitstop: 8,
  }),
  gravityPull_light: special("gravityPull", "gravity", [9, 1, 15], 23, noBox, { stun: 31, push: -6.5, hitstop: 3 }, {
    field: gravityPulse("pull", 116, 150, 137, 11),
  }),
  gravityPull_medium: special("gravityPull", "gravity", [17, 1, 29], 42, noBox, {
    stun: 39, push: -3.7, launch: -13, cancels: ["jump", "omnitrix"], cancelWindow: { fromTick: 18, toTick: 42 },
  }, { field: gravityPulse("pull", 137, 184, 175, 14) }),
  gravityRepel_light: special("gravityRepel", "gravity", [10, 1, 22], 45, noBox, { stun: 22, push: 8 }, {
    field: gravityPulse("repel", 81, 112, 113, 11),
  }),
  gravityRepel_medium: special("gravityRepel", "gravity", [21, 1, 35], 67, noBox, {
    stun: 32, push: 11, launch: -8, knockdown: true, hitstop: 8,
  }, { field: gravityPulse("repel", 19, 236, 149, 15) }),
  gravityDomain_light: special("gravityDomain", "gravity", [17, 1, 25], 0, noBox, {}, {
    field: { type: "gravityWell", offset: 0, width: 310, height: 179, speed: 0, life: 180 },
  }),
  gravityDomain_medium: special("gravityDomain", "gravity", [16, 21, 25], 71, rect(5, -113, 75, 107), {
    stun: 30, push: 9, knockdown: true, hitstop: 8,
  }),
};

export const echoEchoMoves = {
  stand_light: blow([4, 4, 9], 19, rect(13, -79, 53, 29), 1, "speed", { stun: 22, push: 1.8 }),
  stand_medium: blow([8, 5, 16], 35, rect(16, -80, 70, 40), 2, "sonic", { stun: 29, push: 2.8 }),
  crouch_light: blow([5, 4, 10], 17, rect(12, -43, 50, 27), 1, "speed", { level: "low", stun: 22 }),
  crouch_medium: blow([9, 5, 18], 32, rect(15, -44, 76, 36), 2, "sonic", { level: "low", stun: 24 }),
  air_light: blow([4, 5, 11], 20, rect(12, -81, 54, 47), 1, "speed", airLight),
  air_medium: blow([7, 6, 17], 37, rect(15, -66, 71, 66), 2, "sonic", {
    level: "high", airHold: 2, stun: 24, cancels: ["special"],
  }),
  sonicCry_light: special("sonicCry", "sonic", [7, 1, 15], 34, noBox, { stun: 23, push: 3.8 }, {
    air: true, field: sonic(31, 73, 14, 14, 13, 18),
  }),
  sonicCry_medium: special("sonicCry", "sonic", [14, 1, 25], 53, noBox, { stun: 29, push: 7, hitstop: 7 }, {
    field: sonic(36, 75, 22, 12, 23, 30),
  }),
  echoSplit_light: special("echoSplit", "sonic", [10, 1, 19], 0, noBox, {}, { echoSplit: 1 }),
  echoSplit_medium: special("echoSplit", "sonic", [16, 8, 23], 0, noBox, {}, { echoSplit: 2 }),
  echoHarmony_light: special("echoHarmony", "sonic", [8, 1, 20], 34, noBox, { stun: 23, push: 3.5 }, {
    echoHarmony: 1, field: sonic(30, 70, 17, 12, 10, 24),
  }),
  echoHarmony_medium: special("echoHarmony", "sonic", [17, 1, 30], 51, noBox, {
    stun: 30, push: 5.3, launch: -7, cancels: ["omnitrix"], cancelWindow: { fromTick: 18, toTick: 44 },
  }, { echoHarmony: 2, field: sonic(34, 76, 25, 13, 16, 32) }),
};

const gravityStones = {
  gravityStone_light: special("gravityRepel", "gravity", [0, 1, 0], 10, noBox, {
    stun: 8, blockstun: 5, push: 2.1, hitstop: 2, meterGain: 0,
  }, { field: { type: "gravityStone", offset: 0, width: 10, height: 0, speed: 9, life: 45, length: 0 } }),
  gravityStone_medium: special("gravityRepel", "gravity", [0, 1, 0], 14, noBox, {
    stun: 10, blockstun: 6, push: 2.7, hitstop: 2, meterGain: 0,
  }, { field: { type: "gravityStone", offset: 0, width: 13, height: 0, speed: 13, life: 62, length: 0 } }),
};

const echoAssists = {
  echoCopyJab: special("echoCopyJab", "sonic", [0, 1, 0], 8, noBox, { stun: 8, push: 1.5, hitstop: 2, meterGain: 0 }, {
    field: { ...sonic(18, 62, 12, 0, 2, 17), type: "sonicAssist" },
  }),
  echoCopyWave: special("echoCopyWave", "sonic", [0, 1, 0], 12, noBox, { stun: 12, push: 2.7, hitstop: 3, meterGain: 0 }, {
    field: { ...sonic(24, 70, 15, 13, 11, 20), type: "sonicAssist" },
  }),
};

const commands = {
  xlr8: ["turbo", "cyclone", "lightning"],
  fourArms: ["tackle", "quad", "seismic"],
  heatblast: ["fireball", "pillar", "propulsion"],
  diamondhead: ["spikes", "wall", "shards"],
  humungousaur: ["colossal", "car", "growth"],
  feedback: ["storm", "conductor", "discharge"],
  bigChill: ["frostBreath", "iceDive", "ghostFlight"],
  ghostfreak: ["ghostCross", "spectralArms", "ghostPhase"],
  nrg: ["thermal", "armorImpact", "nrgUnseal"],
  gravattack: ["gravityPull", "gravityRepel", "gravityDomain"],
  echoEcho: ["sonicCry", "echoSplit", "echoHarmony"],
  nrgReleased: ["radiantShot", "radiantWave", "nrgSeal"],
} as const;
const moves: Record<string, Move> = {
  ...xlr8Moves, ...fourArmsMoves, ...heatblastMoves, ...diamondheadMoves, ...humungousaurMoves, ...feedbackMoves,
  ...bigChillMoves, ...ghostfreakMoves, ...nrgMoves, ...nrgReleasedMoves, ...gravattackMoves, ...echoEchoMoves, ...echoAssists, ...gravityStones,
};

export function benSpecialCommand(form: string, buffer: CommandBuffer, button: Button) {
  if (button !== "light" && button !== "medium") return;
  const set = commands[form as keyof typeof commands];
  const motion = set && buffer.gokuSpecial(button);
  if (!motion) return;
  if (form === "nrg" && motion === "teleport" && button === "medium") return "armorCounter_medium";
  return `${set[motion === "ki" ? 0 : motion === "kamehameha" ? 1 : 2]}_${button}`;
}

export function benObjectMove(id: string) { return moves[id]; }

export function benProjectile(field: BenField) {
  return ["fireball", "shard", "bolt", "frost", "heat", "beam", "car", "sonic", "sonicAssist", "gravityStone"].includes(field.type);
}

export function benObjectHeight(object: BenObject, field: BenField) {
  if (field.type === "spikes") return Math.round(field.height * Math.max(0, Math.min(1, object.age / 5)));
  if (field.type === "wall") return Math.round(field.height * Math.max(0, Math.min(1, object.age / 6)));
  return field.height;
}

export function benBoltLength(object: BenObject, field: BenField) {
  return Math.min(field.length ?? 0, object.age * field.speed + 17);
}

export function benObjectShape(object: BenObject, field: BenField, previousX = object.x, previousY = object.y): import("./types").AttackShape {
  if (field.type === "car") {
    const scale = object.scale ?? 1;
    return { x: Math.min(object.x, previousX) - 60 * scale, y: Math.min(object.y, previousY) - 25 * scale,
      w: 120 * scale + Math.abs(object.x - previousX), h: 50 * scale + Math.abs(object.y - previousY) };
  }
  if (field.type === "beam") {
    const reach = Math.min(field.length ?? 0, object.age * 58);
    const length = object.aim && object.aim > 0 ? Math.min(reach, Math.max(0, (580 - object.y) / object.aim)) : reach;
    return { a: { x: object.x, y: object.y },
      b: { x: object.x + object.direction * length, y: object.y + length * (object.aim ?? 0) },
      r: field.width + Math.floor((object.power ?? 0) / 12) };
  }
  if (field.type === "spectralHand" && object.vy) return {
    x: Math.min(object.x, previousX) - field.width / 2, y: Math.min(object.y, previousY) - 30,
    w: field.width + Math.abs(object.x - previousX), h: 59 + Math.abs(object.y - previousY),
  };
  if (benProjectile(field)) {
    const tail = benBoltLength(object, field) * object.direction;
    const rear = object.direction === 1 ? Math.min(previousX, object.x - tail) : Math.max(previousX, object.x - tail);
    return {
      a: { x: rear, y: previousY }, b: { x: object.x, y: object.y },
      r: field.width + Math.floor((object.power ?? 0) / 10),
    };
  }
  const height = benObjectHeight(object, field);
  return {
    x: Math.min(previousX, object.x) - field.width / 2,
    y: object.y - height,
    w: field.width + Math.abs(object.x - previousX), h: height,
  };
}

export function spectralPaths(move: Move, frame: number): Point[][] {
  const phase = frame - move.startup;
  const reach = move.ben!.spectralReach!;
  const length = reach * Math.max(0, Math.min(1, (phase + 6) / 6, (move.active + 8 - phase) / 8));
  return Array.from({ length: reach > 100 ? 2 : 1 }, (_, i) => Array.from({ length: 13 }, (_, step) => {
    const t = step / 12;
    return { x: 19 + length * t, y: -95 + i * 14 + Math.round(Math.sin(t * 5.2 - phase * .21) * 26 * t) };
  }));
}

export function feedbackCablePaths(kind: NonNullable<BenMoveMeta["cable"]>, frame: number, move: Move): Point[][] {
  const phase = frame - move.startup;
  const t = Math.max(0, Math.min(1, phase / (move.active - 1)));
  const extension = phase < 0 ? Math.max(0, 1 + phase / 7)
    : Math.min(1, Math.max(0, (move.active + 7 - phase) / 7));
  const upper = kind === "upper";
  const count = upper || kind === "wide" ? 2 : 1;
  return Array.from({ length: count }, (_, i) => {
    const origin = { x: 8 + i * 7, y: -121 + i * 6 };
    const idle = { x: -21 - i * 11, y: -100 + i * 13 };
    const tip = upper
      ? { x: 102 + Math.sin(t * Math.PI) * 25 - i * 27, y: -82 - t * 133 - i * 25 }
      : { x: (kind === "wide" ? 162 - i * 15 : 98) + Math.sin(t * Math.PI) * 25, y: -96 + i * 28 + Math.sin(t * Math.PI * 1.15) * 11 };
    const end = { x: idle.x + (tip.x - idle.x) * extension, y: idle.y + (tip.y - idle.y) * extension };
    const control1 = { x: -33 + i * 12, y: -145 - i * 12 };
    const control2 = { x: end.x * .67, y: end.y + (upper ? 37 + i * 6 : -38) };
    return Array.from({ length: 17 }, (_, k) => {
      const a = k / 16, b = 1 - a;
      const calc = (axis: "x" | "y") => Math.round(b ** 3 * origin[axis] + 3 * b * b * a * control1[axis]
        + 3 * b * a * a * control2[axis] + a ** 3 * end[axis]);
      return { x: calc("x"), y: calc("y") };
    });
  });
}

