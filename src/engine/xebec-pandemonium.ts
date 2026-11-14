import type { Fighter } from "./combat";
import type { FuryState } from "./goku-fury";
import type { Move } from "./types";

export const pandemoniumId = "pandemonium";
export const pandemoniumName = "PANDEMONIUM · A MALDIÇÃO DO ABISMO";
export const pandemoniumBeats = {
  smile: 22, lift: 91, cut: 189, command: 253, crew: 296,
  gates: 424, rush: 510, rupture: 579, aftermath: 647, return: 732,
} as const;
export const pandemoniumConfig = {
  cost: 100, duration: 763, minimumComboScale: .66,
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
export function pandemoniumEase(tick: number, start: number, end: number) {
  const t = clamp((tick - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

export function pandemoniumScene(s: PandemoniumState) {
  const t = s.tick, sign = s.facing, b = pandemoniumBeats;
  const phase = t >= b.return ? "return" : t >= b.aftermath ? "crew-finale" :
    t >= b.rupture ? "rupture" : t >= b.rush ? "charge-rush" :
    t >= b.gates ? "gates" : t >= b.crew ? "rocks" : t >= b.command ? "command" :
    t >= b.cut ? "pandemonium" : t >= b.lift ? "lift" : t >= b.smile ? "smile" : "confirm";
  const ease = (a: number, z: number) => pandemoniumEase(t, a, z);
  const plant = ease(0, 31);
  const fly = ease(b.cut, b.command + 9);
  const gateFlight = ease(b.rupture, b.aftermath);
  const rush = ease(533, 571);
  const focal = clamp(s.targetX, sign > 0 ? 135 : 68, sign < 0 ? 1145 : 1212);
  const origin = focal - sign * 88;
  const openX = Math.round(mix(s.originX, origin, plant));
  const gateOrigin = 640 - sign * 365;
  const gateImpact = 640 - sign * 71;
  const lineup = clamp(openX, 393, 887);
  const crewEntry = ease(b.command, b.crew + 18);
  const arrival = ease(b.gates, b.gates + 23);
  const ar = t < b.gates ? mix(openX, lineup, crewEntry) :
    t < b.aftermath ? mix(lineup, mix(gateOrigin, gateImpact, rush), arrival) : 640 - sign * 47;
  const afterCut = mix(s.targetX, focal, plant) + sign * 270 * fly;
  const vx = t < b.gates ? afterCut :
    mix(afterCut, 640 + sign * (27 + gateFlight * 380), arrival);
  const exiting = ease(b.return, pandemoniumConfig.duration);
  const attacker = {
    x: Math.round(mix(ar, clamp(s.originX, 73, 1207), exiting)), y: 580, facing: sign,
    clip: t < b.command ? "pandemoniumScene" : t < b.gates ? "pandemoniumCommand" :
      t < b.rush ? "pandemoniumApproach" : t < b.aftermath ? "pandemoniumGate" : "pandemoniumOutro",
    tick: t < b.command ? t : t < b.gates ? t - b.command : t < b.rush ? t - b.gates :
      t < b.aftermath ? t - b.rush : t - b.aftermath,
  };
  const victim = {
    x: Math.round(clamp(mix(vx, clamp(s.originX + sign * 272, 46, 1234), exiting), 44, 1236)),
    y: Math.round(t < b.gates ? mix(s.targetY, 580, plant) - 122 * 4 * fly * (1 - fly) :
      580 - 109 * 4 * gateFlight * (1 - gateFlight)),
    facing: -sign,
    clip: t < b.cut || t >= b.gates && t < b.rupture ? "grabbed" : t < b.command || t >= b.rupture && t < b.aftermath ? "launched" : "downed",
    tick: t < b.cut ? t : t >= b.rupture ? t - b.rupture : t - b.cut,
  };
  const cutClose = ease(b.lift, 145) * (1 - ease(190, 236)) * .75;
  const gateClose = ease(504, 534) * (1 - ease(548, 594)) * .75;
  const groupClose = ease(b.aftermath, 683) * (1 - ease(718, b.return)) * .31;
  const close = cutClose + gateClose + groupClose;
  const shakeAge = t >= b.rupture ? t - b.rupture : t - b.cut;
  const shake = shakeAge >= 0 && shakeAge < 17 ? (17 - shakeAge) * (t >= b.rupture ? .82 : .54) : 0;
  const scale = 1 + close;
  const view = 640 / scale;
  const center = t < b.gates ? attacker.x + sign * mix(56, 121, fly) :
    gateClose ? attacker.x + sign * 109 : 640;
  return {
    phase, attacker, victim,
    split: ease(b.cut, b.cut + 32) * (1 - ease(b.command, b.crew)),
    darkness: ease(12, 72) * (1 - ease(b.crew - 30, b.gates)),
    fracture: ease(b.rupture, b.aftermath + 25),
    ocean: ease(b.gates, b.gates + 23) * (1 - exiting),
    camera: {
      x: clamp(mix(640, center, Math.min(1, close * 1.5)), view, 1280 - view),
      y: mix(360, 436, Math.min(1, close * 1.4)), scale,
      shakeX: shake * (t % 3 - 1), shakeY: shake * ((t + 1) % 3 - 1) * .47,
    },
  };
}
