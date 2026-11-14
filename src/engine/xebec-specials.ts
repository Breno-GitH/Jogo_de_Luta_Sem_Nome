import type { CommandBuffer } from "./input";
import type { AttackShape, CharacterData, HitWindow, Move, Point, Rect } from "./types";

const commands = {
  ki: { light: "xebecThrust", medium: "xebecAscension", heavy: "xebecGatebreaker" },
  kamehameha: { light: "xebecCut", medium: "xebecRift", heavy: "xebecTriple" },
  teleport: { light: "xebecBrutal", medium: "xebecDominion", heavy: "xebecExplosion" },
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
const sword = (ax: number, ay: number, bx: number, by: number, r = 10) =>
  ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, r });
const thrust = sword(34, -114, 110, -114, 11);
const rising = sword(30, -92, 81, -166, 15);

type Grab = NonNullable<CharacterData["grabSequence"]>;
type Wave = {
  tick: number; x: number; y: number; speed: number; vy: number;
  radius: number; life: number; damage: number; level: Move["level"]; push: number;
  halfLength: number; slope: number; rank: number;
};
const waves = {
  xebecSingleWave: { tick: 9, x: 94, y: -96, speed: 18, vy: 0, radius: 14, halfLength: 48, slope: -.24, life: 32, damage: 55, level: "mid", push: 5, rank: 1 },
  xebecRiftWave: { tick: 14, x: 83, y: -100, speed: 16, vy: .48, radius: 15, halfLength: 55, slope: -.69, life: 40, damage: 42, level: "mid", push: 4, rank: 2 },
  xebecRiftRise: { tick: 32, x: 85, y: -74, speed: 14, vy: -1.1, radius: 16, halfLength: 61, slope: .54, life: 43, damage: 48, level: "mid", push: 6, rank: 2 },
  xebecLowWave: { tick: 16, x: 94, y: -91, speed: 17, vy: 0, radius: 15, halfLength: 57, slope: -.17, life: 46, damage: 35, level: "mid", push: 3.4, rank: 3 },
  xebecMidWave: { tick: 35, x: 85, y: -104, speed: 15, vy: .43, radius: 16, halfLength: 65, slope: -.65, life: 48, damage: 39, level: "mid", push: 4.2, rank: 3 },
  xebecHighWave: { tick: 55, x: 90, y: -76, speed: 14, vy: -1.35, radius: 18, halfLength: 81, slope: .64, life: 50, damage: 48, level: "mid", push: 7, rank: 3 },
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
export function xebecProjectileMove(id: string, powered: boolean): Move | undefined {
  const wave = xebecProjectile(id);
  if (!wave) return;
  return {
    startup: 0, active: 1, recovery: 0, damage: wave.damage + (powered ? wave.rank === 1 ? 13 : 6 : 0),
    level: wave.level, box: rect(0, 0, 0, 0), rank: wave.rank,
    blockstun: 10, stun: wave.rank === 1 ? 22 : 17,
    push: wave.push + (powered ? 1.3 : 0), launch: 0, hitstop: 4, cancels: [],
    comboHitLimit: 7, meterGain: 5,
  };
}

type Active = { hit: HitWindow; shape: AttackShape };
const swing = (id: number, from: number, to: number, shape: AttackShape, props: Partial<HitWindow> = {}): Active =>
  ({ hit: { id, fromTick: from, toTick: to, ...props }, shape });
const grapples = {
  xebecBrutal: { from: 8, to: 12, blast: 15, active: 4, reach: 60, damage: 23, held: 13, launch: -4, push: 8, recovery: 15, grabDamage: 76, drive: 8 },
  xebecDominion: { from: 11, to: 16, blast: 21, active: 6, reach: 104, damage: 33, held: 23, launch: -15, push: 3, recovery: 23, grabDamage: 93, drive: 8.7 },
  xebecExplosion: { from: 16, to: 21, blast: 28, active: 6, reach: 112, damage: 50, held: 33, launch: -8, push: 13, recovery: 34, grabDamage: 131, drive: 9.5 },
};
export type XebecGrapple = keyof typeof grapples;
export const xebecGrapple = (id: string) =>
  Object.hasOwn(grapples, id) ? grapples[id as XebecGrapple] : undefined;
export function xebecGrabTrack(id: XebecGrapple, powered: boolean): Grab {
  const p = grapples[id];
  const lift = id === "xebecDominion" ? 50 : id === "xebecExplosion" ? 21 : 8;
  return {
    startFromContact: true, duration: p.held + 4, hitTick: p.held, recoveryTicks: id === "xebecDominion" ? 9 : p.recovery,
    damage: p.grabDamage + (powered ? 18 : 0),
    victimTrack: [
      { tick: 0, x: 67, y: 0, clip: "grabbed" },
      { tick: 6, x: 53, y: -lift, clip: "grabbed" },
      { tick: p.held, x: 63, y: -lift, clip: "launched" },
      { tick: p.held + 4, x: 76, y: -lift, clip: "launched" },
    ],
    release: { vx: p.push + (powered && id !== "xebecDominion" ? 3 : 0), vy: p.launch, stun: id === "xebecDominion" ? 35 : 26 },
  };
}

export const xebecSpecialArt: Record<XebecSpecial, Art> = {
  xebecThrust: art("gates", [0, 1, 2, 3], [7, 5, 4, 12]),
  xebecAscension: art("gates", [4, 0, 5, 6, 7, 3], [5, 6, 7, 6, 6, 17]),
  xebecGatebreaker: art("gates", [4, 0, 5, 6, 7, 3], [10, 6, 9, 8, 14, 19]),
  xebecCut: art("giant-cuts", [0, 1, 2, 7], [9, 6, 6, 14]),
  xebecRift: art("giant-cuts", [0, 2, 3, 4, 5, 6, 7], [7, 7, 6, 7, 5, 7, 27]),
  xebecTriple: art("giant-cuts", [0, 1, 2, 3, 4, 5, 6, 7], [16, 8, 11, 8, 7, 5, 7, 32]),
  xebecBrutal: art("rush", [0, 1, 2, 3, 7], [4, 4, 7, 4, 15]),
  xebecDominion: art("rush", [0, 5, 1, 2, 4, 6, 7], [5, 3, 3, 5, 5, 6, 23]),
  xebecExplosion: art("rush", [5, 0, 1, 2, 5, 6, 7], [8, 4, 4, 5, 7, 6, 34]),
};

export function makeXebecSpecials(standing: Rect[], crouching: Rect[]) {
  function move(rank: number, startup: number, end: number, recovery: number, damage: number,
    windows: Active[], options: Partial<Move> = {}): Move {
    const boundaries = [...new Set([0, startup, end, end + recovery,
      ...windows.flatMap(({ hit }) => [hit.fromTick, hit.toTick])])].sort((a, b) => a - b);
    return {
      startup, active: end - startup, recovery, rank, damage, level: "mid",
      box: rect(0, 0, 0, 0), stun: 25, blockstun: 12, push: 3, launch: 0,
      hitstop: 5, cancels: [], hitWindows: windows.length ? windows.map(w => w.hit) : undefined,
      poses: boundaries.slice(0, -1).map((tick, i) => ({
        ticks: boundaries[i + 1] - tick,
        phase: tick < startup ? "startup" : tick < end ? "active" : "recovery",
        hurtboxes: rank >= 2 && tick < startup / 2 ? crouching : standing,
        hitboxes: windows.filter(({ hit }) => tick >= hit.fromTick && tick < hit.toTick).map(w => w.shape),
      })),
      ...options,
    };
  }
  const grabMove = (id: XebecGrapple, rank: number) => {
    const p = grapples[id];
    const wave = id === "xebecDominion" ? rect(12, -116, p.reach, 112) :
      rect(-p.reach, -100, p.reach * 2, 98);
    return move(rank, p.from, p.blast + p.active, p.recovery, p.damage, [
      swing(0, p.from, p.to, rect(26, -125, 42, 57)),
      swing(1, p.blast, p.blast + p.active, wave),
    ], {
      drive: { from: Math.max(2, p.from - 7), to: p.to, speed: p.drive },
      push: id === "xebecExplosion" ? 10 : 5, blockstun: 9, stun: 19,
    });
  };
  const moves: Record<XebecSpecial, Move> = {
    xebecThrust: move(1, 7, 16, 12, 52, [
      swing(0, 7, 12, thrust), swing(1, 12, 16, rising, { damage: 27, push: 3 }),
    ], { drive: { from: 2, to: 11, speed: 8.8 }, push: 2, stun: 25 }),
    xebecAscension: move(2, 11, 24, 23, 43, [
      swing(0, 11, 17, thrust), swing(1, 18, 24, rising, { damage: 58, launch: -15, stun: 36, push: 1.7 }),
    ], {
      drive: { from: 4, to: 15, speed: 9.2 }, push: 1.3,
      cancels: ["jump"], cancelWindow: { fromTick: 18, toTick: 30 },
    }),
    xebecGatebreaker: move(3, 16, 33, 33, 63, [
      swing(0, 16, 23, thrust), swing(1, 25, 33, sword(30, -62, 99, -169, 18), {
        damage: 89, launch: -10, push: 12, stun: 33, knockdown: true,
      }),
    ], { drive: { from: 6, to: 20, speed: 9.6 }, stun: 29, push: 1.8, hitstop: 8 }),
    xebecCut: move(1, 9, 15, 20, 0, []),
    xebecRift: move(2, 14, 39, 27, 0, []),
    xebecTriple: move(3, 16, 62, 32, 0, []),
    xebecBrutal: grabMove("xebecBrutal", 1),
    xebecDominion: grabMove("xebecDominion", 2),
    xebecExplosion: grabMove("xebecExplosion", 3),
  };
  for (const id of Object.keys(moves) as XebecSpecial[]) moves[id].special = id;
  const powered = Object.fromEntries(Object.entries(moves).map(([id, m]) => [id, {
    ...m, damage: m.damage ? m.damage + 12 : 0, hitstop: (m.hitstop ?? 5) + 2,
    hitWindows: m.hitWindows?.map(hit => ({
      ...hit, ...(hit.damage === undefined ? {} : { damage: hit.damage + 10 }),
      ...(hit.push === undefined ? {} : { push: hit.push + (id === "xebecAscension" ? 0 : 2) }),
    })),
  }])) as Record<string, Move | undefined>;
  return { moves, powered };
}

export function gateGuard(id: string) {
  return id === "xebecThrust" ? 1 : id === "xebecAscension" ? 2 : id === "xebecGatebreaker" ? 3 : 0;
}

export function xebecGripActive(id: string, tick: number) {
  const grab = xebecGrapple(id);
  return !!grab && tick >= grab.from && tick < grab.to;
}

export function xebecBladeAt(id: string, tick: number): { grip: Point; tip: Point } {
  if (gateGuard(id) && tick >= (id === "xebecThrust" ? 12 : id === "xebecAscension" ? 18 : 25))
    return { grip: { x: 30, y: -87 }, tip: { x: 75, y: -158 } };
  if (gateGuard(id)) return { grip: { x: 29, y: -103 }, tip: { x: 108, y: -105 } };
  if (isXebecSpecial(id) && xebecReleases[id]) {
    const clip = xebecSpecialArt[id];
    let elapsed = tick, frame = clip.frames[0];
    for (let i = 0; i < clip.frames.length; i++) {
      frame = clip.frames[i];
      if (elapsed < clip.durations[i]) break;
      elapsed -= clip.durations[i];
    }
    const anchors = [
      [-33,-89,-74,-110], [22,-106,104,-104], [1,-124,43,-157], [24,-77,89,-40],
      [-22,-55,-62,-91], [22,-74,64,-121], [40,-111,98,-173], [-22,-64,34,-20],
    ];
    const [x,y,tx,ty] = anchors[frame];
    return { grip: { x,y }, tip: { x: tx,y: ty } };
  }
  return { grip: { x: -23, y: -61 }, tip: { x: 35, y: -17 } };
}
