import type { Fighter } from "./combat";
import type { Move } from "./types";
import type { FuryState } from "./goku-fury";
import type { AstaSword } from "./asta-stances";
import sockets from "../data/asta-sockets.json";
import weapons from "../data/asta-weapons.json";
import {
  unionBeats as beats,
  unionChapters,
  unionContacts,
  unionPhase,
  unionPose,
} from "./asta-super-acts";

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
    t < 17 ? 0 : t < 20 ? 1 : t < 24 ? 2 : 3,
    "slayer",
  );
}

export const astaUnionId = "astaBlackMeteorite";
export const astaUnionName = "Devil Union — Infinite Slash Equinox";
export const astaUnionConfig = {
  cost: 100,
  duration: beats.end,
  minimumComboScale: 0.55,
  hits: unionContacts.filter((h) => h.damage > 0),
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
/** Piecewise travel is authored in world coordinates, including the launch/apex/fall.
 * Roots are never swapped by a camera cut. Every segment starts at the previous endpoint. */
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
export const astaUnionPhases = unionChapters;
export const astaUnionPhase = unionPhase;
/** A remote cutting plane, independent of Asta's physical katana and cosmetic fragments.
 * The plane is locked by the serialized target/clock and has exactly one damage event.
 * The release precedes that event: neither the swing nor its particles can hit again. */
export function astaEquinoxPlane(s: AstaUnionState) {
  const center = clamp(s.targetX, 480, 800);
  return {
    x: center + 215 * s.facing,
    top: 115,
    bottom: 580,
    release: beats.release,
    impact: beats.impact,
    released: s.tick >= beats.release,
    impacted: s.tick >= beats.impact,
  };
}
export function astaUnionScene(s: AstaUnionState) {
  const t = s.tick,
    f = s.facing,
    stage = clamp(s.targetX, 480, 800);
  const x = (offset: number) => stage + offset * f;
  const vkeys: Key[] = [
    [0, s.targetX, s.targetY],
    [22, clamp(s.targetX + 48 * f, 62, 1218), 540],
    [47, clamp(s.targetX + 65 * f, 62, 1218), 520],
    [70, clamp(s.targetX + 80 * f, 62, 1218), 340],
    [90, x(165), 480],
    [110, x(150), 580],
    [140, x(145), 580],
    [158, x(142), 580],
    [195, x(130), 580],
    [232, x(125), 580],
    [256, x(145), 575],
    [272, x(175), 560],
    [292, x(155), 565],
    [312, x(175), 550],
    [330, x(180), 440],
    [352, x(190), 300],
    [380, x(165), 280],
    [398, x(165), 300],
    [416, x(210), 345],
    [436, x(235), 350],
    [450, x(260), 330],
    [468, x(230), 280],
    [484, x(240), 230],
    [513, x(220), 270],
    [538, x(170), 345],
    [580, x(130), 480],
    [588, x(130), 480],
    [606, x(140), 460],
    [622, x(160), 445],
    [635, x(130), 430],
    [646, x(120), 405],
    [666, x(145), 390],
    [671, x(145), 380],
    [686, x(130), 360],
    [705, x(135), 300],
    [724, x(140), 195],
    [750, x(140), 160],
    [766, x(135), 180],
    [781, x(140), 220],
    [798, x(170), 250],
    [824, x(210), 310],
    [872, x(215), 390],
    [912, x(215), 450],
    [932, x(215), 490],
    [945, x(215), 515],
    [956, x(215), 535],
    [978, x(315), 440],
    [1004, x(350), 510],
    [1024, x(355), 580],
    [1060, x(345), 580],
    [1100, x(345), 580],
  ];
  const victim = track(t, vkeys);
  const contact = (at: number, grounded = false, face = f): Key => {
    const p = unionPose(at, s.openingTick),
      v = track(at, vkeys);
    const tip = astaUnionBlade(p.sheet, p.frame, p.sword, 0.72).b;
    return [at, v.x - tip.x * face, grounded ? 580 : v.y - 75 - tip.y];
  };
  const akeys: Key[] = [
    [0, s.originX, 580],
    [22, clamp(s.targetX - 35 * f, 62, 1218), 580],
    contact(47, true),
    [66, x(-70), 580],
    [90, x(-100), 580],
    [158, x(-100), 580],
    [232, x(-100), 580],
    contact(256, true),
    [272, x(45), 580],
    contact(292, true),
    [312, x(40), 580],
    contact(330),
    [352, x(55), 430],
    [380, x(100), 300],
    contact(398),
    [416, x(95), 340],
    [436, x(80), 340],
    [450, x(120), 310],
    contact(468),
    [484, x(130), 230],
    contact(513),
    [538, x(95), 300],
    [580, x(15), 480],
    contact(588),
    contact(606),
    [622, x(180), 400],
    contact(635, false, -f),
    contact(646, false, -f),
    [666, x(55), 350],
    contact(671),
    contact(686),
    contact(705),
    [724, x(65), 235],
    [744, x(125), 115],
    [766, x(135), 100],
    contact(781),
    [798, x(70), 310],
    [824, x(40), 480],
    [837, x(-55), 440],
    [855, x(-220), 480],
    [872, x(-300), 580],
    [932, x(-300), 580],
    [1004, x(-300), 580],
    [1100, x(-300), 580],
  ];
  const attacker = track(t, akeys),
    pose = unionPose(t, s.openingTick);
  const facing = t >= 622 && t < 666 ? -f : f;
  // During the crossover Asta flies through the gap; the hand/weapon faces the target.
  const last = [...unionContacts].reverse().find((h) => t >= h.tick);
  const age = last ? t - last.tick : 1000;
  const airborne = victim.y < 570;
  const vclip =
    t >= 1024
      ? "downed"
      : t >= 956
        ? "falling"
        : t >= 945
          ? "damageAir"
          : t >= 781
            ? "falling"
            : airborne
              ? age < 9
                ? "damageAir"
                : "launched"
              : t >= 110 && t < 232
                ? t < 145
                  ? "damageCrouch"
                  : t < 180
                    ? "guard"
                    : "damageHeavy"
                : "damageHeavy";
  const focus = u(t, 90, 110) * (1 - u(t, 218, 240));
  const reveal = u(t, 198, 218) * (1 - u(t, 222, 232));
  const final = u(t, 824, 872) * (1 - u(t, 1004, 1100));
  let scale = 1 + 0.2 * focus + 0.08 * reveal - 0.12 * final;
  if (t >= 330 && t < 824) scale = 1.03;
  const pairCenter = (attacker.x + victim.x) / 2;
  const desiredX = mix(pairCenter, attacker.x + 35 * f, focus * 0.6);
  // Fit both actors and their wings without sudden hard camera cuts.
  const end = u(t, 1004, 1100);
  const elevation = Math.max(0, 580 - Math.min(attacker.y, victim.y));
  const maximumRoot = Math.max(attacker.y, victim.y);
  const minimumTop = Math.min(attacker.y - 250, victim.y - 155);
  scale = Math.min(scale, 420 / (maximumRoot - minimumTop));
  const lower = maximumRoot - 220 / scale,
    upper = minimumTop + 205 / scale;
  const y = clamp(
    580 - 220 / scale - elevation * 0.52,
    lower,
    Math.max(lower, upper),
  );
  const amount =
    age < 6 ? (last?.kind === "explosion" ? 4 : 1.8) * (1 - age / 6) : 0;
  const camera = {
    x: mix(desiredX, 640, end),
    y: mix(y, 360, end),
    scale: mix(scale, 1, end),
    shakeX: (t % 2 ? 1 : -1) * amount,
    shakeY: ((t % 3) - 1) * amount * 0.4,
  };
  const q = (n: number) => Math.round(n * 16) / 16;
  const form =
    t < 158
      ? "black"
      : t < 232
        ? "changing"
        : t < 1004
          ? "union"
          : t < 1070
            ? "return"
            : "base";
  return {
    phase: unionPhase(t),
    form,
    sword: pose.sword,
    camera,
    plane: astaEquinoxPlane(s),
    contact: last,
    contactAge: age,
    attacker: {
      x: q(attacker.x),
      y: q(attacker.y),
      facing,
      clip: pose.clip,
      tick: pose.tick,
    },
    victim: {
      x: q(victim.x),
      y: q(victim.y),
      facing: -f,
      clip: vclip,
      tick: age < 9 ? age : t % 24,
    },
  };
}
