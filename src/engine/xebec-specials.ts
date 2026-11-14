import type { CommandBuffer } from "./input";
import type { Capsule, HitWindow, Move, Point, Rect } from "./types";

export const kingWill = "xebecKingWill";
const commands = {
  ki: { light: "xebecFangs", medium: "xebecDance", heavy: "xebecCarnage" },
  kamehameha: { light: "xebecCut", medium: "xebecRift", heavy: "xebecTriple" },
  teleport: { light: "xebecPulse", medium: "xebecSovereign", heavy: kingWill },
} as const;

type Strength = keyof typeof commands.ki;
export type XebecSpecial = (typeof commands)[keyof typeof commands][Strength];
const ids = new Set<string>(Object.values(commands).flatMap(Object.values));
export function isXebecSpecial(id: string | undefined): id is XebecSpecial {
  return id !== undefined && ids.has(id);
}

export function xebecSpecialCommand(buffer: CommandBuffer, button: Strength) {
  const motion = buffer.gokuSpecial(button);
  return motion && commands[motion][button];
}

type Art = { sheet: string; frames: number[]; durations: number[] };
const art = (sheet: string, frames: number[], durations: number[]): Art => ({ sheet, frames, durations });
const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
type Wave = {
  tick: number; x: number; y: number; speed: number; vy: number;
  radius: number; life: number; damage: number; level: Move["level"]; push: number;
  halfLength: number; slope: number; rank: number;
};
const waves = {
  xebecSingleWave: { tick: 10, x: 94, y: -96, speed: 18, vy: 0, radius: 14, halfLength: 48, slope: -.24, life: 32, damage: 55, level: "mid", push: 5, rank: 1 },
  xebecRiftWave: { tick: 16, x: 83, y: -100, speed: 16, vy: .48, radius: 15, halfLength: 55, slope: -.69, life: 40, damage: 42, level: "mid", push: 4, rank: 2 },
  xebecRiftRise: { tick: 35, x: 87, y: -109, speed: 14, vy: -1.1, radius: 16, halfLength: 61, slope: .54, life: 43, damage: 48, level: "mid", push: 6, rank: 2 },
  xebecLowWave: { tick: 19, x: 94, y: -91, speed: 17, vy: 0, radius: 15, halfLength: 57, slope: -.17, life: 46, damage: 35, level: "mid", push: 3.4, rank: 3 },
  xebecMidWave: { tick: 41, x: 85, y: -104, speed: 15, vy: .43, radius: 16, halfLength: 65, slope: -.65, life: 48, damage: 39, level: "mid", push: 4.2, rank: 3 },
  xebecHighWave: { tick: 63, x: 87, y: -127, speed: 14, vy: -1.35, radius: 18, halfLength: 81, slope: .64, life: 50, damage: 48, level: "mid", push: 7, rank: 3 },
} satisfies Record<string, Wave>;
type WaveId = keyof typeof waves;
export function xebecProjectile(id: string): Wave | undefined {
  return Object.hasOwn(waves, id) ? waves[id as WaveId] : undefined;
}
export function xebecWaveVolume(wave: Wave, x: number, y: number, facing: number, radius: number) {
  return {
    a: { x: x - facing * wave.halfLength * wave.slope, y: y - wave.halfLength },
    b: { x: x + facing * wave.halfLength * wave.slope, y: y + wave.halfLength },
    r: radius,
  };
}
export const xebecReleases: Partial<Record<XebecSpecial, readonly WaveId[]>> = {
  xebecCut: ["xebecSingleWave"], xebecRift: ["xebecRiftWave", "xebecRiftRise"], xebecTriple: ["xebecLowWave", "xebecMidWave", "xebecHighWave"],
};
export function xebecProjectileMove(id: string): Move | undefined {
  const wave = xebecProjectile(id);
  if (!wave) return;
  return {
    startup: 0, active: 1, recovery: 0, damage: wave.damage,
    level: wave.level, box: rect(0, 0, 0, 0), rank: wave.rank,
    blockstun: 10, stun: wave.rank === 1 ? 22 : 17,
    push: wave.push, launch: 0, hitstop: 4, cancels: [],
    comboHitLimit: 7, meterGain: 5,
  };
}


export const xebecSpecialArt: Record<XebecSpecial, Art> = {
  xebecFangs: art("eclipse-fangs", [0,1,2,3,4,5,6,7], [4,4,4,5,4,5,7,9]),
  xebecDance: art("eclipse-dance", [0,1,2,3,4,5,6,7], [5,6,4,6,4,7,5,22]),
  xebecCarnage: art("eclipse-carnage", [0,1,2,3,4,5,6,7,8,9,10,11], [6,8,4,7,4,6,5,5,4,6,8,23]),
  xebecCut: art("eclipse-ruptures", [0,1,2,3], [10,7,8,13]),
  xebecRift: art("eclipse-ruptures", [4,5,6,7,3], [16,9,10,9,25]),
  xebecTriple: art("eclipse-ruptures", [8,9,4,5,6,11,2,3], [19,10,12,11,11,9,9,27]),
  xebecPulse: art("haki-pressure", [0,1,2,3], [4,5,7,16]),
  xebecSovereign: art("haki-pressure", [4,5,6,7], [7,10,11,25]),
  xebecKingWill: art("haki-pressure", [8,9,10,11], [12,22,16,27]),
};

type HakiRelease = { kind: "burst" | "conqueror"; release: number; active: number; radius: number; height: number };
const pressure = {
  xebecPulse: { kind: "burst", release: 9, active: 7, radius: 116, height: 75 },
  xebecSovereign: { kind: "burst", release: 17, active: 11, radius: 196, height: 94 },
  xebecKingWill: { kind: "conqueror", release: 34, active: 16, radius: 373, height: 159 },
} satisfies Record<string, HakiRelease>;

export function xebecPressure(id: string): HakiRelease | undefined {
  return Object.hasOwn(pressure, id) ? pressure[id as keyof typeof pressure] : undefined;
}

export function xebecPressureReach(p: HakiRelease, tick: number) {
  const age = Math.max(0, Math.min(1, (tick - p.release) / (p.active - 1)));
  return p.radius * (.36 + .64 * (1 - (1 - age) ** 2));
}

// Three horizontal capsule bands approximate the visible low ellipse without
// granting its full radius to opponents well above the attack.
export function xebecPressureVolumes(p: HakiRelease, tick: number, x: number, y: number): Capsule[] {
  const reach = xebecPressureReach(p, tick);
  return [-.6, 0, .6].map(band => {
    const r = p.height * .32;
    const half = Math.max(0, reach * (1 - Math.abs(band) * .25) - r);
    const height = y - 75 + p.height * band;
    return { a: { x: x - half, y: height }, b: { x: x + half, y: height }, r };
  });
}

type Sword = readonly [number, number, number, number];
export function xebecArtFrame(clip: Art, tick: number) {
  for (const [i, duration] of clip.durations.entries()) {
    if (tick < duration) return clip.frames[i];
    tick -= duration;
  }
  return clip.frames.at(-1)!;
}

const blades: Record<string, readonly Sword[]> = {
  "eclipse-fangs": [[-18,-67,48,-21],[-38,-91,-85,-80],[22,-96,78,-96],[13,-86,-25,-56],[16,-81,67,-48],[8,-64,60,-34],[-15,-67,45,-28],[-18,-67,46,-23]],
  "eclipse-dance": [[-20,-66,46,-26],[-22,-71,51,-20],[18,-94,99,-93],[17,-103,-61,-139],[-9,-64,70,-16],[-21,-42,50,-5],[10,-120,84,-154],[-21,-66,49,-25]],
  "eclipse-carnage": [[-17,-66,46,-24],[-43,-72,-80,-18],[38,-89,91,-94],[39,-65,84,-46],[16,-55,62,-7],[-18,-61,65,-76],[15,-120,74,-154],[20,-102,58,-148],[-10,-140,-58,-113],[5,-48,67,-17],[17,-39,85,-10],[-19,-72,56,-22]],
  "eclipse-ruptures": [[-20,-59,40,-17],[3,-90,91,-90],[11,-41,96,-23],[-20,-54,49,-17],[-49,-131,12,-151],[2,-77,70,-31],[-28,-39,38,-6],[26,-116,87,-144],[-72,-116,-97,-49],[10,-86,102,-86],[14,-101,81,-124],[32,-128,87,-161]],
  "haki-pressure": [[-16,-60,45,-11],[-59,-64,37,-12],[-51,-72,-3,-8],[-53,-68,54,-14],[-37,-50,-3,-20],[-35,-70,32,-32],[-70,-69,-117,-25],[-56,-65,48,-5],[-49,-64,36,-10],[5,-72,60,-28],[-72,-56,-97,-10],[-55,-64,43,-5]],
};
export function xebecRisingSweep(id: XebecSpecial, window: HitWindow) {
  if (window.id === 2 && (id === "xebecDance" || id === "xebecCarnage")) {
    const before = xebecBladeAt(id, window.fromTick - 1);
    const after = xebecBladeAt(id, window.fromTick);
    return { a: before.tip, b: after.tip, r: 13 };
  }
}

const fallback = [-23, -61, 35, -17] as const;
export function xebecBladeAt(id: string, tick: number): { grip: Point; tip: Point } {
  const clip = isXebecSpecial(id) ? xebecSpecialArt[id] : undefined;
  const [x,y,tx,ty] = clip ? blades[clip.sheet][xebecArtFrame(clip, tick)] : fallback;
  return { grip: { x, y }, tip: { x: tx, y: ty } };
}

export function makeXebecSpecials(standing: Rect[], crouching: Rect[]): Record<XebecSpecial, Move> {
  function move(id: XebecSpecial, rank: number, startup: number, end: number, windows: HitWindow[], values: Partial<Move>): Move {
    const recovery = xebecSpecialArt[id].durations.reduce((a, b) => a + b, 0) - end;
    const boundaries = [...new Set([0, startup, end, end + recovery, ...windows.flatMap(h => [h.fromTick, h.toTick])])]
      .sort((a, b) => a - b);
    return {
      special: id, startup, active: end - startup, recovery, rank, damage: 0,
      level: "mid", box: rect(0,0,0,0), stun: 20, blockstun: 10, push: 2,
      launch: 0, hitstop: 4, cancels: [], comboHitLimit: 8, meterGain: 4,
      hitWindows: windows.length ? windows : undefined,
      poses: boundaries.slice(0,-1).map((tick,i) => ({
        ticks: boundaries[i+1] - tick,
        phase: tick < startup ? "startup" : tick < end ? "active" : "recovery",
        hurtboxes: rank > 1 && tick < startup / 2 ? crouching : standing,
        hitboxes: [],
      })),
      ...values,
    };
  }
  const bladeCombo = (id: XebecSpecial, rank: number, ticks: number[], damage: number[], drive: number) => {
    const windows = ticks.map((fromTick, i): HitWindow => ({
      id: i, fromTick, toTick: fromTick + (i === ticks.length - 1 ? 5 : 4),
      damage: damage[i],
      ...(i === ticks.length - 1 && rank === 2 ? { launch: -12.5, stun: 30, push: 2.5 } : {}),
      ...(i === ticks.length - 1 && rank === 3 ? { launch: -8, stun: 29, push: 13, knockdown: true } : {}),
    }));
    const end = windows.at(-1)!.toTick;
    return move(id, rank, ticks[0], end, windows, {
      damage: damage[0], push: 1.25, stun: 22,
      drive: { from: 2, to: ticks[0] + 1, speed: drive },
      ...(rank === 2 ? { cancels: ["jump"], cancelWindow: { fromTick: ticks[2], toTick: end + 4 } } : {}),
    });
  };
  const burst = (id: keyof typeof pressure, rank: number, damage: number, push: number, stun: number) => {
    const p = pressure[id];
    return move(id, rank, p.release, p.release + p.active, [], { damage, push, stun,
      hitstop: rank + 3, blockstun: 10 + rank, meterGain: rank === 3 ? 0 : 5 });
  };
  return {
    xebecFangs: bladeCombo("xebecFangs", 1, [8, 17], [28, 34], 2.3),
    xebecDance: bladeCombo("xebecDance", 2, [11, 21, 32], [24, 30, 42], 3.2),
    xebecCarnage: bladeCombo("xebecCarnage", 3, [14, 25, 35, 49], [26, 29, 34, 60], 3.7),
    xebecCut: move("xebecCut", 1, 10, 17, [], {}),
    xebecRift: move("xebecRift", 2, 16, 44, [], {}),
    xebecTriple: move("xebecTriple", 3, 19, 72, [], {}),
    xebecPulse: burst("xebecPulse", 1, 45, 5.5, 16),
    xebecSovereign: burst("xebecSovereign", 2, 71, 8, 20),
    xebecKingWill: burst(kingWill, 3, 123, 7.5, 24),
  };
}
