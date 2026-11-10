import art from "../data/kaneki-special-art.json";
import type { CommandBuffer } from "./input";
import type { Button, Move, Point } from "./types";

export const kanekiSpecialArt = art;
export const kanekiStrengths = ["light", "medium", "heavy"] as const;
export type KanekiStrength = (typeof kanekiStrengths)[number];
export type KanekiFamily = "kaguneGrab" | "fourSwords" | "rinkakuRush";
type SpecialId = `${KanekiFamily}_${KanekiStrength}`;

const families = {
  kaguneGrab: [
    { startup: 15, active: 7, recovery: 25, reach: 278, damage: 0 },
    { startup: 20, active: 8, recovery: 32, reach: 330, damage: 0 },
    { startup: 27, active: 9, recovery: 43, reach: 382, damage: 0 },
  ],
  fourSwords: [
    { startup: 10, active: 6, recovery: 22, reach: 112, damage: 18 },
    { startup: 15, active: 7, recovery: 28, reach: 158, damage: 24 },
    { startup: 21, active: 8, recovery: 35, reach: 213, damage: 32 },
  ],
  rinkakuRush: [
    { startup: 7, active: 7, recovery: 16, reach: 84, damage: 44 },
    { startup: 11, active: 9, recovery: 23, reach: 100, damage: 59 },
    { startup: 16, active: 11, recovery: 31, reach: 122, damage: 76 },
  ],
} as const;
type Technique = {
  id: SpecialId; family: KanekiFamily; strength: KanekiStrength; rank: number;
  startup: number; active: number; recovery: number; reach: number; damage: number;
};
const techniques = new Map<string, Technique>();
export const kanekiSpecialMoves: Record<string, Move> = {};
for (const family of Object.keys(families) as KanekiFamily[]) {
  for (const [rank, strength] of kanekiStrengths.entries()) {
    const id: SpecialId = `${family}_${strength}`;
    const spec = { ...families[family][rank], id, family, strength, rank };
    techniques.set(id, spec);
    kanekiSpecialMoves[id] = {
      ...spec,
      rank: rank + 1, special: family, kind: family === "kaguneGrab" ? "grab" : "strike",
      level: family === "kaguneGrab" ? "throw" : "mid",
      stun: 20 + rank * 3, blockstun: 10 + rank * 2, hitstop: 5 + rank * 2,
      push: family === "fourSwords" ? 2 : 3 + rank * 1.2, launch: 0,
      box: family === "rinkakuRush" ? { x: 14, y: -100, w: 54, h: 56 } : { x: 0, y: 0, w: 0, h: 0 },
      cancels: [],
      ...(family === "rinkakuRush" ? {
        drive: { from: spec.startup - 3, to: spec.startup + spec.active, speed: [10, 14, 17][rank] },
      } : {}),
    };
  }
}
export const kanekiTechnique = (id?: string) => id ? techniques.get(id) : undefined;
export const kanekiTechniques = [...techniques.values()];
const motions: Record<string, KanekiFamily> = { ki: "kaguneGrab", kamehameha: "fourSwords", teleport: "rinkakuRush" };
export function kanekiSpecialCommand(buffer: CommandBuffer, button: Button) {
  if (button !== "light" && button !== "medium" && button !== "heavy") return;
  const motion = buffer.gokuSpecial(button, 25, 7, 20, 1);
  if (motion) return kanekiTechnique(`${motions[motion]}_${button}`)!;
}

export const kanekiSpecialNames: Record<KanekiFamily, string> = {
  kaguneGrab: "Kagune Grab", fourSwords: "Kagune: Four Swords", rinkakuRush: "Rinkaku Rush",
};
export function kanekiSpecialAttackHolds(t: Technique) {
  if (t.family === "fourSwords") return [t.startup, t.active, t.recovery];
  const lead = t.startup - 3;
  return [lead, 3, t.active, t.recovery];
}
const swords = [
  { snap: 11, strikes: [15, 20, 26], damage: [13, 14, 31], end: 35, travel: 71, push: 7.1, lift: 32, stop: 7 },
  { snap: 15, strikes: [20, 26, 33], damage: [17, 19, 45], end: 43, travel: 105, push: 9.2, lift: 42, stop: 9 },
  { snap: 19, strikes: [25, 32, 41], damage: [24, 26, 60], end: 53, travel: 145, push: 12, lift: 53, stop: 12 },
] as const;
const rush = [
  { end: 18, damage: 65, travel: 69, push: 5.7, lift: 19, stop: 6, recovery: 9 },
  { end: 24, damage: 89, travel: 118, push: 8.6, lift: 32, stop: 8, recovery: 14 },
  { end: 30, damage: 119, travel: 161, push: 12.8, lift: 48, stop: 11, recovery: 20 },
] as const;
export const swordProfile = (rank: number) => swords[rank];
export const rushProfile = (rank: number) => rush[rank];
export const rushTipLive = (rank: number, activeAge: number) => activeAge >= (rank === 2 ? 3 : 2);

const fraction = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = fraction(n); return t * t * (3 - 2 * t); };
export function kanekiSpecialScene(id: string, tick: number, origin: Point, contact: Point, facing: number) {
  const t = kanekiTechnique(id)!;
  const rank = t.rank;
  if (t.family === "fourSwords") {
    const p = swordProfile(rank), first = p.strikes[0], last = p.strikes[2];
    const push = ease((tick - last) / (p.end - 1 - last));
    const float = ease(tick / 9);
    const recoil = p.strikes.reduce((sum, strike) => sum + Math.max(0, 1 - Math.abs(tick - strike) / 4) * (rank + 1) * 2, 0);
    const snapStart = p.snap - 4;
    const strike = p.strikes.findIndex(at => at === tick);
    const clip = tick < snapStart ? "swordsHold" : tick < p.snap + 8 ? "swordsSnap"
      : tick < last - 2 ? (rank === 2 ? "swordsHeavy" : "swordsDrive") : "swordsThrow";
    const clipTick = clip === "swordsHold" ? tick : clip === "swordsSnap" ? tick - snapStart
      : clip === "swordsThrow" ? tick - last + 2 : tick - p.snap - 8;
    return {
      clip, clipTick, end: p.end, impact: strike >= 0 ? p.damage[strike] : 0, strength: strike === 2 ? 3 : 2,
      snap: tick === p.snap, flash: Math.abs(tick - last) < 2 ? 0.12 + rank * 0.07 : 0,
      snapPose: clip === "swordsSnap" ? (clipTick < 4 ? 0 : clipTick < 9 ? 1 : 2) : undefined,
      victim: {
        x: contact.x + facing * (p.travel * push + recoil),
        y: contact.y - p.lift * float - recoil * 0.8 + 15 * push,
      },
      hurt: tick < first ? "launched" : tick >= last ? "falling" : "damageAir",
      push: p.push, lift: -4 - rank * 0.6, recovery: 14 + rank * 5, stop: strike === 2 ? p.stop : strike >= 0 ? 2 : 0,
    };
  }
  const p = rushProfile(rank);
  const tossAt = Math.floor(p.end * .66);
  const reel = ease(tick / (rank === 0 ? 7 : 9));
  const toss = ease((tick - tossAt + 1) / (p.end - tossAt));
  const gap = (contact.x - origin.x) * facing;
  const start = rank === 0 ? 55 : rank === 1 ? 67 : 76;
  const x = gap + (start - gap) * reel + p.travel * toss;
  const rise = fraction((tick + 1) / (p.end + 4));
  return {
    clip: `rushFinish_${t.strength}`, clipTick: tick, end: p.end, impact: tick === tossAt ? p.damage : 0, strength: rank === 2 ? 3 : 2,
    snap: false, snapPose: undefined, flash: tick === tossAt && rank === 2 ? .13 : 0,
    victim: { x: origin.x + facing * x, y: contact.y - p.lift * 4 * rise * (1 - rise) },
    hurt: tick < tossAt ? "grabbed" : "damageAir",
    push: p.push, lift: -3 - rank, recovery: p.recovery, stop: tick === tossAt ? p.stop : 0,
  };
}

