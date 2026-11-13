import type { FuryState } from "./goku-fury";
import type { Move, Rect } from "./types";

export const pandemoniumId = "pandemonium";
export const pandemonium = {
  cost: 100,
  charge: 22,
  impact: 74,
  split: 88,
  return: 116,
  end: 142,
  damage: 304,
  minimumComboScale: 0.64,
} as const;

export function pandemoniumOpener(hurtboxes: Rect[]): Move {
  return {
    super: true,
    kind: pandemoniumId,
    cost: pandemonium.cost,
    startup: 12,
    active: 6,
    recovery: 32,
    damage: 24,
    stun: 22,
    blockstun: 13,
    push: 4,
    launch: 0,
    level: "mid",
    rank: 3,
    cancels: [],
    hitstop: 8,
    box: { x: 0, y: 0, w: 0, h: 0 },
    drive: { from: 5, to: 15, speed: 7.8 },
    poses: [
      { ticks: 12, phase: "startup", hurtboxes },
      {
        ticks: 6,
        phase: "active",
        hurtboxes,
        hitboxes: [{ a: { x: 22, y: -90 }, b: { x: 119, y: -112 }, r: 24 }],
      },
      { ticks: 32, phase: "recovery", hurtboxes },
    ],
  };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => {
  const n = clamp(t, 0, 1);
  return n * n * (3 - 2 * n);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function pandemoniumScene(s: FuryState, floor: number) {
  const t = s.tick,
    f = s.facing;
  const stage = clamp(s.originX, f === 1 ? 145 : 380, f === 1 ? 900 : 1135);
  const attackerX = mix(s.originX, stage, ease(t / 22));
  const stageVictim = stage + 104 * f;
  const launched = ease((t - pandemonium.impact) / 38);
  const victimX =
    mix(s.targetX, stageVictim, ease(t / 22)) + launched * 191 * f;
  const victimY =
    mix(s.targetY, floor, ease(t / 22)) - 99 * Math.sin(Math.PI * launched);
  const zoom =
    1 + 0.47 * ease(t / 31) * (1 - ease((t - pandemonium.split) / 46));
  const focus = mix(
    640,
    attackerX + 53 * f,
    ease(t / 29) * (1 - ease((t - 79) / 55)),
  );
  const halfView = 640 / zoom;
  const jolt =
    t >= pandemonium.impact ? Math.max(0, 10 - (t - pandemonium.impact)) : 0;
  const phase =
    t < pandemonium.charge
      ? "confirm"
      : t < pandemonium.impact
        ? "charge"
        : t < pandemonium.split
          ? "impact"
          : t < pandemonium.return
            ? "split"
            : "return";
  return {
    phase,
    clipTick:
      t < pandemonium.charge
        ? t
        : t < pandemonium.impact
          ? t - pandemonium.charge
          : t < pandemonium.return
            ? t - pandemonium.impact
            : t - pandemonium.return,
    attackerX,
    victimX,
    victimY,
    clip:
      phase === "confirm"
        ? "pandemoniumConfirm"
        : phase === "charge"
          ? "pandemoniumCharge"
          : phase === "impact" || phase === "split"
            ? "pandemoniumImpact"
            : "pandemoniumReturn",
    camera: {
      x: clamp(focus, halfView, 1280 - halfView),
      y: mix(360, floor - 169, (zoom - 1) / 0.47),
      scale: zoom,
      shakeX: jolt * (t % 2 ? 1 : -1),
      shakeY: -jolt * 0.35,
    },
  };
}
