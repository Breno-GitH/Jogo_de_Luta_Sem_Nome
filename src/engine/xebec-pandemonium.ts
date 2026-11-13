import type { Fighter } from "./combat";
import type { FuryState } from "./goku-fury";
import type { Move } from "./types";

export const pandemoniumId = "pandemonium";
export const pandemoniumName = "PANDEMONIUM · A MALDIÇÃO DO ABISMO";
export const pandemoniumConfig = {
  cost: 100, duration: 248, minimumComboScale: .66,
  hits: [{ tick: 143, damage: 306, kind: "ground", hold: 10 }],
} as const;
export type PandemoniumState = FuryState & { hold: number };
export const pandemoniumMove: Move = {
  kind: pandemoniumId, super: true, cost: pandemoniumConfig.cost,
  startup: 14, active: 5, recovery: 35, damage: 28, stun: 18, blockstun: 0,
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
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));
const blend = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (tick: number, start: number, end: number) => {
  const t = clamp((tick - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
};

export function pandemoniumScene(s: PandemoniumState) {
  const t = s.tick, sign = s.facing, strike = pandemoniumConfig.hits[0].tick;
  const plant = ease(t, 0, 36);
  const flight = ease(t, strike, 211);
  const focal = clamp(s.targetX, sign > 0 ? 116 : 54, sign < 0 ? 1164 : 1226);
  const attacker = {
    x: Math.round(blend(s.originX, focal - sign * 86, plant)), y: 580,
    facing: sign, clip: "pandemoniumScene", tick: t,
  };
  const victim = {
    x: Math.round(clamp(blend(s.targetX, focal, plant) + sign * flight * 255, 44, 1236)),
    y: Math.round(blend(s.targetY, 580, plant) - 95 * 4 * flight * (1 - flight)),
    facing: -sign, clip: t < strike ? "grabbed" : t < 195 ? "launched" : "downed",
    tick: t < strike ? t : t - strike,
  };
  const close = ease(t, 8, 61) * (1 - ease(t, 130, 161));
  const wide = ease(t, strike, 170) * (1 - ease(t, 212, 245));
  const scale = 1 + close * .65 - wide * .06;
  const view = Math.min(640, 640 / scale);
  const center = attacker.x + sign * blend(57, 135, ease(t, 90, 138));
  return {
    attacker, victim,
    split: ease(t, strike + 3, 188) * (1 - ease(t, 218, 246)),
    darkness: ease(t, 5, 43) * (1 - ease(t, 211, 247)),
    camera: {
      x: clamp(blend(640, center, close), view, 1280 - view),
      y: blend(360, 451, close) - wide * 27, scale,
      shakeX: t >= strike && t < strike + 17 ? (t % 2 ? 1 : -1) * (strike + 17 - t) : 0,
      shakeY: t >= strike && t < strike + 12 ? (t % 3 - 1) * (strike + 12 - t) * .55 : 0,
    },
  };
}
