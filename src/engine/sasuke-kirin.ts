import config from "../data/sasuke-kirin.json";
import art from "../data/sasuke-kirin-art.json";
import type { Fighter } from "./combat";
import type { FuryState } from "./goku-fury";
import type { CombatPose, Move } from "./types";

export { config as kirinConfig, art as kirinArt };
export const kirinId = "kirin_start";
export interface KirinState extends FuryState {
  hold: number;
  cursed: boolean;
  storm: number;
}

function opener(cursed: boolean): Move {
  const { holds, ...stats } = config.opening;
  const [startup, active, recovery] = holds;
  const cels: Omit<CombatPose, "ticks" | "phase">[] = cursed ? art.curse : art.base;
  return {
    ...stats, startup, active, recovery,
    kind: "kirin", super: true, cost: config.cost, meterGain: 0,
    rank: 3, level: "mid", launch: 0, cancels: [], box: { x: 0, y: 0, w: 0, h: 0 },
    poses: holds.map((ticks, i) => ({
      ...cels[i],
      ticks,
      phase: i === 0 ? "startup" : i === 1 ? "active" : "recovery",
    })),
  };
}
export const kirinOpener = opener(false);
export const kirinCurseOpener = opener(true);

export function canStartKirin(f: Fighter) {
  const phase = f.sasukeCurse?.phase;
  return (
    f.meter >= f.meterMaximum && !f.airborne &&
    !f.match?.capture &&
    (!phase || phase === "active" || phase === "cooldown") &&
    (["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(f.state) ||
      (f.hitConfirmed && f.canSuperCancel()))
  );
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const progress = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const smooth = (t: number) => t * t * (3 - 2 * t);
const floor = 580;
const p = config.phases;

export function kirinScene(s: KirinState) {
  const t = s.tick, f = s.facing;
  const land = smooth(progress(t, 0, 14));
  const afterImpact = t - p.impact;
  const recoil = smooth(progress(t, p.impact, p.impact + 13));
  const targetX = clamp(s.targetX + 33 * f * recoil, 40, 1240);
  const actor = {
    x: s.originX, y: floor, facing: f,
    clip: t < p.command ? "kirinPrepare" : t < p.dive ? "kirinCommand" : "kirinRelease",
    tick: t < p.command ? t : t < p.dive ? t - p.command : t - p.dive,
  };
  const victim = {
    x: targetX,
    y: mix(s.targetY, floor, land) - (afterImpact >= 0 && afterImpact < 16
      ? 34 * Math.sin(Math.PI * afterImpact / 16) : 0),
    facing: -f,
    clip: t < p.impact ? "damageMedium" : afterImpact < 16 ? "damageAir" : "downed",
    tick: t < p.impact ? Math.min(7, t) : afterImpact < 16 ? afterImpact : afterImpact - 16,
  };
  const phase = t < p.storm ? "prepare" : t < p.reveal ? "storm"
    : t < p.command ? "reveal" : t < p.dive ? "command"
      : t < p.impact ? "dive" : t < p.clear ? "impact" : "clear";
  const center = (s.originX + s.targetX) / 2;
  const keys = [
    [0, 640, 360, 1],
    [p.storm - 1, s.originX + f * 25, 449, 1.30],
    [p.storm + 16, s.targetX, 229, 1.08],
    [p.command - 1, s.targetX, 240, 1.07],
    [p.command + 5, s.originX + f * 9, 445, 1.39],
    [p.dive - 1, center, 421, 1.26],
    [p.dive + 6, s.targetX, 347, 1.08],
    [p.impact + 5, s.targetX, 464, 1.24],
    [p.clear, center, 411, 1.13],
    [config.duration, 640, 360, 1],
  ];
  const next = keys.findIndex(k => t <= k[0]);
  const a = keys[Math.max(0, next - 1)], b = keys[Math.max(0, next)];
  const u = a === b ? 0 : smooth(progress(t, a[0], b[0]));
  const scale = mix(a[3], b[3], u);
  const shake = afterImpact >= 0 ? Math.max(0, 12 - afterImpact) : 0;
  const facing = s.targetX < 420 ? -1 : s.targetX > 860 ? 1 : f;
  const descent = progress(t, p.dive, p.impact);
  const dragon = {
    visible: phase === "reveal" || phase === "dive" || afterImpact === 0,
    cel: t < p.dive ? Math.floor(Math.max(0, t - p.reveal) / 13) % 2 : descent < .45 ? 2 : 3,
    alpha: t < p.dive ? smooth(progress(t, p.reveal, p.reveal + 17)) : 1,
    facing,
    x: t < p.dive
      ? clamp(s.targetX + facing * 160, 390, 890) + Math.sin((t - p.reveal) * .16) * 16
      : mix(clamp(s.targetX - facing * 174, 130, 1150), s.targetX, descent),
    y: t < p.dive ? 223 + 8 * Math.sin(t * .12) : mix(164, floor - 53, descent ** 2.25),
    scale: t < p.dive ? 1.23 + Math.sin(t * .19) * .028 : mix(1.10, 1.40, descent),
  };
  const clear = 1 - smooth(progress(t, p.clear, config.duration));
  const clouds = Math.min(1, .18 * s.storm + smooth(progress(t, 0, p.reveal))) * clear;
  return {
    attacker: actor, victim, phase, dragon, clouds,
    camera: {
      x: clamp(mix(a[1], b[1], u), 640 / scale, 1280 - 640 / scale),
      y: mix(a[2], b[2], u), scale,
      shakeX: shake * ((t + s.hold) % 2 ? 1 : -1),
      shakeY: Math.floor(shake * .42) * ((t + s.hold) % 3 ? 1 : -1),
    },
  };
}
