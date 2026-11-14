import type { Fighter } from "./combat";
import type { FuryState } from "./goku-fury";
import type { Move } from "./types";
import { justiceBeats, justiceDelay, pandemoniumActs, pandemoniumBeats, pandemoniumEase, type RocksActor } from "./xebec-pandemonium-acts";
export { justiceBeats, pandemoniumBeats, pandemoniumEase } from "./xebec-pandemonium-acts";

export const pandemoniumId = "pandemonium";
export const pandemoniumName = "PANDEMONIUM · A MALDIÇÃO DO ABISMO";
export const pandemoniumConfig = {
  cost: 100, duration: justiceBeats.end + justiceDelay, minimumComboScale: .66,
  hits: [
    { tick: pandemoniumBeats.cut, damage: 132, kind: "cleave", hold: 8 },
    { tick: pandemoniumBeats.rupture, damage: 202, kind: "ground", hold: 11 },
  ],
} as const;
export type PandemoniumState = FuryState & { hold: number };
export const pandemoniumMove: Move = {
  kind: pandemoniumId, super: true, cost: pandemoniumConfig.cost,
  startup: 14, active: 5, recovery: 31, damage: 0, stun: 0, blockstun: 16,
  push: 0, launch: 0, rank: 4, hitstop: 7, level: "mid", cancels: [],
  box: { x: 22, y: -145, w: 112, h: 62 },
  drive: { from: 5, to: 17, speed: 7.4 },
};
export function canStartPandemonium(f: Fighter) {
  return !f.airborne && !f.knockedDown && !f.match?.capture &&
    f.meter >= pandemoniumConfig.cost &&
    (["idle", "walk", "crouch", "dash", "jumpStart", "landing"].includes(f.state) ||
      f.hitConfirmed && f.canSuperCancel());
}
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(x, high));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function pandemoniumScene(s: PandemoniumState) {
  const t = s.tick - justiceDelay;
  if (t >= justiceBeats.gates) return justiceScene(s, t);
  const entry = justiceScene(s, justiceBeats.gates);
  return { ...pandemoniumActs(s, entry), fracture: 0, ocean: 0 };
}

function justiceScene(s: PandemoniumState, t: number) {
  const sign = s.facing, b = justiceBeats;
  const finaleCrew: RocksActor[] = [];
  const phase = t >= b.return ? "return" : t >= b.aftermath ? "crew-finale" :
    t >= b.rupture ? "rupture" : t >= b.rush ? "charge-rush" :
    "gates";
  const ease = (a: number, z: number) => pandemoniumEase(t, a, z);
  const gateFlight = ease(b.rupture, b.aftermath);
  const rush = ease(533, 571);
  const focal = clamp(s.targetX, sign > 0 ? 135 : 68, sign < 0 ? 1145 : 1212);
  const origin = focal - sign * 88;
  const openX = origin;
  const gateOrigin = 640 - sign * 365;
  const gateImpact = 640 - sign * 71;
  const lineup = clamp(openX, 393, 887);
  const arrival = ease(b.gates, b.gates + 23);
  const ar = t < b.aftermath ? mix(lineup, mix(gateOrigin, gateImpact, rush), arrival) : 640 - sign * 47;
  const afterCut = focal + sign * 270;
  const vx = mix(afterCut, 640 + sign * (27 + gateFlight * 380), arrival);
  const exiting = ease(b.return, b.end);
  const attacker = {
    x: Math.round(mix(ar, clamp(s.originX, 73, 1207), exiting)), y: 580, facing: sign,
    clip: t < b.rush ? "pandemoniumApproach" : t < b.aftermath ? "pandemoniumGate" : "pandemoniumOutro",
    tick: t < b.rush ? t - b.gates : t < b.aftermath ? t - b.rush : t - b.aftermath,
  };
  const victim = {
    x: Math.round(clamp(mix(vx, clamp(s.originX + sign * 272, 46, 1234), exiting), 44, 1236)),
    y: Math.round(580 - 109 * 4 * gateFlight * (1 - gateFlight)),
    facing: -sign,
    clip: t < b.rupture ? "grabbed" : t < b.aftermath ? "launched" : "downed",
    tick: t >= b.rupture ? t - b.rupture : t - 189,
  };
  const gateClose = ease(504, 534) * (1 - ease(548, 594)) * .75;
  const groupClose = ease(b.aftermath, 683) * (1 - ease(718, b.return)) * .31;
  const close = gateClose + groupClose;
  const shakeAge = t - b.rupture;
  const shake = shakeAge >= 0 && shakeAge < 17 ? (17 - shakeAge) * .82 : 0;
  const scale = 1 + close;
  const view = 640 / scale;
  const center = gateClose ? attacker.x + sign * 109 : 640;
  return {
    phase, attacker, victim, justiceTick: t, rocks: finaleCrew, prometheus: undefined,
    split: 0, darkness: 0,
    fracture: ease(b.rupture, b.aftermath + 25),
    ocean: ease(b.gates, b.gates + 23) * (1 - exiting),
    camera: {
      x: clamp(mix(640, center, Math.min(1, close * 1.5)), view, 1280 - view),
      y: mix(360, 436, Math.min(1, close * 1.4)), scale,
      shakeX: shake * (t % 3 - 1), shakeY: shake * ((t + 1) % 3 - 1) * .47,
    },
  };
}
