import type { PandemoniumState } from "./xebec-pandemonium";

type Pose = { x: number; y: number; facing: number; clip: string; tick: number };
type Handoff = { attacker: Pose; victim: Pose };
export type RocksMember = "newgate" | "kaido" | "linlin";
export type RocksActor = { member: RocksMember; x: number; y: number; facing: number; cel: number; opacity: number };
type Prometheus = { x: number; y: number; facing: number; cel: number; opacity: number; size: number;
  aimX: number; aimY: number; jet: number };

const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(x, high));

// This clock drives the approved finale, independently of the opening and relay.
export const justiceBeats = { gates: 424, rush: 510, rupture: 579, aftermath: 647, return: 732, end: 763 } as const;
const gateStart = 580;
export const justiceDelay = gateStart - justiceBeats.gates;
export const pandemoniumBeats = {
  horizontal: 5, diagonal: 22, cross: 37, uppercut: 54, apex: 92, lift: 103, windup: 126,
  cut: 138, flight: 157, command: 203, crew: 222, newgate: 222, quake: 275,
  kaido: 299, club: 345, linlin: 379, reveal: 398, flare: 423, fire: 442, soul: 454,
  regroup: 500, passage: 541, gates: gateStart,
  rush: justiceBeats.rush + justiceDelay, rupture: justiceBeats.rupture + justiceDelay,
  aftermath: justiceBeats.aftermath + justiceDelay, return: justiceBeats.return + justiceDelay,
} as const;
const beats = pandemoniumBeats;

export const pandemoniumPrelude = [
  { tick: beats.horizontal, hold: 2, angle: "horizontal" },
  { tick: beats.diagonal, hold: 2, angle: "diagonal" },
  { tick: beats.cross, hold: 3, angle: "cross" },
  { tick: beats.uppercut, hold: 5, angle: "rising" },
] as const;

export const pandemoniumBladeClips = {
  pandemoniumOpening: { sheet: "pandemonium-opening", durations: [5, 7, 10, 8, 7, 7, 10, 11] },
  pandemoniumDescent: { sheet: "pandemonium-descent", durations: [12, 14, 12, 13, 20, 7, 7, 25] },
} as const;
const descentStart = 67;

export function pandemoniumEase(tick: number, start: number, end: number) {
  const t = clamp((tick - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}
const ease = pandemoniumEase;

// Positions interpolate through the contact points so successive attacks redirect the
// same opponent. The first half of the launch eases to a stop only at the apex.
function flight(t: number, start: number, stop: number, from: number, v1: number, v2: number, to: number) {
  const p = clamp((t - start) / (stop - start), 0, 1), q = 1 - p;
  return from * q ** 3 + 3 * v1 * q ** 2 * p + 3 * v2 * q * p ** 2 + to * p ** 3;
}

const chapters = [
  [0, "confirm"], [beats.horizontal, "horizontal"], [beats.diagonal, "diagonal"], [beats.cross, "cross"],
  [beats.uppercut, "rising"], [beats.apex, "falling"], [beats.lift, "lift"], [beats.windup, "windup"],
  [beats.cut, "pandemonium"], [beats.flight, "flight"], [beats.command, "command"],
  [beats.newgate, "newgate"], [beats.kaido, "kaido"], [beats.linlin, "linlin"],
  [beats.reveal, "prometheus"], [beats.fire, "prometheus-fire"], [beats.regroup, "rocks"], [beats.passage, "passage"],
] as const;

function through<T>(keyframes: readonly T[], tick: number, at: (frame: T) => number) {
  for (let i = keyframes.length - 1; i >= 0; i--) {
    if (tick >= at(keyframes[i])) return keyframes[i];
  }
}
const newgateSteps = [0, 9, 21, 34, 44, 53, 60, 67, 87];
const kaidoSteps = [0, 7, 16, 29, 39, 46, 55, 62, 91];
const linlinSteps = [0, 12, 24, 39, 54, 63, 76, 90, 121];
const celAt = (age: number, holds: readonly number[]) => {
  const end = holds.findIndex((end, i) => i > 0 && age < end);
  return end < 0 ? holds.length - 2 : end - 1;
};

function solarHomie(t: number, linlin: RocksActor, aimX: number, aimY: number): Prometheus | undefined {
  const b = beats;
  if (t < b.reveal || t > b.regroup - 2) return;
  const launch = ease(t, b.fire - 4, b.soul);
  const retreat = ease(t, b.soul + 7, b.regroup - 4);
  const x = linlin.x + linlin.facing * (72 - 13 * ease(t, b.reveal, b.flare) + 13 * launch + 14 * retreat);
  const y = linlin.y - 151 - 114 * ease(t, b.reveal, b.flare) + 16 * launch + 35 * retreat +
    Math.sin((t - b.reveal) * .19) * (1 - launch + retreat) * 6;
  const grow = ease(t, b.flare - 4, b.fire + 5) * (1 - retreat);
  const age = t - b.reveal;
  const cel = t < b.flare ? Math.floor(age / 5) % 3 : t < b.fire ? (Math.floor(age / 4) % 2) + 3 :
    t < b.soul + 11 ? (Math.floor(age / 4) % 2) + 5 : t < b.regroup - 14 ? 7 : Math.floor(age / 4) % 3;
  return { x, y, facing: linlin.facing, cel, size: 71 + 69 * grow,
    opacity: ease(t, b.reveal, b.reveal + 10) * (1 - ease(t, b.regroup - 15, b.regroup - 2)),
    aimX, aimY, jet: ease(t, b.fire, b.soul) * (1 - ease(t, b.soul + 6, b.soul + 20)),
  };
}

export function pandemoniumActs(s: PandemoniumState, handoff: Handoff) {
  const t = s.tick, f = s.facing, b = beats;
  const e = (start: number, end: number) => ease(t, start, end);
  const base = clamp(s.targetX, f === 1 ? 250 : 466, f === 1 ? 814 : 1030);
  const x = (offset: number) => base + f * offset;
  const crewRejoin = e(b.regroup - 10, b.regroup + 19);
  const blendOut = e(b.passage, b.gates);
  const formation = mix(640, handoff.attacker.x, blendOut);
  const recede = 278 * (e(b.linlin - 42, b.linlin + 6) - crewRejoin);
  const advance = -107 + 18 * e(0, b.horizontal) + 14 * e(13, b.diagonal) +
    25 * e(27, b.cross) + 21 * e(44, b.uppercut) + 50 * e(67, b.lift) + 7 * e(b.windup, b.cut);
  const fighterX = mix(s.originX, x(advance), e(0, 29));
  const opening = t < descentStart;
  const retreating = t >= b.linlin - 42 && t < b.linlin + 6;
  const attacker: Pose = {
    x: Math.round(clamp(mix(fighterX - f * recede, formation, crewRejoin), 40, 1240)),
    y: 580, facing: f,
    clip: opening ? "pandemoniumOpening" : t < b.command ? "pandemoniumDescent" :
      t >= b.passage ? "pandemoniumWalk" : retreating ? "walkBack" : "pandemoniumRelay",
    tick: opening ? t : t < b.command ? t - descentStart : t >= b.passage ? t - b.passage :
      retreating ? t - (b.linlin - 42) : t - b.command,
  };

  let dx: number, y: number;
  if (t < b.uppercut) {
    dx = (s.targetX - base) * f * (1 - e(0, 29)) +
      16 * e(b.horizontal, b.horizontal + 9) + 17 * e(b.diagonal, b.diagonal + 8) + 10 * e(b.cross, b.cross + 10);
    y = mix(s.targetY, 580, e(0, 45)) - 17 * (e(b.cross, b.cross + 5) - e(b.cross + 7, b.uppercut));
  } else if (t < b.cut) {
    dx = 43 + 35 * e(b.uppercut, b.cut);
    y = t < b.apex ? flight(t, b.uppercut, b.apex, 580, 243, 244, 244) :
      flight(t, b.apex, b.cut, 244, 244, 380, 548);
  } else if (t < b.quake) {
    dx = flight(t, b.cut, b.quake, 78, 446, 227, 268);
    y = flight(t, b.cut, b.quake, 548, 563, 377, 465);
  } else if (t < b.club) {
    dx = flight(t, b.quake, b.club, 268, 376, 358, 237);
    y = flight(t, b.quake, b.club, 465, 144, 179, 307);
  } else if (t < b.soul) {
    dx = flight(t, b.club, b.soul, 237, 157, 95, 49);
    y = flight(t, b.club, b.soul, 307, 475, 559, 547);
  } else {
    dx = flight(t, b.soul, b.gates, 49, 259, 283, 326);
    y = flight(t, b.soul, b.gates, 547, 326, 493, 580);
  }
  const preliminary = through(pandemoniumPrelude, t, hit => hit.tick);
  const impact = t >= b.soul ? b.soul : t >= b.club ? b.club : t >= b.quake ? b.quake :
    t >= b.cut ? b.cut : preliminary?.tick ?? 0;
  const reaction = t < b.uppercut ? (t < b.horizontal ? "grabbed" : t < b.diagonal ? "damageHeavy" :
    t < b.cross ? "damageCrouch" : "damageHeavy") :
    (t >= b.apex && t < b.cut || t >= b.club && t < b.soul || t >= b.soul + 55) ? "falling" : "launched";
  const victim: Pose = {
    x: Math.round(mix(x(dx), handoff.victim.x, blendOut)),
    y: Math.round(mix(y, handoff.victim.y, blendOut)),
    facing: t >= b.club && t < b.soul ? f : -f,
    clip: blendOut >= .9 ? handoff.victim.clip : reaction,
    tick: t - impact,
  };

  const rocks: RocksActor[] = [];
  if (t >= b.newgate && t < b.kaido + 7) {
    const enter = e(b.newgate, b.newgate + 23);
    const lunge = e(b.quake - 15, b.quake);
    rocks.push({ member: "newgate", x: x(138 - 178 * (1 - enter) + 28 * lunge), y: 580, facing: f,
      cel: celAt(t - b.newgate, newgateSteps), opacity: e(b.newgate, b.newgate + 9) * (1 - e(b.kaido - 5, b.kaido + 7)) });
  }
  if (t >= b.kaido && t < b.linlin + 8) {
    const cx = t < b.club ? flight(t, b.kaido, b.club, 419, 428, 382, 346) :
      flight(t, b.club, b.linlin + 7, 346, 318, 182, 73);
    const cy = t < b.club ? flight(t, b.kaido, b.club, 18, 76, 154, 281) :
      flight(t, b.club, b.linlin + 7, 281, 402, 526, 580);
    rocks.push({ member: "kaido", x: x(cx), y: cy, facing: -f,
      cel: celAt(t - b.kaido, kaidoSteps), opacity: e(b.kaido, b.kaido + 7) * (1 - e(b.linlin - 11, b.linlin + 8)) });
  }
  let prometheus: Prometheus | undefined;
  if (t >= b.linlin && t < b.regroup) {
    const actor = { member: "linlin" as const, x: x(-143 - 103 * (1 - e(b.linlin, b.linlin + 27)) +
      47 * e(b.flare - 10, b.soul)), y: 580, facing: f,
      cel: celAt(t - b.linlin, linlinSteps), opacity: e(b.linlin, b.linlin + 15) * (1 - e(b.regroup - 9, b.regroup)) };
    rocks.push(actor);
    prometheus = solarHomie(t, actor, x(49), 453);
  }
  if (t >= b.regroup) for (const [member, offset] of [["newgate", -211], ["kaido", 142], ["linlin", 287]] as const) {
    rocks.push({ member, x: clamp(attacker.x + f * offset, 108, 1172), y: 580, facing: f, cel: 7,
      opacity: e(b.regroup, b.regroup + 13) * (1 - blendOut) });
  }

  const airborne = e(b.uppercut, b.uppercut + 17) * (1 - e(b.windup - 9, b.cut - 3));
  const wind = e(b.lift - 11, b.windup) * (1 - e(b.cut, b.cut + 12));
  const track = e(b.cut, b.cut + 16) * (1 - e(b.regroup + 5, b.passage + 7));
  const kaidoReveal = e(b.kaido + 8, b.kaido + 21) * (1 - e(b.club - 8, b.club + 2));
  const linlinFocus = e(b.linlin, b.reveal + 3) * (1 - e(b.soul, b.regroup - 9));
  const fullGroup = e(b.regroup - 6, b.regroup + 22);
  const zoom = mix(mix(1.24, 1.02, airborne) + wind * .27 + track * .16 + kaidoReveal * .13 - linlinFocus * .08, 1.1, fullGroup) * (1 - blendOut) + blendOut;
  const view = 640 / zoom;
  const aerialActor = rocks.find(actor => actor.member === "kaido");
  const front = mix(attacker.x, victim.x, .52);
  const focusX = mix(mix(mix(front, victim.x + f * (kaidoReveal * 64 - 21), track * .75), x(-53), linlinFocus * .76), 640, fullGroup);
  const focusY = mix(mix(mix(440 - airborne * 115, clamp(victim.y - 78, 264, 432), track * .77),
    aerialActor ? clamp(aerialActor.y + 124, 248, 351) : 329, kaidoReveal * .78), 420, linlinFocus);
  const shake = Math.max(0, (impact === b.cut ? 12 : 7) - (t - impact)) *
    (impact === b.cut ? .88 : impact === b.uppercut || impact === b.club ? .65 : .4) * Number(t >= b.horizontal);

  return {
    attacker, victim, rocks, prometheus, justiceTick: undefined,
    phase: through(chapters, t, ([start]) => start)?.[1] ?? "confirm",
    darkness: .24 * e(0, 10) * (1 - track) + .39 * wind,
    split: e(b.cut, b.cut + 18) * (1 - e(b.flight, b.command)) * .56,
    camera: {
      x: clamp(mix(focusX, 640, blendOut), view, 1280 - view),
      y: mix(Math.max(focusY, t < b.cut ? 580 - 301 / zoom : 0), 360, blendOut), scale: zoom,
      shakeX: shake * (t % 3 - 1), shakeY: shake * ((t + 1) % 3 - 1) * .47,
    },
  };
}
