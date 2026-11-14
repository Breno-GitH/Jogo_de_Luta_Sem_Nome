import type { PandemoniumState } from "./xebec-pandemonium";

type Pose = { x: number; y: number; facing: number; clip: string; tick: number };
type Handoff = { attacker: Pose; victim: Pose };
export type RocksMember = "newgate" | "kaido" | "linlin";
export type RocksActor = { member: RocksMember; x: number; y: number; facing: number; cel: number; opacity: number };

const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(x, high));
// The approved finale runs on its original clock. Only its entry point moves.
export const justiceBeats = { gates: 424, rush: 510, rupture: 579, aftermath: 647, return: 732, end: 763 } as const;
const gateStart = 580;
export const justiceDelay = gateStart - justiceBeats.gates;
export const pandemoniumBeats = {
  smile: 14, lift: 64, windup: 120, cut: 159, flight: 183, command: 233,
  crew: 249, newgate: 249, quake: 300, kaido: 323, club: 365,
  linlin: 395, soul: 446, regroup: 483, passage: 534,
  gates: gateStart, rush: justiceBeats.rush + justiceDelay, rupture: justiceBeats.rupture + justiceDelay,
  aftermath: justiceBeats.aftermath + justiceDelay, return: justiceBeats.return + justiceDelay,
} as const;
export function pandemoniumEase(tick: number, start: number, end: number) {
  const t = clamp((tick - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

const beats = pandemoniumBeats, ease = pandemoniumEase;
// A cubic path starts and ends on the preceding/next contact point. Its controls
// define the momentum of the launch instead of interpolating from pose to pose.
function flight(t: number, start: number, stop: number, from: number, v1: number, v2: number, to: number) {
  const p = clamp((t - start) / (stop - start), 0, 1), q = 1 - p;
  return from * q ** 3 + 3 * v1 * q ** 2 * p + 3 * v2 * q * p ** 2 + to * p ** 3;
}

function chapter(t: number) {
  const chapters = [
  [0, "confirm"], [beats.smile, "smile"], [beats.lift, "lift"], [beats.windup, "windup"],
  [beats.cut, "pandemonium"], [beats.flight, "flight"], [beats.command, "command"],
  [beats.newgate, "newgate"], [beats.kaido, "kaido"], [beats.linlin, "linlin"],
  [beats.regroup, "rocks"], [beats.passage, "passage"],
] as const;
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (t >= chapters[i][0]) return chapters[i][1];
  }
  return "confirm";
}

const recovery = [0, 10, 21, 30, 39, 48, 57, 65, 76];
const kaidoSteps = [0, 7, 16, 29, 38, 42, 49, 58, 73];
const linlinSteps = [0, 11, 23, 33, 43, 51, 58, 70, 93];
const celAt = (age: number, holds: number[]) => {
  const end = holds.findIndex((end, i) => i > 0 && age < end);
  return end < 0 ? holds.length - 2 : end - 1;
};

export function pandemoniumActs(s: PandemoniumState, handoff: Handoff) {
  const t = s.tick, f = s.facing, b = beats;
  const e = (start: number, end: number) => ease(t, start, end);
  const base = clamp(s.targetX, f === 1 ? 250 : 431, f === 1 ? 849 : 1030);
  const x = (offset: number) => base + f * offset;
  const actorX = mix(s.originX, x(-112), e(0, 32)) + f * 30 * e(114, b.cut);
  const crewRejoin = e(b.regroup - 9, b.regroup + 25);
  const blendOut = e(b.passage, b.gates);
  const formation = mix(640, handoff.attacker.x, blendOut);
  const recede = 51 * (e(b.linlin - 18, b.linlin + 19) - crewRejoin);
  const attacker: Pose = {
    x: Math.round(mix(actorX - f * recede, formation, crewRejoin)),
    y: 580, facing: f, clip: t < b.command ? "pandemoniumScene" : t >= b.passage ? "pandemoniumWalk" : "pandemoniumRelay",
    tick: t < b.command ? t : t >= b.passage ? t - b.passage : t - b.command,
  };

  let dx: number, y: number;
  if (t < b.cut) {
    dx = (s.targetX - base) * f * (1 - e(0, 34));
    y = mix(s.targetY, 580, e(0, 28));
  } else if (t < b.quake) {
    dx = flight(t, b.cut, b.quake, 0, 245, 221, 265);
    y = flight(t, b.cut, b.quake, 580, 287, 484, 465);
  } else if (t < b.club) {
    dx = flight(t, b.quake, b.club, 265, 346, 359, 248);
    y = flight(t, b.quake, b.club, 465, 171, 223, 311);
  } else if (t < b.soul) {
    dx = flight(t, b.club, b.soul, 248, 140, 63, 15);
    y = flight(t, b.club, b.soul, 311, 540, 518, 532);
  } else {
    dx = flight(t, b.soul, b.gates, 15, 196, 309, 326);
    y = flight(t, b.soul, b.gates, 532, 363, 480, 580);
  }
  const impact = t >= b.soul ? b.soul : t >= b.club ? b.club : t >= b.quake ? b.quake : b.cut;
  const reaction = t < b.cut ? t >= b.windup ? "damageHeavy" : "grabbed" :
    (t >= b.club && t < b.soul || t >= b.soul + 55) ? "falling" : "launched";
  const victim: Pose = {
    x: Math.round(mix(x(dx), handoff.victim.x, blendOut)),
    y: Math.round(mix(y, handoff.victim.y, blendOut)),
    facing: t >= b.club && t < b.soul ? f : -f,
    clip: blendOut >= .9 ? handoff.victim.clip : reaction,
    tick: t < b.cut ? t % 21 : t - impact,
  };

  const rocks: RocksActor[] = [];
  if (t >= b.newgate && t < b.kaido + 10) {
    const enter = e(b.newgate, b.newgate + 21);
    rocks.push({ member: "newgate", x: x(150 - 239 * (1 - enter)), y: 580, facing: f,
      cel: celAt(t - b.newgate, recovery), opacity: enter * (1 - e(b.kaido, b.kaido + 10)) });
  }
  if (t >= b.kaido && t < b.linlin + 11) {
    const cx = t < b.club ? flight(t, b.kaido, b.club, 398, 403, 381, 361) :
      flight(t, b.club, b.linlin + 9, 361, 317, 193, 58);
    const cy = t < b.club ? flight(t, b.kaido, b.club, 26, 34, 170, 262) :
      flight(t, b.club, b.linlin + 9, 262, 341, 506, 579);
    rocks.push({ member: "kaido", x: x(cx), y: cy, facing: -f,
      cel: celAt(t - b.kaido, kaidoSteps), opacity: e(b.kaido, b.kaido + 6) * (1 - e(b.linlin - 8, b.linlin + 11)) });
  }
  if (t >= b.linlin && t < b.regroup) {
    rocks.push({ member: "linlin", x: x(-105 - 68 * (1 - e(b.linlin, b.linlin + 24))), y: 580, facing: f,
      cel: celAt(t - b.linlin, linlinSteps), opacity: e(b.linlin, b.linlin + 17) * (1 - e(b.regroup - 7, b.regroup)) });
  }
  if (t >= b.regroup) for (const [member, offset] of [["newgate", -211], ["kaido", 142], ["linlin", 287]] as const) {
    rocks.push({ member, x: Math.max(108, Math.min(1172, attacker.x + f * offset)), y: 580, facing: f, cel: 7,
      opacity: e(b.regroup, b.regroup + 13) * (1 - blendOut) });
  }

  const wind = e(67, 115) * (1 - e(140, b.cut));
  const track = e(b.cut, b.cut + 16) * (1 - e(b.regroup + 5, b.passage + 7));
  const kaidoReveal = e(b.kaido + 10, b.kaido + 21) * (1 - e(b.club - 12, b.club));
  const fullGroup = e(b.regroup - 6, b.regroup + 22);
  const zoom = mix(1.09 + wind * .48 + track * .18 + kaidoReveal * .14, 1.1, fullGroup) * (1 - blendOut) + blendOut;
  const view = 640 / zoom;
  const aerialActor = rocks.find(actor => actor.member === "kaido");
  const focusX = mix(mix(attacker.x + f * 59, victim.x + f * (kaidoReveal * 78 - 22), track * .88), 700, fullGroup);
  const focusY = mix(mix(432, clamp(victim.y - 79, 255, 408), track),
    aerialActor ? clamp(aerialActor.y + 125, 246, 336) : 306, kaidoReveal * .8);
  const shake = t < b.cut ? 0 : Math.max(0, 11 - (t - impact)) *
    (impact === b.cut ? .8 : impact === b.club ? .59 : .36);

  return {
    attacker, victim, rocks, justiceTick: undefined,
    phase: chapter(t),
    darkness: e(12, 57) * (1 - e(b.cut + 9, b.command)) * .75,
    split: e(b.cut, b.cut + 23) * (1 - e(b.flight, b.command)) * .78,
    camera: {
      x: clamp(mix(focusX, 640, blendOut), view, 1280 - view),
      y: mix(focusY, 360, blendOut), scale: zoom,
      shakeX: shake * (t % 3 - 1), shakeY: shake * ((t + 1) % 3 - 1) * .47,
    },
  };
}
