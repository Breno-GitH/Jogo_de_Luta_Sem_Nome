import poses from "../data/luffy-secondary-poses.json";
import type { Fighter } from "./combat";
import { buildLuffyLimb } from "./luffy-normals";
import type { CharacterData, Move } from "./types";

type PoseName = keyof typeof poses;
interface Sequence {
  frames: number[];
  durations: number[];
  loop: boolean;
  poses: {
    ticks: number;
    phase: "reaction";
    hurtboxes: (typeof poses)[PoseName]["hurtboxes"];
  }[];
}
function sequence(cels: [PoseName, number][], loop = false): Sequence {
  return {
    frames: cels.map(([name]) => poses[name].frame),
    durations: cels.map(([, ticks]) => ticks),
    loop,
    poses: cels.map(([name, ticks]) => ({
      ticks,
      phase: "reaction",
      hurtboxes: poses[name].hurtboxes,
    })),
  };
}

const reachAt = 4;
const startup = 7;
const active = 4;
const retractAt = startup + active;
const armHome = retractAt + 8;
const recovery = 23;
const releaseAt = 12;
const releasePoseAt = 16;
export const luffySecondaryClips = {
  guardStand: sequence(
    [
      ["guardStandA", 8],
      ["guardStandB", 10],
    ],
    true,
  ),
  guardCrouch: sequence(
    [
      ["guardLowA", 9],
      ["guardLowB", 11],
    ],
    true,
  ),
  guardImpactStand: sequence([
    ["guardStandHitB", 3],
    ["guardStandHitA", 3],
  ]),
  guardImpactCrouch: sequence([
    ["guardLowHitB", 3],
    ["guardLowHitA", 3],
  ]),
  guardRecovery: sequence([["guardExit", 4]]),
  damageLight: sequence([
    ["hitLight", 10],
    ["guardExit", 8],
  ]),
  damageMedium: sequence([
    ["hitMedium", 10],
    ["hitLight", 10],
  ]),
  damageHeavy: sequence([
    ["hitHeavy", 13],
    ["hitMedium", 12],
  ]),
  damageCrouch: sequence([
    ["hitLow", 12],
    ["guardLowA", 8],
  ]),
  damageAir: sequence([
    ["hitAir", 10],
    ["falling", 12],
  ]),
  launched: sequence([
    ["launched", 11],
    ["hitAir", 10],
  ]),
  airKnockback: sequence([["airKnockback", 9]]),
  falling: sequence([["falling", 12]]),
  downed: sequence([["downed", 26]]),
  getup: sequence([
    ["getupStart", 8],
    ["getupEnd", 9],
    ["guardExit", 4],
  ]),
  ko: sequence([
    ["defeatKneel", 7],
    ["downed", 7],
    ["ko", 41],
  ]),
  defeat: sequence([["defeatGround", 48]]),
  entrance: sequence([
    ["entryWalk", 4],
    ["entryReady", 18],
  ]),
  taunt: sequence([
    ["tauntBeckon", 14],
    ["tauntGrin", 18],
    ["guardExit", 6],
  ]),
  victory: sequence([
    ["victoryJump", 10],
    ["victoryCheer", 28],
    ["victoryJump", 8],
    ["victoryCheer", 32],
  ]),
  grabbed: sequence([
    ["hitLow", 6],
    ["hitAir", 10],
  ]),
  throw: sequence([
    ["throwPrep", reachAt],
    ["throwReach", armHome - reachAt],
    ["throwRecover", startup + active + recovery - armHome],
  ]),
  grabHold: sequence([
    ["throwReach", releasePoseAt],
    ["throwRelease", 6],
  ]),
  throwRecover: sequence([
    ["throwRecover", 9],
    ["guardExit", 6],
  ]),
};

export const luffyThrow: Move = {
  kind: "grab",
  level: "throw",
  startup,
  active,
  recovery,
  damage: 112,
  stun: 38,
  blockstun: 0,
  push: 0,
  launch: 0,
  rank: 0,
  cancels: [],
  box: { x: 0, y: 0, w: 0, h: 0 },
  poses: luffySecondaryClips.throw.poses,
};

export const luffySecondary = {
  lifecycle: {
    entranceDistance: 63,
    entranceWalkTicks: 21,
    entranceSpeed: 3,
    tauntTicks: 38,
    getupTicks: 21,
    koTicks: 55,
  },
  reactions: luffySecondaryClips,
  grabSequence: {
    startFromContact: true,
    duration: 22,
    hitTick: releaseAt,
    damage: luffyThrow.damage,
    recoveryTicks: 15,
    victimTrack: [
      { tick: 0, x: 76, y: 0, clip: "grabbed" },
      { tick: 6, x: 56, y: -12, clip: "grabbed" },
      { tick: 10, x: 66, y: -24, clip: "grabbed" },
      { tick: 12, x: 91, y: -26, clip: "damageAir" },
      { tick: 16, x: 120, y: -25, clip: "damageAir" },
      { tick: 21, x: 138, y: -9, clip: "falling" },
    ],
    release: { vx: 7, vy: -4, stun: 38 },
  },
} satisfies Pick<CharacterData, "lifecycle" | "reactions" | "grabSequence">;

/** The same terminal used to draw the gripping hand can catch a grounded foe.
 * During capture the anchor follows the captive, then retracts before release art. */
export function luffyGrabLimb(actor: Fighter) {
  if (actor.data.id !== "luffy") return;
  const tick = actor.stateFrame;
  const [x, y] = poses.throwReach.joint;
  const wrist = { x: x + 14, y: y + 4 };
  let tip = wrist;
  let activeHand = false;
  if (actor.state === "attack" && actor.moveId === "throw") {
    if (tick < reachAt || tick >= armHome) return;
    const reach = Math.max(
      0,
      Math.min(1, (tick - reachAt + 1) / (retractAt - reachAt)),
    );
    const pull =
      tick < retractAt ? 0 : (tick - retractAt + 1) / (armHome - retractAt);
    const length = reach * (1 - pull);
    tip = {
      x: wrist.x + (90 - wrist.x) * length,
      y: wrist.y + (-84 - wrist.y) * length,
    };
    activeHand = tick >= startup && tick < retractAt;
  } else if (
    actor.state === "grabbing" &&
    actor.match?.capture?.kind === "grab"
  ) {
    if (tick >= releasePoseAt || !actor.opponent) return;
    const victim = actor.opponent;
    const pull = Math.max(0, (tick - releaseAt) / (releasePoseAt - releaseAt));
    const gripX = (victim.x - actor.x) * actor.facing - 7;
    const gripY = victim.y - actor.y - 83;
    tip = {
      x: wrist.x + (gripX - wrist.x) * (1 - pull),
      y: wrist.y + (gripY - wrist.y) * (1 - pull),
    };
  } else return;
  const limb = buildLuffyLimb(actor, { x, y }, tip, 7, false, 120);
  return { ...limb, palm: true, hitboxes: activeHand ? [limb.terminal] : [] };
}
