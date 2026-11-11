import type { BenAlien } from "./ben-omnitrix";
import type { CharacterData, Move } from "./types";
import { xlr8Moves, fourArmsMoves, heatblastMoves, diamondheadMoves, humungousaurMoves, feedbackMoves, bigChillMoves, ghostfreakMoves, nrgMoves, nrgReleasedMoves, gravattackMoves, echoEchoMoves, type BenEffect } from "./ben-moves";

export type BenGrab = NonNullable<CharacterData["grabSequence"]> & { carry?: number; reverse?: boolean; clip?: string; knockdown?: boolean;
  scene?: "hunt" | "nightmare"; impacts?: readonly number[]; pursuit?: boolean;
};

export interface BenForm {
  movement: Pick<CharacterData, "speed" | "jump" | "gravity"> & {
    locomotion: NonNullable<CharacterData["locomotion"]>;
  };
  width: number;
  pushHeight: number;
  damageTaken: number;
  hurtboxes: NonNullable<CharacterData["hurtboxes"]>;
  moves: Record<string, Move>;
  grab: BenGrab;
  throwEffect?: BenEffect;
}

function throwMove(startup: number, reach: number, y: number): Move {
  return {
    startup, active: 3, recovery: 21, damage: 0,
    stun: 0, blockstun: 0, push: 0, launch: 0, level: "throw",
    kind: "grab", rank: 3, cancels: [], hitstop: 0, box: { x: 15, y, w: reach, h: 38 },
  };
}

function grab(damage: number, rise: number, push: number, separation: number,
  duration = 27, reverse = false, carry = 0, clip?: string): BenGrab {
  const hitTick = Math.round(duration * 2 / 3);
  return {
    startFromContact: true, duration, hitTick, damage, recoveryTicks: duration > 28 ? 18 : 12,
    reverse, carry, clip,
    victimTrack: [
      { tick: 0, x: separation, y: 0, clip: "grabbed" },
      { tick: Math.round(duration / 3), x: separation, y: -rise, clip: "grabbed" },
      { tick: hitTick, x: reverse ? -separation : separation + 18, y: -Math.round(rise / 2), clip: "damageAir" },
      { tick: duration, x: reverse ? -separation - 30 : separation + 32, y: 0, clip: "damageAir" },
    ],
    release: { vx: push, vy: -5, stun: 32 },
  };
}

function stage6Body(
  movement: BenForm["movement"], width: number, height: number, damageTaken: number,
  moves: Record<string, Move>, grabStyle: BenGrab, throwEffect: BenEffect, throwStartup: number,
): BenForm {
  const body = (w: number, y: number, h: number) => ({ x: -Math.round(w / 2), y, w, h });
  const upper = Math.round(height * .54);
  return {
    movement, width, pushHeight: Math.round(height * .67), damageTaken, throwEffect,
    hurtboxes: {
      standing: [body(width, -height, upper), body(width - 6, upper - height, height - upper)],
      crouching: [body(width + 8, -Math.round(height * .69), Math.round(height * .69))],
      air: [body(width + 2, -height + 12, height - 24)],
    },
    moves: { ...moves, throw: throwMove(throwStartup, Math.round(width * .73) + 12, -105) },
    grab: grabStyle,
  };
}

export const nrgReleasedForm = stage6Body({
  speed: 6.8, jump: -14, gravity: .59,
  locomotion: {
    backSpeed: 5.1, airSpeed: 6.8, jumpStartup: 5, landingTicks: 7,
    dashForward: [5, 9, 14, 17, 18, 17, 16, 13, 11, 8, 5, 3],
    backdash: [4, 7, 11, 13, 14, 13, 11, 9, 7, 5, 3, 2],
  },
}, 53, 151, 1.1, nrgReleasedMoves, grab(74, 23, 9, 54, 19), "thermal", 7);

export const benForms: Partial<Record<BenAlien, BenForm>> = {
  bigChill: stage6Body({
    speed: 5.7, jump: -15.4, gravity: .58,
    locomotion: {
      backSpeed: 4.6, airSpeed: 7.2, jumpStartup: 5, landingTicks: 7,
      dashForward: [4, 8, 12, 15, 17, 16, 15, 12, 9, 7, 4, 2],
      backdash: [4, 7, 10, 13, 14, 13, 11, 9, 6, 4, 3, 2],
    },
  }, 49, 145, 1.02, bigChillMoves, grab(75, 26, 10, 52, 20), "ice", 7),
  ghostfreak: stage6Body({
    speed: 5.9, jump: -13.2, gravity: .67,
    locomotion: {
      backSpeed: 4.7, airSpeed: 5.6, jumpStartup: 6, landingTicks: 8,
      dashForward: [5, 9, 14, 18, 18, 16, 14, 12, 8, 6, 4, 2],
      backdash: [4, 8, 11, 13, 14, 13, 11, 9, 7, 5, 3, 2],
    },
  }, 51, 146, 1.03, ghostfreakMoves, grab(73, 30, 9, 53, 21), "spectral", 8),
  gravattack: stage6Body({
    speed: 3.5, jump: -13, gravity: .72,
    locomotion: {
      backSpeed: 2.65, airSpeed: 3.5, jumpStartup: 8, landingTicks: 11,
      dashForward: [3, 6, 9, 12, 13, 13, 11, 9, 7, 5, 3, 2],
      backdash: [3, 5, 7, 9, 9, 8, 7, 6, 5, 3, 2, 1],
    },
  }, 91, 180, .95, gravattackMoves, grab(91, 54, 10, 70, 30), "gravity", 9),
  echoEcho: stage6Body({
    speed: 6.25, jump: -14.3, gravity: .69,
    locomotion: {
      backSpeed: 4.8, airSpeed: 5.9, jumpStartup: 5, landingTicks: 7,
      dashForward: [5, 9, 13, 16, 16, 15, 13, 10, 7, 5, 3],
      backdash: [4, 8, 11, 13, 12, 10, 8, 6, 4, 2],
    },
  }, 43, 101, 1.06, echoEchoMoves, grab(64, 14, 7, 49, 20), "sonic", 7),
  nrg: stage6Body({
    speed: 3.4, jump: -12.4, gravity: .91,
    locomotion: {
      backSpeed: 2.6, airSpeed: 3.4, jumpStartup: 8, landingTicks: 12,
      dashForward: [3, 5, 8, 11, 12, 12, 10, 9, 7, 6, 4, 3, 2],
      backdash: [2, 4, 6, 8, 9, 9, 8, 7, 5, 4, 3, 2, 1],
    },
  }, 86, 161, .92, nrgMoves, grab(97, 37, 12, 68, 26), "metal", 10),
  xlr8: {
    movement: {
      speed: 8.8, jump: -14.7, gravity: .72,
      locomotion: {
        backSpeed: 6.2, airSpeed: 7.1, jumpStartup: 5, landingTicks: 7,
        dashForward: [7, 13, 20, 23, 24, 24, 23, 21, 18, 14, 10, 6],
        backdash: [5, 10, 15, 18, 18, 17, 15, 12, 9, 7, 5, 3],
      },
    },
    width: 44, pushHeight: 84, damageTaken: 1.06,
    hurtboxes: {
      standing: [{ x: -16, y: -133, w: 45, h: 49 }, { x: -23, y: -87, w: 47, h: 87 }],
      crouching: [{ x: -26, y: -88, w: 57, h: 88 }],
      air: [{ x: -23, y: -122, w: 52, h: 113 }],
    },
    moves: {
      ...xlr8Moves,
      throw: throwMove(7, 48, -108),
    },
    grab: grab(70, 30, 11, 48, 17, true, 46),
  },
  fourArms: {
    movement: {
      speed: 3.6, jump: -15.2, gravity: .96,
      locomotion: {
        backSpeed: 2.7, airSpeed: 3.4, jumpStartup: 8, landingTicks: 12,
        dashForward: [2, 3, 5, 8, 11, 13, 13, 12, 11, 9, 7, 6, 4, 2],
        backdash: [2, 4, 6, 8, 10, 10, 9, 8, 7, 5, 4, 3, 2, 1],
      },
    },
    width: 84, pushHeight: 114, damageTaken: .95,
    hurtboxes: {
      standing: [
        { x: -37, y: -163, w: 77, h: 101 }, { x: -37, y: -63, w: 76, h: 63 },
        { x: -51, y: -131, w: 18, h: 52 }, { x: 39, y: -132, w: 23, h: 54 },
      ],
      crouching: [{ x: -45, y: -112, w: 92, h: 112 }],
      air: [{ x: -41, y: -153, w: 83, h: 139 }],
    },
    moves: {
      ...fourArmsMoves,
      throw: throwMove(11, 63, -105),
    },
    grab: grab(102, 48, 10, 69),
  },
  heatblast: {
    movement: {
      speed: 5.5, jump: -13.8, gravity: .65,
      locomotion: {
        backSpeed: 4.3, airSpeed: 5, jumpStartup: 6, landingTicks: 8,
        dashForward: [4, 7, 11, 15, 17, 17, 16, 14, 12, 10, 8, 5, 3],
        backdash: [4, 6, 10, 13, 14, 14, 13, 11, 9, 7, 5, 4, 2],
      },
    },
    width: 56, pushHeight: 96, damageTaken: 1,
    hurtboxes: {
      standing: [{ x: -23, y: -122, w: 52, h: 71 }, { x: -29, y: -52, w: 60, h: 52 }],
      crouching: [{ x: -30, y: -94, w: 62, h: 94 }],
      air: [{ x: -29, y: -126, w: 58, h: 113 }],
    },
    moves: {
      ...heatblastMoves,
      throw: throwMove(9, 54, -107),
    },
    grab: grab(82, 30, 9, 56),
  },
  diamondhead: {
    movement: {
      speed: 4.9, jump: -13.5, gravity: .72,
      locomotion: {
        backSpeed: 3.8, airSpeed: 4.6, jumpStartup: 6, landingTicks: 9,
        dashForward: [4, 6, 9, 12, 14, 14, 13, 11, 9, 7, 5, 3],
        backdash: [4, 6, 9, 11, 12, 11, 9, 7, 5, 4, 3, 2],
      },
    },
    width: 66, pushHeight: 101, damageTaken: .97,
    hurtboxes: {
      standing: [{ x: -27, y: -140, w: 57, h: 76 }, { x: -33, y: -65, w: 67, h: 65 }],
      crouching: [{ x: -35, y: -103, w: 71, h: 103 }],
      air: [{ x: -31, y: -137, w: 65, h: 126 }],
    },
    moves: { ...diamondheadMoves, throw: throwMove(8, 57, -105) },
    grab: grab(87, 27, 10, 61, 24),
    throwEffect: "crystal",
  },
  humungousaur: {
    movement: {
      speed: 3.4, jump: -12.6, gravity: .91,
      locomotion: {
        backSpeed: 2.6, airSpeed: 3.1, jumpStartup: 9, landingTicks: 13,
        dashForward: [2, 3, 5, 8, 11, 12, 12, 11, 10, 8, 6, 5, 4, 3, 2],
        backdash: [2, 3, 5, 7, 9, 9, 8, 7, 6, 5, 4, 3, 2, 2, 1],
      },
    },
    width: 94, pushHeight: 121, damageTaken: .96,
    hurtboxes: {
      standing: [{ x: -41, y: -174, w: 91, h: 114 }, { x: -46, y: -62, w: 92, h: 62 }],
      crouching: [{ x: -48, y: -120, w: 99, h: 120 }],
      air: [{ x: -45, y: -166, w: 94, h: 154 }],
    },
    moves: { ...humungousaurMoves, throw: throwMove(10, 65, -105) },
    grab: grab(98, 51, 12, 73, 26, false, 9),
    throwEffect: "colossus",
  },
  feedback: {
    movement: {
      speed: 5.8, jump: -14.2, gravity: .66,
      locomotion: {
        backSpeed: 4.5, airSpeed: 6.3, jumpStartup: 5, landingTicks: 7,
        dashForward: [5, 9, 13, 16, 17, 17, 15, 13, 10, 8, 5, 3],
        backdash: [4, 8, 11, 13, 14, 13, 11, 9, 7, 5, 4, 2],
      },
    },
    width: 49, pushHeight: 96, damageTaken: 1.03,
    hurtboxes: {
      standing: [{ x: -19, y: -130, w: 39, h: 63 }, { x: -25, y: -70, w: 50, h: 70 }],
      crouching: [{ x: -27, y: -91, w: 55, h: 91 }],
      air: [{ x: -22, y: -122, w: 49, h: 108 }],
    },
    moves: { ...feedbackMoves, throw: throwMove(7, 51, -103) },
    grab: grab(77, 20, 9, 52, 20),
    throwEffect: "electric",
  },
};


export function benGrabFor(form: BenForm | undefined, id: string): BenGrab | undefined {
  if (!form) return;
  if (id === "quad_light") return quadLight;
  if (id === "quad_medium") return quadMedium;
  if (id.startsWith("spectralArms_")) return id.endsWith("_medium") ? huntK : huntJ;
  if (id.startsWith("conductor_")) return id.endsWith("_medium") ? conductorK : conductorJ;
  if (id.startsWith("ghostPhase_")) return id.endsWith("_medium") ? nightmareK : nightmareJ;
  return form.grab;
}

const conductorJ = { ...grab(58, 15, 9, 64, 20, false, 0, "conductorHold"), impacts: [13] };
const conductorK: BenGrab = {
  ...grab(77, 34, 4, 70, 28, false, 0, "conductorHoldK"),
  impacts: [12, 19], knockdown: false, pursuit: true, release: { vx: 2.7, vy: -16, stun: 41 },
};

function spectralSequence(kind: "hunt" | "nightmare", damage: number, duration: number, impacts: number[]): BenGrab {
  const hunt = kind === "hunt";
  const peak = Math.round(duration * .42);
  return {
    ...grab(damage, hunt ? 96 : 30, hunt ? 8 : 13, 70, duration, false, 0,
      kind + (impacts.length > (hunt ? 2 : 3) ? "K" : "J")),
    scene: kind, impacts,
    victimTrack: [
      { tick: 0, x: 62, y: 0, clip: "grabbed" },
      { tick: peak, x: 80, y: hunt ? -100 : -23, clip: "damageAir" },
      { tick: duration - 7, x: 93, y: hunt ? -48 : -29, clip: "damageAir" },
      { tick: duration, x: 109, y: 0, clip: "damageAir" },
    ],
    release: { vx: hunt ? 7 : 12, vy: -4, stun: 33 },
  };
}

const huntJ = spectralSequence("hunt", 65, 33, [15, 28]);
const huntK = spectralSequence("hunt", 88, 45, [14, 25, 38]);
const nightmareJ = spectralSequence("nightmare", 79, 37, [16, 23, 31]);
const nightmareK = spectralSequence("nightmare", 110, 50, [18, 25, 34, 43]);
const quadLight = grab(113, 29, 7, 64, 22, false, 0, "quad_light_hold");
const quadMedium = grab(145, 70, 14, 70, 34, false, 0, "quad_medium_hold");
