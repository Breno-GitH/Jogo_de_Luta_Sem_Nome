import { centipedeId, centipedeMove, centipedeOpener } from "./kaneki-centipede";
import { kanekiMotion } from "./kaneki-motion";
import art from "../data/kaneki-combat-art.json";
import baseChainArt from "../data/kaneki-chain-art.json";
import stage5Art from "../data/kaneki-stage5-art.json";
import { directedKagune, kaguneIds, type KaguneId } from "./kagune";
import { worldRect } from "./geometry";
import { kanekiSpecialArt, kanekiSpecialMoves, kanekiTechnique, rushProfile, rushTipLive, swordProfile } from "./kaneki-specials";
import type { Fighter, CaptureSequence } from "./combat";
import { chainFinishes, type Chain } from "./kaneki-chain";
import type { AttackShape, Button, CharacterData, Move, Point } from "./types";

export const kanekiArt = art;
export const kanekiChainArt = {
  clips: { ...baseChainArt.clips, ...stage5Art.clips },
  lumbar: { ...baseChainArt.lumbar, ...stage5Art.lumbar },
};
export const captureWindow = 24;
export const captureWindup = 4;

export const kaguneRoutes = {
  pull: {
    duration: 13,
    damage: 27,
    stun: 28,
    push: 0,
    launch: 0,
    knockdown: false,
  },
  throw: {
    duration: 15,
    damage: 92,
    stun: 36,
    push: 9,
    launch: -4,
    knockdown: true,
  },
  launch: {
    duration: 14,
    damage: 54,
    stun: 36,
    push: 0.8,
    launch: -14,
    knockdown: false,
  },
} as const;
export type KaguneRoute = keyof typeof kaguneRoutes;
export type KanekiCapture = {
  source: "ground" | "air";
  limb: KaguneId;
  x: number;
  y: number;
  direction: number;
  route?: KaguneRoute;
  pending?: KaguneRoute;
  selectedAt?: number;
  fallback?: boolean;
  specialId?: string;
  chain?: Chain;
};

export function kaguneChoice(pressed: Button[]) {
  const button = pressed.find(
    (key) => key === "light" || key === "medium" || key === "heavy",
  );
  return button === "light"
    ? "pull"
    : button === "medium"
      ? "throw"
      : button === "heavy"
        ? "launch"
        : undefined;
}

const body = {
  stand: [
    { x: -18, y: -128, w: 36, h: 33 },
    { x: -24, y: -95, w: 51, h: 52 },
    { x: -32, y: -43, w: 64, h: 43 },
  ],
  crouch: [
    { x: -19, y: -89, w: 44, h: 34 },
    { x: -34, y: -55, w: 75, h: 55 },
  ],
  air: [
    { x: -19, y: -117, w: 37, h: 31 },
    { x: -30, y: -86, w: 62, h: 74 },
  ],
};
type Normal = keyof typeof art.normals;
type Timing = [
  startup: number,
  active: number,
  recovery: number,
  damage: number,
  stun: number,
  blockstun: number,
  push: number,
  hitstop: number,
];
const timings: Record<Normal, Timing> = {
  stand_light: [4, 4, 11, 32, 18, 9, 1.2, 5],
  stand_medium: [7, 5, 15, 58, 23, 12, 1.9, 6],
  stand_heavy: [10, 6, 22, 82, 26, 14, 4.2, 9],
  crouch_light: [4, 4, 11, 28, 18, 9, 0.9, 5],
  crouch_medium: [7, 5, 16, 52, 24, 12, 1.5, 6],
  crouch_heavy: [10, 6, 24, 73, 36, 14, 1.15, 8],
  air_light: [4, 4, 9, 32, 20, 9, 1, 5],
  air_medium: [7, 5, 12, 53, 24, 11, 1.4, 7],
  air_heavy: [10, 6, 20, 77, 29, 13, 4.1, 9],
};
export const kanekiNormalIds = Object.keys(timings) as Normal[];
export const kanekiHolds = (
  startup: number,
  active: number,
  recovery: number,
) => [
  1,
  Math.floor(startup / 2),
  startup - Math.floor(startup / 2) - 1,
  active,
  Math.floor(recovery / 2),
  Math.ceil(recovery / 2),
];

const normalMoves = Object.fromEntries(
  kanekiNormalIds.map((id) => {
    const [startup, active, recovery, damage, stun, blockstun, push, hitstop] =
      timings[id];
    const [stance, strength] = id.split("_") as [keyof typeof body, string];
    const rank = strength === "light" ? 1 : strength === "medium" ? 2 : 3;
    const cancels =
      rank === 1
        ? ["medium"]
        : rank === 2
          ? ["heavy", ...(stance === "stand" ? ["throw"] : [])]
          : id === "crouch_heavy"
            ? ["jump"]
            : [];
    if (stance !== "air" && rank >= 2) cancels.push("special");
    const frames = art.normals[id];
    const move: Move = {
      startup,
      active,
      recovery,
      damage,
      stun,
      blockstun,
      push,
      hitstop,
      rank,
      cancels,
      cancelWindow: { fromTick: startup, toTick: startup + active + 8 },
      cancelMoves:
        rank === 1
          ? [stance + "_medium"]
          : rank === 2
            ? [stance + "_heavy", ...(stance === "stand" ? ["throw"] : [])]
            : [],
      level: stance === "crouch" ? "low" : stance === "air" ? "high" : "mid",
      launch:
        id === "crouch_heavy"
          ? -13.6
          : id === "air_light"
            ? -3.2
            : id === "air_medium"
              ? -4.6
              : id === "air_heavy"
                ? 8
                : 0,
      airHold: stance === "air" && rank < 3 ? -1.8 : undefined,
      knockdown: id === "air_heavy",
      box: { x: 0, y: 0, w: 0, h: 0 },
      poses: kanekiHolds(startup, active, recovery).map((ticks, index) => ({
        ticks,
        phase: index < 3 ? "startup" : index === 3 ? "active" : "recovery",
        hurtboxes: body[stance],
        hitboxes: index === 3 && frames.hit ? [frames.hit] : [],
      })),
    };
    return [id, move];
  }),
) as Record<Normal, Move>;

const empty = { x: 0, y: 0, w: 0, h: 0 };
const throwMove: Move = {
  kind: "grab",
  level: "throw",
  startup: 10,
  active: 4,
  recovery: 23,
  box: empty,
  damage: 0,
  stun: 0,
  blockstun: 0,
  push: 0,
  launch: 0,
  rank: 0,
  cancels: [],
};
const launchLink: Move = {
  ...throwMove,
  kind: "strike",
  level: "mid",
  startup: 0,
  active: 0,
  recovery: 14,
  cancels: ["jump"],
  cancelWindow: { fromTick: 0, toTick: 12 },
};
const pullLink: Move = { ...launchLink, recovery: 4, cancels: [] };

export const kaneki: CharacterData = {
  ...kanekiMotion,
  moves: {
    ...normalMoves,
    throw: throwMove,
    captureLaunchLink: launchLink,
    capturePullLink: pullLink,
  },
  specialMoves: kanekiSpecialMoves,
  superMoves: { [centipedeId]: centipedeMove },
  combatLimits: { maxHits: 8, maxAirHits: 5, maxTicks: 205 },
  hurtboxes: { standing: body.stand, crouching: body.crouch, air: body.air },
  lifecycle: {
    entranceDistance: 0,
    entranceSpeed: 0,
    entranceWalkTicks: 0,
    tauntTicks: 30,
    getupTicks: 20,
    koTicks: 50,
  },
  grabSequence: {
    duration: 15,
    hitTick: 14,
    damage: 92,
    recoveryTicks: 15,
    victimTrack: [],
    release: { vx: 9, vy: -4, stun: 36 },
  },
};

export function canKaguneCapture(
  f: Fighter,
  target: Fighter,
  source: "ground" | "air",
) {
  if (
    target.kanekiCaptured ||
    target.invulnerable ||
    target.knockedDown ||
    target.health <= 0 ||
    target.match?.temporal.isFrozen(target.id)
  )
    return false;
  const limit = kaneki.combatLimits!;
  if (
    target.combo >= limit.maxHits - 1 ||
    target.comboAge >= limit.maxTicks ||
    target.comboAirHits >= limit.maxAirHits - 1
  )
    return false;
  if (source === "air") {
    return (
      f.airborne &&
      target.airborne &&
      target.state === "hitstun" &&
      target.combo >= 2 &&
      f.stateFrame < f.move!.startup + 3
    );
  }
  return (
    !f.airborne &&
    !target.airborne &&
    target.state !== "blockstun" &&
    (target.state !== "hitstun" || !!f.kanekiThrowLink)
  );
}

export const kaguneFraction = (x: number) => Math.max(0, Math.min(1, x));
const round = Math.round;
const blend = (from: number, to: number, amount: number) =>
  round(from + (to - from) * amount);
const curve = (t: number) => t * t * (3 - 2 * t);
export function kaguneVictimPosition(
  seq: CaptureSequence,
  actorX: number,
  actorY: number,
  age: number,
): Point {
  const s = seq.kaneki!;
  const route = s.route!;
  const forward =
    route === "pull"
      ? 54
      : route === "launch"
        ? 66
        : Math.max(121, (s.x - actorX) * s.direction + 38);
  const endY =
    route === "pull" ? actorY : actorY - (route === "launch" ? 25 : 17);
  const t = curve(kaguneFraction(age / (kaguneRoutes[route].duration - 1)));
  const arc = route === "throw" ? 24 : route === "launch" ? 14 : 0;
  return {
    x: Math.max(
      40,
      Math.min(1240, blend(s.x, actorX + s.direction * forward, t)),
    ),
    y: blend(s.y, endY, t) - round(arc * 4 * t * (1 - t)),
  };
}

export function kanekiCombatClip(
  f: Fighter,
): { name: string; tick: number } | undefined {
  if (f.data.id !== "kaneki") return;
  if (f.state === "cinematic" && f.actionClip.startsWith(centipedeId))
    return { name: f.actionClip, tick: f.stateFrame };
  if (f.state === "attack") {
    if (f.moveId === centipedeId) return { name: "centipedeActivation", tick: f.stateFrame };
    const spec = kanekiTechnique(f.moveId);
    if (spec?.family === "kaguneGrab") {
      const end = spec.startup + spec.active;
      const tick = f.stateFrame;
      return tick < end
        ? { name: "grabStartup", tick: Math.floor(14 * tick / end) }
        : { name: "grabMiss", tick: Math.floor(23 * (tick - end) / spec.recovery) };
    }
    if (spec) return { name: spec.id, tick: f.stateFrame };
    if (f.moveId === "throw")
      return {
        name:
          f.stateFrame < throwMove.startup + throwMove.active
            ? "grabStartup"
            : "grabMiss",
        tick:
          f.stateFrame < throwMove.startup + throwMove.active
            ? f.stateFrame
            : f.stateFrame - throwMove.startup - throwMove.active,
      };
    if (f.moveId === "captureLaunchLink" || f.moveId === "capturePullLink")
      return { name: "grabRecovery", tick: f.stateFrame };
    if (Object.hasOwn(timings, f.moveId))
      return { name: f.moveId, tick: f.stateFrame };
  }
  if (f.state === "grabbing" && f.match?.capture?.kaneki)
    return { name: f.actionClip, tick: f.stateFrame };
  if (f.state === "throwRecover")
    return { name: f.actionClip || "grabRecovery", tick: f.stateFrame };
}

export function kanekiTechniqueCaptureTick(capture: CaptureSequence, hold = false): number | undefined {
  const chain = capture.kaneki?.chain;
  if (!chain) return;
  const tick = Math.max(0, capture.tick - 1);
  if (chain.phase === "opener" || chain.phase === "outro") return Math.max(0, tick - chain.since);
  if (hold && chain.origin === "fourSwords" && chain.phase === "choice1") return swordProfile(chain.rank).strikes[2];
}

function kaguneGrabReach(spec: NonNullable<ReturnType<typeof kanekiTechnique>>, tick: number) {
  const end = spec.startup + spec.active;
  if (tick < spec.startup) return 22 + 17 * curve(kaguneFraction(tick / spec.startup));
  if (tick < end) return 39 + (spec.reach - 39) * (tick - spec.startup) / (spec.active - 1);
  return spec.reach * (1 - curve(kaguneFraction((tick - end) / (spec.recovery - 3))));
}

/** One authored local-space trajectory drives render, terminal contact and exposed shaft. */
export function kanekiOffensiveKagunes(
  f: Fighter,
  floor: number,
  originOverride?: Point,
) {
  const opener = centipedeOpener(f);
  if (f.moveId === centipedeId) return opener ? [opener] : [];
  if (f.match?.centipede?.attacker === f.id) return [];
  const clip = kanekiCombatClip(f);
  if (!clip) return [];
  const s = f.match?.capture?.kaneki;
  const side = f.facing as 1 | -1;
  const bank = Object.hasOwn(kanekiSpecialArt.clips, clip.name) ? kanekiSpecialArt : art;
  const data = (bank.clips as Record<string, { frames: number[]; durations: number[] }>)[clip.name];
  const chainClip = kanekiChainArt.clips[clip.name as keyof typeof kanekiChainArt.clips];
  const origin = originOverride ?? (chainClip
    ? kanekiChainArt.lumbar[chainClip.sheet as keyof typeof kanekiChainArt.lumbar][chainClip.frames[clipFrame(chainClip.durations, clip.tick)]]
    : bank.lumbar[data.frames[clipFrame(data.durations, clip.tick)]]);
  const root = { x: f.x + origin.x * side, y: f.y + origin.y };
  const limb = (id: KaguneId, x: number, y: number, bend: number, burrow = false) =>
    directedKagune(
      id,
      root,
      side,
      {
        x: Math.max(side > 0 ? 2 - root.x : root.x - 1278,
          Math.min(side > 0 ? 1278 - root.x : root.x - 2, x)),
        y,
      },
      bend,
      floor,
      burrow,
    );
  const spec = kanekiTechnique(f.moveId);
  const cap = f.state === "grabbing" ? f.match?.capture : undefined;
  const captured = cap && kanekiTechnique(s?.specialId);
  const chain = s?.chain;
  if (s && cap && f.opponent && chain?.finish) {
    const age = Math.max(0, cap.tick - 1 - chain.since);
    const finish = chainFinishes[chain.finish];
    if (age > finish.hit + 6) return [];
    const victim = f.opponent;
    const x = (victim.x - root.x) * side;
    const y = victim.y - root.y - 65;
    const tighten = 1 - .64 * kaguneFraction((age - finish.hit) / 7);
    const limbs = [limb(s.limb, (x - 12) * tighten, y * tighten, chain.finish === "lasso" ? -55 : -28)];
    const count = finish.limbs ?? (finish.slam ? 4 : chain.finish === "lasso" || chain.finish === "release" ? 1 : 2);
    if (count >= 2) {
      const other = s.limb === "upperFront" ? "lowerFront" : "upperFront";
      limbs.push(limb(other, (x + 8) * tighten, (y + 13) * tighten, chain.finish === "spin" ? -66 : 31));
    }
    if (count >= 3) {
      for (const id of kaguneIds.filter(id => !limbs.some(limb => limb.id === id)).slice(0, count - 2)) {
        const upper = id.startsWith("upper");
        limbs.push(limb(id, (x + (upper ? -29 : 18)) * tighten, (y + (upper ? -24 : 32)) * tighten, upper ? -74 : 40));
      }
    }
    return limbs;
  }
  const sceneTick = cap && kanekiTechniqueCaptureTick(cap, true);
  if (s && cap && captured && f.opponent && sceneTick !== undefined) {
    const tick = sceneTick;
    const x = Math.max(25, (f.opponent.x - root.x) * side - 14);
    const y = f.opponent.y - root.y - 64;
    if (captured.family === "fourSwords") {
      const p = swordProfile(captured.rank);
      const result = [limb("lowerRear", x, y + 20, 15, true)];
      const order = ["upperFront", "lowerFront", "upperRear"] as const;
      for (const [i, id] of order.entries()) {
        const elapsed = tick - p.strikes[i];
        if (elapsed < -5) continue;
        const t = tick >= p.strikes[2] ? 1 : elapsed <= 0
          ? .22 + .78 * curve((elapsed + 5) / 5) : 1 - .52 * kaguneFraction(elapsed / 6);
        result.push(limb(id, x * t, y + [7, 19, -14][i] * (1 - t), [-47, 38, -77][i]));
      }
      return result;
    }
    const result = [limb(s.limb, x, y, -29 - captured.rank * 5)];
    if (captured.rank === 2 && tick >= Math.floor(rushProfile(2).end * .4)) {
      result.push(limb("lowerRear", x - 3, y + 16, 26), limb("upperRear", x - 8, y - 12, -62));
    }
    return result;
  }
  if (s && f.state === "grabbing" && f.opponent) {
    const victim = f.opponent;
    const nearSide = (victim.x - root.x) * side - 14;
    const tipY = victim.y - 76 - root.y;
    const id = s.limb;
    const primary = limb(id, nearSide, tipY, s.route === "throw" ? -37 : -22);
    return s.route === "launch" || chain?.origin === "kaguneGrab" && s.route === "throw"
      ? [
          primary,
          limb(
            id === "upperFront" ? "upperRear" : "upperFront",
            nearSide - 5,
            tipY + 20,
            -55,
          ),
        ]
      : [primary];
  }
  const move = f.move;
  if (
    !move ||
    (!spec && !["stand_heavy", "crouch_heavy", "air_heavy", "throw"].includes(f.moveId))
  )
    return [];
  const tick = f.stateFrame;
  const attackEnd = move.startup + move.active;
  if (spec?.family === "fourSwords") {
    const travel = tick < spec.startup ? curve(kaguneFraction((tick - 1) / (spec.startup - 1)))
      : tick < attackEnd ? 1 : 1 - curve(kaguneFraction((tick - attackEnd) / 12));
    if (travel <= 0 && tick >= attackEnd) return [];
    const age = tick - spec.startup;
    const h = age < 0 ? -11 : age < spec.active ? Math.min(93, 27 + age * 13) : 84 * travel;
    const end = f.kanekiBurrowX ?? f.x + side * spec.reach;
    return [limb("lowerRear", 22 + ((end - root.x) * side - 22) * travel, floor - root.y - h, 0, true)];
  }
  if (spec?.family === "rinkakuRush") {
    const age = tick - spec.startup;
    const retract = tick < attackEnd ? 1 : 1 - curve(kaguneFraction((tick - attackEnd) / 9));
    if (retract <= 0) return [];
    const x = (31 + (spec.reach - 31) * kaguneFraction((age + 3) / (spec.active + 1))) * retract;
    const drift = Math.min(25, Math.abs(f.vx) * 1.4) * retract;
    const wave = [-3, 0, 3, 4, 3, 0, -3, -4][tick % 8];
    return [
      limb("upperFront", x, -24 + wave, -23),
      limb("upperRear", -59 - drift, -65 - wave, -35),
      limb("lowerRear", -91 - drift, 20 + wave, 29),
      limb("lowerFront", -46 - drift, 33 - wave, 17),
    ];
  }
  if (spec?.family === "kaguneGrab") {
    const reach = kaguneGrabReach(spec, tick);
    return reach > 0 ? [limb(f.kanekiLimb ?? "lowerFront", reach, -5, -32)] : [];
  }
  const isGrab = f.moveId === "throw";
  const firstReach = isGrab ? .48 : .57;
  const extend =
    tick < move.startup
      ? 0.22 +
        (firstReach - 0.22) *
          curve(kaguneFraction((tick - 2) / (move.startup - 2)))
      : tick < attackEnd
        ? firstReach +
          (1 - firstReach) *
            kaguneFraction((tick - move.startup) / (move.active - 1))
        : 1 - curve(kaguneFraction((tick - attackEnd) / (move.recovery - 3)));
  if (extend <= 0) return [];
  if (f.moveId === "crouch_heavy") {
    const rise = kaguneFraction((tick - move.startup + 2) / 7);
    const late = kaguneFraction((tick - 4) / (move.startup - 2));
    return [
      limb("lowerRear", 102 * extend, -19 - rise * 66, -30),
      limb("upperFront", 87 * extend * late, -21 - rise * 82, -49),
    ];
  }
  if (f.moveId === "air_heavy")
    return [
      limb(f.kanekiLimb ?? "upperRear", 130 * extend, 17 + 48 * extend, -30),
    ];
  if (isGrab)
    return [
      limb(f.kanekiLimb ?? "lowerFront", 147 * extend, 2 - 8 * extend, -30),
    ];
  return [
    limb(
      "upperFront",
      126 * extend,
      -21 + Math.min(0, tick - move.startup) * 2,
      -27,
    ),
  ];
}

/** Only terminal geometry is offensive. The rush's shoulder rect is a separate outcome. */
export function kanekiSpecialShapes(f: Fighter, floor: number): AttackShape[] | undefined {
  const spec = kanekiTechnique(f.moveId);
  if (!spec) return;
  const pose = kanekiOffensiveKagunes(f, floor)[0];
  const age = f.stateFrame - spec.startup;
  if (spec.family === "rinkakuRush") {
    const body = worldRect(f.move!.box, f.x, f.y, f.facing);
    return pose && rushTipLive(spec.rank, age)
      ? [{ a: pose.spine.at(-3)!, b: pose.tip, r: 11 }, body] : [body];
  }
  if (!pose) return [];
  const rootward = pose.spine.at(-5)!;
  const dx = rootward.x - pose.tip.x, dy = rootward.y - pose.tip.y;
  const length = Math.hypot(dx, dy);
  const depth = spec.family === "kaguneGrab" && age > 0
    ? Math.max(18, kaguneGrabReach(spec, f.stateFrame) - kaguneGrabReach(spec, f.stateFrame - 1)) : 18;
  const end = length > depth ? { x: pose.tip.x + dx * depth / length, y: pose.tip.y + dy * depth / length } :
    length > 0 ? { x: pose.tip.x - f.facing * depth, y: pose.tip.y + dy } : rootward;
  const a = spec.family === "fourSwords"
    ? { x: pose.tip.x, y: Math.min(floor - 5, pose.tip.y + 23) }
    : end;
  return [{ a, b: pose.tip, r: spec.family === "kaguneGrab" ? 16 : 13 + spec.rank }];
}

function clipFrame(holds: readonly number[], tick: number) {
  let index = 0;
  while (index < holds.length - 1 && tick >= holds[index])
    tick -= holds[index++];
  return index;
}
