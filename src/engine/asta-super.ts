import type { Fighter } from "./combat";
import type { Move } from "./types";
import type { FuryState } from "./goku-fury";
import type { AstaSword } from "./asta-stances";
import sockets from "../data/asta-sockets.json";
import weapons from "../data/asta-weapons.json";

export function astaUnionBlade(
  sheet: string,
  frame: number,
  sword: AstaSword,
  fraction = 1,
) {
  const grip = (
    sockets as Record<string, { x: number; y: number; angle: number }[]>
  )[sheet][frame];
  const rad = (grip.angle * Math.PI) / 180,
    reach = weapons[sword].reach * fraction;
  return {
    a: { x: grip.x, y: grip.y },
    b: { x: grip.x + Math.cos(rad) * reach, y: grip.y + Math.sin(rad) * reach },
    r: 12,
  };
}
export function astaMeteoriteBlade(t: number) {
  return astaUnionBlade(
    "r-black-flight",
    Math.max(0, Math.min(3, Math.floor((t - 14) / 3))),
    "slayer",
  );
}

export const astaUnionId = "astaBlackMeteorite";
export const astaUnionName = "Black Meteorite · Devil Union";
export const astaUnionConfig = {
  cost: 100,
  duration: 278,
  minimumComboScale: 0.55,
  hits: [
    { tick: 4, damage: 60, kind: "meteorite", hold: 6 },
    { tick: 100, damage: 36, kind: "rush", hold: 3 },
    { tick: 126, damage: 36, kind: "cross", hold: 3 },
    { tick: 154, damage: 38, kind: "rise", hold: 4 },
    { tick: 184, damage: 40, kind: "dive", hold: 4 },
    { tick: 230, damage: 130, kind: "explosion", hold: 8 },
  ],
} as const;
/** Guardable, finite opener. Its real swept sword hit owns confirmation, never distance alone. */
export const astaUnionMove: Move = {
  kind: astaUnionId,
  super: true,
  cost: 100,
  rank: 4,
  startup: 14,
  active: 12,
  recovery: 32,
  damage: 0,
  stun: 18,
  blockstun: 16,
  push: 5,
  launch: 0,
  level: "mid",
  hitstop: 8,
  cancels: [],
  box: { x: 20, y: -112, w: 97, h: 55 },
  drive: { from: 10, to: 26, speed: 21 },
  astaSword: { sword: "slayer", commitTick: 10 },
  poses: [
    {
      ticks: 14,
      phase: "brace",
      hurtboxes: [
        { x: -24, y: -128, w: 48, h: 70 },
        { x: -25, y: -58, w: 50, h: 58 },
      ],
    },
    {
      ticks: 12,
      phase: "meteorite",
      hurtboxes: [
        { x: -55, y: -108, w: 110, h: 57 },
        { x: -45, y: -51, w: 80, h: 45 },
      ],
    },
    {
      ticks: 32,
      phase: "recover",
      hurtboxes: [
        { x: -24, y: -128, w: 48, h: 70 },
        { x: -25, y: -58, w: 50, h: 58 },
      ],
    },
  ],
};
export interface AstaUnionState extends FuryState {
  hold: number;
  openingTick: number;
}
export function canStartAstaUnion(f: Fighter) {
  return (
    !!f.asta &&
    !!f.data.superMoves?.[astaUnionId] &&
    f.meter >= 100 &&
    !!f.match &&
    f.match.phase === "fight" &&
    !f.match.cinematicActive &&
    !f.match.capture &&
    !f.airborne &&
    !f.knockedDown &&
    (["idle", "walk", "crouch", "dash", "landing", "jumpStart"].includes(
      f.state,
    ) ||
      (f.hitConfirmed && f.canSuperCancel()))
  );
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const u = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
type Key = readonly [number, number, number];
function track(t: number, keys: Key[]) {
  for (let i = 1; i < keys.length; i++)
    if (t <= keys[i][0]) {
      const a = keys[i - 1],
        b = keys[i],
        p = u(t, a[0], b[0]);
      return { x: mix(a[1], b[1], p), y: mix(a[2], b[2], p) };
    }
  const k = keys.at(-1)!;
  return { x: k[1], y: k[2] };
}
export const astaUnionPhases = [
  [0, "meteorite"],
  [22, "liebe"],
  [48, "union"],
  [82, "rush"],
  [112, "cross"],
  [140, "rise"],
  [168, "dive"],
  [198, "equinoxCharge"],
  [222, "equinox"],
  [244, "return"],
] as const;
export function astaUnionPhase(t: number) {
  return (
    [...astaUnionPhases].reverse().find(([start]) => t >= start)?.[1] ??
    "meteorite"
  );
}
/** All camera, forms, weapon commits and victim paths derive from this serialized 60 Hz clock.
 * No render clock, particle or random value can apply damage or move a combatant. */
export function astaUnionScene(s: AstaUnionState) {
  const t = s.tick,
    f = s.facing,
    stage = clamp(s.targetX, 350, 930);
  const vkeys: Key[] = [
    [0, s.targetX, s.targetY],
    [14, stage + 40 * f, 535],
    [22, stage + 65 * f, 580],
    [82, stage + 65 * f, 580],
    [100, stage + 75 * f, 570],
    [112, stage + 100 * f, 520],
    [126, stage + 60 * f, 490],
    [140, stage + 95 * f, 450],
    [154, stage + 100 * f, 350],
    [168, stage + 130 * f, 300],
    [184, stage + 145 * f, 425],
    [198, stage + 120 * f, 575],
    [222, stage + 115 * f, 575],
    [230, stage + 130 * f, 575],
    [246, stage + 220 * f, 450],
    [260, stage + 270 * f, 480],
    [278, stage + 290 * f, 580],
  ];
  const victim = track(t, vkeys);
  const contact = (
    at: number,
    sheet: string,
    frame: number,
    sword: AstaSword,
    grounded = false,
  ): Key => {
    const target = track(at, vkeys),
      p = astaUnionBlade(sheet, frame, sword, 0.72).b;
    return [at, target.x - p.x * f, grounded ? 580 : target.y - 75 - p.y];
  };
  let clip = "unionMeteorite",
    tick = Math.min(21, Math.max(0, s.openingTick - 14) + t),
    sword: AstaSword = "slayer";
  const akeys: Key[] = [
    [0, s.originX, 580],
    [22, stage - 45 * f, 580],
    [82, stage - 45 * f, 580],
    contact(100, "r-union-rush", 2, "dweller"),
    [112, stage + 10 * f, 560],
    contact(126, "r-union-rush", 5, "dweller"),
    [140, stage + 5 * f, 490],
    contact(154, "r-union-rise", 3, "destroyer"),
    [168, stage + 45 * f, 280],
    contact(184, "r-union-dive", 3, "slayer"),
    [198, stage + 30 * f, 580],
    [222, stage + 30 * f, 580],
    contact(230, "r-equinox", 3, "slasher", true),
    [244, stage + 55 * f, 580],
    [278, stage + 55 * f, 580],
  ];
  const attacker = track(t, akeys),
    phase = astaUnionPhase(t);
  if (t >= 22 && t < 48) {
    clip = "unionBlackBrace";
    tick = t - 22;
  } else if (t >= 48 && t < 82) {
    clip = t < 54 ? "unionPartialReady" : "unionChange";
    tick = t - (t < 54 ? 48 : 54);
  } else if (t >= 82 && t < 112) {
    clip = "unionRush";
    tick = t - 82;
    sword = "dweller";
  } else if (t >= 112 && t < 140) {
    clip = "unionCross";
    tick = t - 112;
    sword = "dweller";
  } else if (t >= 140 && t < 168) {
    clip = "unionRise";
    tick = t - 140;
    sword = "destroyer";
  } else if (t >= 168 && t < 198) {
    clip = "unionDive";
    tick = t - 168;
    sword = "slayer";
  } else if (t >= 198 && t < 222) {
    clip = "unionEquinoxCharge";
    tick = t - 198;
    sword = "slasher";
  } else if (t >= 222 && t < 244) {
    clip = "unionEquinox";
    tick = t - 222;
    sword = "slasher";
  } else if (t >= 244) {
    clip = "unionReturn";
    tick = t - 244;
    sword = "slasher";
  }
  if (t >= 257 && t < 267) {
    clip = "unionPartialReturn";
    tick = t - 257;
  } else if (t >= 267) {
    clip = "unionBaseReturn";
    tick = t - 267;
  }
  const hits = astaUnionConfig.hits;
  const age = Math.min(
    ...hits.filter((h) => h.tick <= t).map((h) => t - h.tick),
  );
  const shake =
    age < 6 ? (t % 2 ? 1 : -1) * (t >= 230 ? 4 : 2) * (1 - age / 6) : 0;
  const focus = t >= 22 && t < 82 ? u(t, 22, 36) * (1 - u(t, 72, 82)) : 0;
  const scale =
    1 + 0.28 * focus + (t >= 198 && t < 230 ? 0.13 * u(t, 198, 214) : 0);
  const camera = {
    x: clamp((attacker.x + victim.x) / 2, 640 / scale, 1280 - 640 / scale),
    y: mix(
      580 - 220 / scale,
      (Math.min(attacker.y, victim.y) + Math.max(attacker.y, victim.y)) / 2 -
        155,
      t >= 112 && t < 198 ? 0.65 : 0,
    ),
    scale,
    shakeX: shake,
    shakeY: -shake * 0.4,
  };
  const form =
    t < 48 ? "black" : t < 82 ? "changing" : t < 244 ? "union" : "return";
  const vclip =
    t < 22
      ? "damageHeavy"
      : t < 82
        ? "damageCrouch"
        : t < 140
          ? "damageAir"
          : t < 168
            ? "launched"
            : t < 198
              ? "falling"
              : t < 230
                ? "damageHeavy"
                : "falling";
  // 1/16 px quantization is part of the simulation, not a client rendering decision.
  const q = (n: number) => Math.round(n * 16) / 16;
  return {
    phase,
    form,
    sword,
    camera,
    attacker: { x: q(attacker.x), y: q(attacker.y), facing: f, clip, tick },
    victim: {
      x: q(victim.x),
      y: q(victim.y),
      facing: -f,
      clip: vclip,
      tick: age < 8 ? Math.max(0, age) : t % 18,
    },
  };
}
